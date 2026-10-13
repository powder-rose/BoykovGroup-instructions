import {
  saveInstructionSnapshot,
  rollbackInstruction,
  getInstructionHistoryInfo,
} from '../services/instructionHistoryService.js';

import {
  bulkImportUpload,
  cleanupBulkUploadFiles,
  BULK_UPLOAD_CHUNK_SIZE,
} from '../middleware/bulkImportUpload.js';

import {
  createBulkImportBatch,
  getBulkImportBatch,
  registerBulkImportFiles,
  startBulkImportBatch,
  pauseBulkImportBatch,
  resumeBulkImportBatch,
  getBulkImportProgress,
  getBulkImportFiles,
  listBulkImportBatches,
} from '../services/bulkImportBatchService.js';

import { ensureBulkImportWorker } from '../services/bulkImportWorkerService.js';
import { Router } from 'express';
import multer from 'multer';

import { addToQueue } from '../services/importQueue.js';

import { processImportFile } from '../services/importWorker.js';

import { saveImportFile } from '../services/importFileStorage.js';

import {
  createImport,
  updateImportFile,
  updateImport,
  getImportProgress,
  getAllImports,
} from '../services/importHistoryService.js';

import { instructionsRepository } from '../services/instructionsRepository.js';

import { searchInstructions } from '../services/searchService.js';

import {
  generateInstructionWithYandexGpt,
  isYandexGptConfigured,
} from '../services/yandexGptService.js';

import { runScheduledGeneration } from '../services/scheduledGenerationService.js';

import { slugify } from '../utils/slug.js';

import { requireAdmin } from '../middleware/auth.js';

import { getGenerationStats } from '../services/generationUsageService.js';

import { runExclusive } from '../services/generationLock.js';

import {
  getAutoGenerationSettings,
  setAutoGenerationEnabled,
} from '../services/autoGenerationSettingsService.js';

export const instructionsRouter = Router();

const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
});

// =========================
// GET ALL
// =========================

instructionsRouter.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';

  const page = Number.parseInt(req.query.page, 10) || 1;

  const pageSize = Number.parseInt(req.query.pageSize, 10) || 6;

  /*
   * INSTRUCTION_SORTING_V3
   */
  const sort = req.query.sort === 'popular' ? 'popular' : 'newest';

  res.json(
    searchInstructions(q, {
      page,
      pageSize,
      sort,
    }),
  );
});

instructionsRouter.get('/imports/:id', requireAdmin, (req, res) => {
  const progress = getImportProgress(req.params.id);

  if (!progress) {
    return res.status(404).json({
      error: 'Импорт не найден',
    });
  }

  res.json(progress);
});

instructionsRouter.get('/imports', requireAdmin, (req, res) => {
  res.json(getAllImports());
});

// =========================
// GENERATION STATS
// =========================

instructionsRouter.get('/generation-stats', requireAdmin, (req, res) => {
  res.json(getGenerationStats());
});

// =========================
// AUTO GENERATION SETTINGS
// =========================

instructionsRouter.get('/auto-generation', requireAdmin, (req, res) => {
  res.json(getAutoGenerationSettings());
});

instructionsRouter.patch('/auto-generation', requireAdmin, (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({
      error: 'Поле enabled должно быть boolean',
    });
  }

  const settings = setAutoGenerationEnabled(req.body.enabled);

  res.json(settings);
});

// =========================
// GET ONE
// =========================

// ============================================================
// BULK IMPORT 1000+ FILES
// ============================================================

instructionsRouter.get('/import-batches', requireAdmin, async (req, res) => {
  res.json(await listBulkImportBatches());
});

