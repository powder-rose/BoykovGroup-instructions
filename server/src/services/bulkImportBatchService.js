import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  BULK_IMPORT_ROOT,
  ensureBulkImportRoot,
  ensureBulkImportBatchDirectories,
  getBulkImportBatchDir,
} from './bulkImportStorageService.js';

import { normalizeUploadedFilename } from '../utils/uploadedFilename.js';

const MANIFEST_FILE = 'manifest.json';

const LOCK_TTL_MS = 30_000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function manifestPath(id) {
  return path.join(getBulkImportBatchDir(id), MANIFEST_FILE);
}

function lockPath(id) {
  return path.join(getBulkImportBatchDir(id), '.manifest-lock');
}

async function readManifest(id) {
  try {
    const raw = await fs.readFile(manifestPath(id), 'utf8');

    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function writeManifest(id, manifest) {
  manifest.updatedAt = new Date().toISOString();

  const target = manifestPath(id);

  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;

  await fs.writeFile(temp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  await fs.rename(temp, target);

  return manifest;
}

async function acquireLock(id) {
  const lock = lockPath(id);

  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    try {
      await fs.mkdir(lock);

      return lock;
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      try {
        const stat = await fs.stat(lock);

        if (Date.now() - stat.mtimeMs > LOCK_TTL_MS) {
          const stale = `${lock}.stale-${process.pid}-${Date.now()}`;

          try {
            await fs.rename(lock, stale);

            await fs.rm(stale, {
              recursive: true,
              force: true,
            });

            continue;
          } catch {
            // другой процесс уже забрал stale lock
          }
        }
      } catch {
        // lock мог исчезнуть между stat/mkdir
      }

      await sleep(25);
    }
  }

  throw new Error('Не удалось получить lock пакетного импорта');
}

async function withManifestLock(id, callback) {
  const lock = await acquireLock(id);

  try {
    return await callback();
  } finally {
    await fs.rm(lock, {
      recursive: true,
      force: true,
    });
  }
}

function recalculate(manifest) {
  const files = Array.isArray(manifest.files) ? manifest.files : [];

  manifest.total = files.length;

  manifest.completed = files.filter(file => file.status === 'completed').length;

  manifest.failed = files.filter(file => file.status === 'failed').length;

  manifest.processing = files.filter(file => file.status === 'processing').length;

  manifest.waiting = files.filter(file => file.status === 'waiting').length;

  manifest.created = files.filter(file => file.action === 'new').length;

  manifest.duplicates = files.filter(file => file.action === 'duplicate').length;

  manifest.updatedVersions = files.filter(file => file.action === 'new_version').length;

  if (
    manifest.total > 0 &&
    manifest.completed + manifest.failed === manifest.total &&
    manifest.status !== 'uploading'
  ) {
    manifest.status = 'completed';

    manifest.finishedAt = manifest.finishedAt || new Date().toISOString();
  }

  return manifest;
}

export async function createBulkImportBatch({ expectedTotal }) {
  const total = Number(expectedTotal);

  if (!Number.isInteger(total) || total < 1 || total > 5000) {
    throw new Error('Количество файлов должно быть от 1 до 5000');
  }

  const id = `batch-${Date.now()}-${crypto.randomUUID()}`;

  await ensureBulkImportBatchDirectories(id);

  const manifest = {
    id,

    createdAt: new Date().toISOString(),

    updatedAt: new Date().toISOString(),

    startedAt: null,
    finishedAt: null,

    status: 'uploading',

    expectedTotal: total,

    total: 0,
    waiting: 0,
    processing: 0,
    completed: 0,
    failed: 0,

    created: 0,
    duplicates: 0,
    updatedVersions: 0,

    files: [],
  };

  await writeManifest(id, manifest);

  return manifest;
}

export async function getBulkImportBatch(id) {
  return readManifest(id);
}

export async function registerBulkImportFiles(id, uploadedFiles = []) {
  return withManifestLock(id, async () => {
    const manifest = await readManifest(id);

    if (!manifest) {
      throw new Error('Пакетный импорт не найден');
    }

    if (manifest.status !== 'uploading') {
      throw new Error('Добавлять файлы после запуска импорта нельзя');
    }

    if (manifest.files.length + uploadedFiles.length > manifest.expectedTotal) {
      throw new Error('Получено больше файлов, чем заявлено при создании импорта');
    }

    for (const file of uploadedFiles) {
      manifest.files.push({
        id: file.bulkImportFileId,

        name: normalizeUploadedFilename(file.originalname),

        storedName: file.filename,

        mimetype: file.mimetype || 'application/octet-stream',

        size: Number(file.size) || 0,

        status: 'waiting',

        action: null,
        instructionId: null,
        error: null,

        uploadedAt: new Date().toISOString(),

        startedAt: null,
        finishedAt: null,
      });
    }

    recalculate(manifest);

    return writeManifest(id, manifest);
  });
}

export async function startBulkImportBatch(id) {
  return withManifestLock(id, async () => {
    const manifest = await readManifest(id);

    if (!manifest) {
      return null;
    }

    if (manifest.status !== 'uploading') {
      throw new Error('Импорт уже был запущен');
    }

    if (manifest.total !== manifest.expectedTotal) {
      throw new Error(`Загружено ${manifest.total} из ${manifest.expectedTotal} файлов`);
    }

    manifest.status = 'running';

    manifest.startedAt = new Date().toISOString();

    recalculate(manifest);

    return writeManifest(id, manifest);
  });
}

export async function pauseBulkImportBatch(id) {
  return withManifestLock(id, async () => {
    const manifest = await readManifest(id);

    if (!manifest) {
      return null;
    }

    if (manifest.status === 'completed') {
      return manifest;
    }

    manifest.status = 'paused';

    return writeManifest(id, manifest);
  });
}

export async function resumeBulkImportBatch(id) {
  return withManifestLock(id, async () => {
    const manifest = await readManifest(id);

    if (!manifest) {
      return null;
    }

    if (manifest.status !== 'paused') {
      throw new Error('Возобновить можно только остановленный импорт');
    }

    manifest.status = 'running';

    return writeManifest(id, manifest);
  });
}

export async function updateBulkImportFile(importId, fileId, updates = {}) {
  return withManifestLock(importId, async () => {
    const manifest = await readManifest(importId);

    if (!manifest) {
      return null;
    }

    const file = manifest.files.find(item => item.id === fileId);

    if (!file) {
      return null;
    }

    Object.assign(file, updates);

    recalculate(manifest);

    await writeManifest(importId, manifest);

    return file;
  });
}

export async function getBulkImportProgress(id) {
  const manifest = await readManifest(id);

  if (!manifest) {
    return null;
  }

  recalculate(manifest);

  const terminal = manifest.completed + manifest.failed;

  return {
    id: manifest.id,

    status: manifest.status,

    expectedTotal: manifest.expectedTotal,

    total: manifest.total,

    uploaded: manifest.total,

    waiting: manifest.waiting,

    processing: manifest.processing,

    completed: manifest.completed,

    failed: manifest.failed,

    created: manifest.created,

    duplicates: manifest.duplicates,

    updatedVersions: manifest.updatedVersions,

    progress: manifest.total === 0 ? 0 : Math.round((terminal / manifest.total) * 100),

    createdAt: manifest.createdAt,

    startedAt: manifest.startedAt,

    finishedAt: manifest.finishedAt,
  };
}

export async function getBulkImportFiles(id, { status = null, offset = 0, limit = 100 } = {}) {
  const manifest = await readManifest(id);

  if (!manifest) {
    return null;
  }

  let files = manifest.files;

  if (status) {
    files = files.filter(file => file.status === status);
  }

  const safeOffset = Math.max(0, Number(offset) || 0);

  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));

  return {
    total: files.length,

    offset: safeOffset,

    limit: safeLimit,

    items: files.slice(safeOffset, safeOffset + safeLimit),
  };
}

export async function getRunnableBulkImportBatches() {
  await ensureBulkImportRoot();

  const entries = await fs.readdir(BULK_IMPORT_ROOT, {
    withFileTypes: true,
  });

  const result = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('batch-')) {
      continue;
    }

    const manifest = await readManifest(entry.name);

    if (manifest?.status === 'running') {
      recalculate(manifest);

      result.push(manifest);
    }
  }

  result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return result;
}

export async function listBulkImportBatches() {
  await ensureBulkImportRoot();

  const entries = await fs.readdir(BULK_IMPORT_ROOT, {
    withFileTypes: true,
  });

  const items = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('batch-')) {
      continue;
    }

    const progress = await getBulkImportProgress(entry.name);

    if (progress) {
      items.push(progress);
    }
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return items;
}
