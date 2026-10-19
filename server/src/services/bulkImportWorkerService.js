import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { processInstructionFile } from './instructionProcessingService.js';

import { instructionsRepository } from './instructionsRepository.js';
import { saveInstructionWithTaxonomy } from './instructionTaxonomyPersistence.js';

import { createNewVersion } from './instructionVersionService.js';

import {
  getRunnableBulkImportBatches,
  updateBulkImportFile,
  listBulkImportBatches,
  getBulkImportBatch,
} from './bulkImportBatchService.js';

import {
  BULK_IMPORT_ROOT,
  ensureBulkImportRoot,
  readBulkImportStoredFile,
  moveBulkImportStoredFile,
  deleteBulkImportStoredFile,
  bulkImportStoredFileExists,
} from './bulkImportStorageService.js';

const CONCURRENCY = Math.min(
  2,
  Math.max(1, Number.parseInt(process.env.BULK_IMPORT_CONCURRENCY || '1', 10) || 1),
);

const WORKER_LOCK = path.join(BULK_IMPORT_ROOT, '.worker-lock');

const WORKER_OWNER = path.join(WORKER_LOCK, 'owner.json');

const WORKER_LOCK_TTL_MS = 30_000;

const IDLE_ROUNDS_BEFORE_EXIT = 5;