instructionsRouter.post('/import-batches', requireAdmin, async (req, res) => {
  try {
    const batch = await createBulkImportBatch({
      expectedTotal: req.body?.total,
    });

    res.status(201).json(await getBulkImportProgress(batch.id));
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

instructionsRouter.post('/import-batches/:id/files', requireAdmin, async (req, res) => {
  const batch = await getBulkImportBatch(req.params.id);

  if (!batch) {
    return res.status(404).json({
      error: 'Пакетный импорт не найден',
    });
  }

  if (batch.status !== 'uploading') {
    return res.status(409).json({
      error: 'Импорт уже запущен',
    });
  }

  bulkImportUpload.array('files', BULK_UPLOAD_CHUNK_SIZE)(req, res, async error => {
    if (error) {
      await cleanupBulkUploadFiles(req.files || []);

      return res.status(400).json({
        error: error.message,
      });
    }

    try {
      if (!req.files?.length) {
        return res.status(400).json({
          error: 'Файлы не переданы',
        });
      }

      await registerBulkImportFiles(req.params.id, req.files);

      return res.status(202).json(await getBulkImportProgress(req.params.id));
    } catch (registerError) {
      await cleanupBulkUploadFiles(req.files || []);

      return res.status(400).json({
        error: registerError.message,
      });
    }
  });
});

instructionsRouter.post('/import-batches/:id/start', requireAdmin, async (req, res) => {
  try {
    const batch = await startBulkImportBatch(req.params.id);

    if (!batch) {
      return res.status(404).json({
        error: 'Пакетный импорт не найден',
      });
    }

    void ensureBulkImportWorker();

    res.status(202).json(await getBulkImportProgress(req.params.id));
  } catch (error) {
    res.status(409).json({
      error: error.message,
    });
  }
});

instructionsRouter.post('/import-batches/:id/stop', requireAdmin, async (req, res) => {
  const batch = await pauseBulkImportBatch(req.params.id);

  if (!batch) {
    return res.status(404).json({
      error: 'Пакетный импорт не найден',
    });
  }

  res.json(await getBulkImportProgress(req.params.id));
});

instructionsRouter.post('/import-batches/:id/resume', requireAdmin, async (req, res) => {
  try {
    const batch = await resumeBulkImportBatch(req.params.id);

    if (!batch) {
      return res.status(404).json({
        error: 'Пакетный импорт не найден',
      });
    }

    void ensureBulkImportWorker();

    res.json(await getBulkImportProgress(req.params.id));
  } catch (error) {
    res.status(409).json({
      error: error.message,
    });
  }
});

instructionsRouter.get('/import-batches/:id', requireAdmin, async (req, res) => {
  const progress = await getBulkImportProgress(req.params.id);

  if (!progress) {
    return res.status(404).json({
      error: 'Пакетный импорт не найден',
    });
  }

  /*
   * Важный механизм восстановления:
   *
   * после Passenger restart следующий
   * polling progress снова запускает worker.
   */
  if (progress.status === 'running') {
    void ensureBulkImportWorker();
  }

  res.json(progress);
});

instructionsRouter.get('/import-batches/:id/files', requireAdmin, async (req, res) => {
  const result = await getBulkImportFiles(req.params.id, {
    status: typeof req.query.status === 'string' ? req.query.status : null,

    offset: req.query.offset,

    limit: req.query.limit,
  });

  if (!result) {
    return res.status(404).json({
      error: 'Пакетный импорт не найден',
    });
  }

  res.json(result);
});

instructionsRouter.get('/:id', (req, res) => {
  const instruction = instructionsRepository.getById(req.params.id);

  if (!instruction) {
    return res.status(404).json({
      error: 'Инструкция не найдена',
    });
  }

  res.json(instruction);
});

// =========================
// GENERATE GPT
// =========================

instructionsRouter.post('/generate', requireAdmin, async (req, res) => {
  const profession = String(req.body?.profession ?? '').trim();

  if (!profession) {
    return res.status(400).json({
      error: 'Не указана профессия',
    });
  }

  if (!isYandexGptConfigured()) {
    return res.status(503).json({
      error: 'YandexGPT не настроен',
    });
  }

  const id = slugify(profession) || `instruction-${Date.now()}`;

  try {
    const instruction = await runExclusive(id, async () => {
      const existing = instructionsRepository.getById(id);

      if (existing) {
        return existing;
      }

      const generated = await generateInstructionWithYandexGpt(profession);

      const built = {
        id,

        title: generated.title,

        profession: generated.profession,

        intro: generated.intro,

        sections: generated.sections,

        source: 'generated',

        generatedBy: 'admin',

        version: '1.0',

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString(),
      };

      instructionsRepository.save(built);

      return built;
    });

    res.status(201).json(instruction);
  } catch (error) {
    console.error(error);

    res.status(502).json({
      error: error.message,
    });
  }
});

// =========================
// UPLOAD MANY FILES
// =========================

instructionsRouter.post(
  '/upload',

  requireAdmin,

  (req, res, next) => {
    upload.array('files', 50)(req, res, error => {
      if (!error) {
        return next();
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'Файл превышает лимит 15 МБ',
        });
      }

      return res.status(400).json({
        error: error.message,
      });
    });
  },

  async (req, res) => {
    const manualContent = String(req.body?.content ?? '').trim();

    if ((!req.files || req.files.length === 0) && !manualContent) {
      return res.status(400).json({
        error: 'Файл или текст не переданы',
      });
    }

    const importTask = createImport(req.files || []);

    updateImport(importTask.id, {
      status: 'waiting',
    });

    try {
      if (req.files?.length) {
        for (let index = 0; index < req.files.length; index++) {
          const file = req.files[index];

          const importFile = importTask.files[index];

          try {
            const savedPath = await saveImportFile(importTask.id, file);

            updateImportFile(importTask.id, importFile.id, {
              path: savedPath,

              status: 'waiting',
            });

            addToQueue(() =>
              processImportFile({
                importId: importTask.id,

                importFile,

                file,
              }),
            );
          } catch (error) {
            updateImportFile(importTask.id, importFile.id, {
              status: 'failed',

              error: error.message,

              finishedAt: new Date().toISOString(),
            });
          }
        }
      }

      // ручной текст
      // оставляем отдельную обработку

      if (manualContent) {
        addToQueue(async () => {
          const fakeFile = {
            buffer: Buffer.from(manualContent, 'utf-8'),

            originalname: 'manual.txt',

            mimetype: 'text/plain',
          };

          const instruction = await processImportFile({
            importId: importTask.id,

            importFile: {
              id: nanoid(),

              status: 'waiting',
            },

            file: fakeFile,
          });

          return instruction;
        });
      }

      res.status(201).json({
        importId: importTask.id,

        total: importTask.total,

        status: 'waiting',

        message: 'Документы добавлены в очередь обработки',
      });
    } catch (error) {
      console.error(error);

      updateImport(importTask.id, {
        status: 'failed',
      });

      res.status(422).json({
        error: error.message,
      });
    }
  },
);

// =========================
// EDIT
// =========================

instructionsRouter.put(
  '/:id',

  requireAdmin,

  (req, res) => {
    const existing = instructionsRepository.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: 'Инструкция не найдена',
      });
    }

    const updated = {
      ...existing,

      ...req.body,

      id: existing.id,

      version: existing.version ? (Number(existing.version) + 0.1).toFixed(1) : '1.1',

      updatedAt: new Date().toISOString(),
    };

    saveInstructionSnapshot(existing);

    instructionsRepository.save(updated);

    res.json(updated);
  },
);

