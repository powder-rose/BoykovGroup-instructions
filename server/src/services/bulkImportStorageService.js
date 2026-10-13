import fs from 'node:fs/promises';
import path from 'node:path';

export const BULK_IMPORT_ROOT = path.resolve('uploads/import-batches');

const STATUS_DIRS = ['pending', 'processing', 'failed'];

export function assertBulkImportId(id) {
  const value = String(id ?? '');

  if (!/^batch-[a-zA-Z0-9-]+$/u.test(value)) {
    throw new Error('Некорректный ID пакетного импорта');
  }

  return value;
}

export function getBulkImportBatchDir(id) {
  return path.join(BULK_IMPORT_ROOT, assertBulkImportId(id));
}

export function getBulkImportStatusDir(id, status) {
  if (!STATUS_DIRS.includes(status)) {
    throw new Error(`Некорректный статус каталога: ${status}`);
  }

  return path.join(getBulkImportBatchDir(id), status);
}

export function getBulkImportStoredPath(id, status, storedName) {
  const name = path.basename(String(storedName ?? ''));

  if (!name) {
    throw new Error('Не указано имя файла очереди');
  }

  return path.join(getBulkImportStatusDir(id, status), name);
}

export async function ensureBulkImportRoot() {
  await fs.mkdir(BULK_IMPORT_ROOT, {
    recursive: true,
  });
}

export async function ensureBulkImportBatchDirectories(id) {
  await ensureBulkImportRoot();

  const batchDir = getBulkImportBatchDir(id);

  await fs.mkdir(batchDir, {
    recursive: true,
  });

  for (const status of STATUS_DIRS) {
    await fs.mkdir(getBulkImportStatusDir(id, status), {
      recursive: true,
    });
  }

  return batchDir;
}

export async function readBulkImportStoredFile(id, status, storedName) {
  return fs.readFile(getBulkImportStoredPath(id, status, storedName));
}

export async function moveBulkImportStoredFile(id, storedName, fromStatus, toStatus) {
  const source = getBulkImportStoredPath(id, fromStatus, storedName);

  const destination = getBulkImportStoredPath(id, toStatus, storedName);

  await fs.mkdir(getBulkImportStatusDir(id, toStatus), {
    recursive: true,
  });

  await fs.rename(source, destination);

  return destination;
}

export async function deleteBulkImportStoredFile(id, status, storedName) {
  try {
    await fs.unlink(getBulkImportStoredPath(id, status, storedName));

    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

export async function bulkImportStoredFileExists(id, status, storedName) {
  try {
    await fs.access(getBulkImportStoredPath(id, status, storedName));

    return true;
  } catch {
    return false;
  }
}
