import { Router } from 'express';
import { getFailedImportFiles } from '../services/importHistoryService.js';
import { getAllImports, getImport, getImportProgress } from '../services/importHistoryService.js';

import { requireAdmin } from '../middleware/auth.js';
import { retryFailedImport } from '../services/retryImportService.js';

export const importsRouter = Router();

// список всех импортов

importsRouter.get('/', requireAdmin, (req, res) => {
  res.json(getAllImports());
});

// один импорт подробно

importsRouter.get('/:id', requireAdmin, (req, res) => {
  const item = getImport(req.params.id);

  if (!item) {
    return res.status(404).json({
      error: 'Импорт не найден',
    });
  }

  res.json(item);
});

// только прогресс

importsRouter.get('/:id/progress', requireAdmin, (req, res) => {
  const progress = getImportProgress(req.params.id);

  if (!progress) {
    return res.status(404).json({
      error: 'Импорт не найден',
    });
  }

  res.json(progress);
});

importsRouter.post('/:id/retry', requireAdmin, async (req, res) => {
  const failedFiles = getFailedImportFiles(req.params.id);

  if (!failedFiles.length) {
    return res.status(400).json({
      error: 'Нет файлов для повторной обработки',
    });
  }

  failedFiles.forEach(file => {
    importsRouter.post('/:id/retry', requireAdmin, async (req, res) => {
      try {
        await retryFailedImport(req.params.id);

        res.json({
          message: 'Повторная обработка завершена',
        });
      } catch (error) {
        res.status(400).json({
          error: error.message,
        });
      }
    });
  });

  res.json({
    message: 'Файлы поставлены на повторную обработку',

    count: failedFiles.length,
  });
});