let workerPromise = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function acquireWorkerLock() {
  await ensureBulkImportRoot();

  try {
    await fs.mkdir(WORKER_LOCK);
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }

    let stat;

    try {
      stat = await fs.stat(WORKER_OWNER);
    } catch {
      try {
        stat = await fs.stat(WORKER_LOCK);
      } catch {
        return false;
      }
    }

    if (Date.now() - stat.mtimeMs <= WORKER_LOCK_TTL_MS) {
      return false;
    }

    const stale = `${WORKER_LOCK}.stale-${process.pid}-${Date.now()}`;

    try {
      await fs.rename(WORKER_LOCK, stale);

      await fs.rm(stale, {
        recursive: true,
        force: true,
      });
    } catch {
      return false;
    }

    try {
      await fs.mkdir(WORKER_LOCK);
    } catch {
      return false;
    }
  }

  await fs.writeFile(
    WORKER_OWNER,
    JSON.stringify(
      {
        pid: process.pid,

        owner: crypto.randomUUID(),

        acquiredAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  return true;
}

async function releaseWorkerLock() {
  await fs.rm(WORKER_LOCK, {
    recursive: true,
    force: true,
  });
}

function startHeartbeat() {
  return setInterval(async () => {
    try {
      const now = new Date();

      await fs.utimes(WORKER_OWNER, now, now);
    } catch {
      // lock мог быть снят при завершении процесса
    }
  }, 5000);
}

async function recoverAbandonedFiles() {
  const batches = await listBulkImportBatches();

  for (const summary of batches) {
    const batch = await getBulkImportBatch(summary.id);

    if (!batch) {
      continue;
    }

    for (const file of batch.files) {
      const inProcessing = await bulkImportStoredFileExists(
        batch.id,
        'processing',
        file.storedName,
      );

      if (!inProcessing) {
        continue;
      }

      /*
       * Успешная обработка успела записаться,
       * но staging-файл не удалился.
       */
      if (file.status === 'completed') {
        await deleteBulkImportStoredFile(batch.id, 'processing', file.storedName);

        continue;
      }

      /*
       * Ошибка уже записана,
       * но файл не успел переехать в failed.
       */
      if (file.status === 'failed') {
        try {
          await moveBulkImportStoredFile(batch.id, file.storedName, 'processing', 'failed');
        } catch {
          // не мешаем восстановлению остальных
        }

        continue;
      }

      /*
       * Passenger умер во время обработки.
       * Возвращаем файл в pending.
       */
      try {
        await moveBulkImportStoredFile(batch.id, file.storedName, 'processing', 'pending');

        await updateBulkImportFile(batch.id, file.id, {
          status: 'waiting',

          startedAt: null,

          error: null,
        });
      } catch (error) {
        console.error('[BulkImport] recovery error:', batch.id, file.name, error.message);
      }
    }
  }
}

async function claimNextFile() {
  const batches = await getRunnableBulkImportBatches();

  for (const batch of batches) {
    const waiting = batch.files.filter(file => file.status === 'waiting');

    for (const file of waiting) {
      try {
        await moveBulkImportStoredFile(batch.id, file.storedName, 'pending', 'processing');
      } catch (error) {
        if (error?.code === 'ENOENT') {
          continue;
        }

        throw error;
      }

      await updateBulkImportFile(batch.id, file.id, {
        status: 'processing',

        startedAt: new Date().toISOString(),

        error: null,
      });

      return {
        batchId: batch.id,

        file,
      };
    }
  }

  return null;
}

async function saveProcessedInstruction(result) {
  switch (result.action) {
    case 'new':
      return saveInstructionWithTaxonomy(instructionsRepository, result.instruction);

    case 'duplicate':
      return result.instruction;

    case 'new_version': {
      const versioned = createNewVersion(result.previous, result.instruction);

      return saveInstructionWithTaxonomy(instructionsRepository, versioned);
    }

    default:
      throw new Error(`Неизвестное действие импорта: ${result.action}`);
  }
}

async function processClaim(claim) {
  const { batchId, file } = claim;

  try {
    const buffer = await readBulkImportStoredFile(batchId, 'processing', file.storedName);

    const result = await processInstructionFile({
      buffer,

      filename: file.name,

      mimetype: file.mimetype,

      source: 'uploaded',
    });

    /*
     * Сохраняем происхождение новой импортированной
     * инструкции непосредственно в её JSON.
     *
     * Для duplicate существующий документ не изменяем.
     */
    if (result?.action === 'new' && result?.instruction && typeof result.instruction === 'object') {
      result.instruction.originalFilename = file.name;

      result.instruction.importBatchId = batchId;

      result.instruction.importFileId = file.id;
    }

    const instruction = await saveProcessedInstruction(result);

    await updateBulkImportFile(batchId, file.id, {
      status: 'completed',

      action: result.action,

      instructionId: instruction?.id || null,

      error: null,

      finishedAt: new Date().toISOString(),
    });

    /*
     * Успешный исходный staging-файл
     * больше не нужен.
     *
     * Это важно для 1000+ DOCX:
     * не удваиваем дисковое место.
     */
    await deleteBulkImportStoredFile(batchId, 'processing', file.storedName);
  } catch (error) {
    await updateBulkImportFile(batchId, file.id, {
      status: 'failed',

      error: String(error?.message || error),

      finishedAt: new Date().toISOString(),
    });

    try {
      await moveBulkImportStoredFile(batchId, file.storedName, 'processing', 'failed');
    } catch {
      // статус ошибки уже сохранён
    }

    console.error('[BulkImport] file failed:', file.name, error);
  }
}

async function runWorker() {
  const acquired = await acquireWorkerLock();

  if (!acquired) {
    return;
  }

  const heartbeat = startHeartbeat();

  let idleRounds = 0;

  try {
    console.log(`[BulkImport] worker started, concurrency=${CONCURRENCY}`);

    await recoverAbandonedFiles();

    while (idleRounds < IDLE_ROUNDS_BEFORE_EXIT) {
      const claims = [];

      for (let index = 0; index < CONCURRENCY; index++) {
        const claim = await claimNextFile();

        if (!claim) {
          break;
        }

        claims.push(claim);
      }

      if (claims.length === 0) {
        idleRounds++;

        await sleep(500);

        continue;
      }

      idleRounds = 0;

      await Promise.all(claims.map(processClaim));
    }
  } finally {
    clearInterval(heartbeat);

    await releaseWorkerLock();

    console.log('[BulkImport] worker stopped');
  }
}

export async function ensureBulkImportWorker() {
  if (workerPromise) {
    return false;
  }

  workerPromise = runWorker()
    .catch(error => {
      console.error('[BulkImport] worker fatal error:', error);
    })
    .finally(() => {
      workerPromise = null;
    });

  return true;
}

export async function waitForBulkImportWorker() {
  if (!workerPromise) {
    return;
  }

  await workerPromise;
}