// =========================

// =========================
// INSTRUCTION HISTORY
// =========================

instructionsRouter.get('/:id/history', requireAdmin, (req, res) => {
  const existing = instructionsRepository.getById(req.params.id);

  if (!existing) {
    return res.status(404).json({
      error: 'Инструкция не найдена',
    });
  }

  return res.json(getInstructionHistoryInfo(req.params.id));
});

instructionsRouter.post('/:id/rollback', requireAdmin, (req, res) => {
  try {
    const restored = rollbackInstruction(req.params.id);

    return res.json({
      ok: true,
      instruction: restored,
    });
  } catch (error) {
    if (error?.code === 'INSTRUCTION_NOT_FOUND') {
      return res.status(404).json({
        error: error.message,
      });
    }

    if (error?.code === 'NO_HISTORY') {
      return res.status(409).json({
        error: error.message,
      });
    }

    console.error('Instruction rollback error:', error);

    return res.status(500).json({
      error: 'Не удалось выполнить откат инструкции',
    });
  }
});

// DELETE
// =========================

instructionsRouter.delete(
  '/:id',

  requireAdmin,

  (req, res) => {
    const existing = instructionsRepository.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: 'Инструкция не найдена',
      });
    }

    instructionsRepository.remove(req.params.id);

    res.status(204).end();
  },
);

// =========================
// SCHEDULE GENERATION
// =========================

instructionsRouter.post(
  '/run-scheduled-generation',

  requireAdmin,

  async (req, res) => {
    const result = await runScheduledGeneration({ force: true });

    if (result.status === 'generated') {
      return res.status(201).json(result.instruction);
    }

    if (result.status === 'skipped') {
      return res.status(200).json({
        message: result.reason,
      });
    }

    res.status(502).json({
      error: result.reason,
    });
  },
);
