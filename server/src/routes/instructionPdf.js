import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Router } from 'express';

import { instructionsRepository } from '../services/instructionsRepository.js';

import { requirePdfAccess } from '../middleware/pdfAccess.js';

import { createInstructionPdfBuffer } from '../services/instructionPdfService.js';
import { getInstructionPdfCompanyProfile } from '../services/instructionPdfProfile.js';

import { recordInstructionDownload } from '../services/downloadStatsService.js';
import { downloadQuotaService } from '../services/downloadQuotaService.js';
import { walletRepository } from '../services/walletRepository.js';

export const instructionPdfRouter = Router();

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const PDF_ERROR_LOG = path.resolve(__dirname, '../../data/pdf-download-errors.log');

function sendDownloadLimit(res, quota) {
  return res.status(403).json({
    code: 'DOWNLOAD_LIMIT_REACHED',
    error:
      'Доступные скачивания из каталога закончились. Оплаченные инструкции доступны в личном кабинете.',
    limit: quota.limit,
    used: quota.used,
    remaining: quota.remaining,
  });
}

instructionPdfRouter.get('/download-quota', requirePdfAccess, (req, res) => {
  if (req.user.role === 'admin') return res.json({ unlimited: true });

  try {
    const quota = downloadQuotaService.get(req.user.sub);
    if (typeof req.query.instructionId === 'string' && req.query.instructionId) {
      const purchase = walletRepository.findPurchase(req.user.sub, req.query.instructionId);
      return res.json({ ...quota, purchaseId: purchase?.id || null });
    }
    return res.json(quota);
  } catch (error) {
    console.error('Download quota lookup error:', error);
    return res.status(503).json({
      code: 'DOWNLOAD_QUOTA_UNAVAILABLE',
      error: 'Не удалось проверить остаток скачиваний. Попробуйте позже.',
    });
  }
});

function writePdfError({ error, stage, instructionId, user }) {
  try {
    fs.mkdirSync(path.dirname(PDF_ERROR_LOG), {
      recursive: true,
    });

    const entry = [
      '',
      '========================================',
      new Date().toISOString(),
      `stage: ${stage}`,
      `instruction: ${instructionId}`,
      `role: ${user?.role ?? ''}`,
      `sub: ${user?.sub ?? ''}`,
      `name: ${error?.name ?? ''}`,
      `code: ${error?.code ?? ''}`,
      `message: ${error?.message ?? error}`,
      'stack:',
      String(error?.stack ?? error ?? ''),
      '========================================',
      '',
    ].join('\n');

    fs.appendFileSync(PDF_ERROR_LOG, entry, 'utf8');
  } catch {
    /*
     * Ошибка диагностического лога
     * не должна ломать HTTP-ответ.
     */
  }
}

instructionPdfRouter.get(
  '/:id/pdf',

  requirePdfAccess,

  async (req, res) => {
    /*
     * ======================================================
     * INSTRUCTION
     * ======================================================
     */

    const instruction = instructionsRepository.getById(req.params.id);

    if (!instruction) {
      return res.status(404).json({
        error: 'Инструкция не найдена',
      });
    }

    // Express also routes HEAD through GET. Metadata requests never spend a download.
    if (req.method === 'HEAD') {
      return res.type('application/pdf').end();
    }

    /*
     * ======================================================
     * PDF
     * ======================================================
     */

    /*
     * PDF_DOWNLOAD_STATS_V1
     *
     * Фиксируем только успешно
     * отправленный PDF обычному
     * пользователю.
     *
     * Администраторские скачивания
     * не считаются.
     */
    if (req.user?.role === 'user') {
      const downloadMeta = {
        instructionId: instruction.id ?? instruction._id ?? req.params.id,

        title: instruction.title,

        userId: req.user.sub,
      };

      res.once('finish', () => {
        const contentType = String(res.getHeader('content-type') ?? '').toLowerCase();

        if (
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          contentType.includes('application/pdf')
        ) {
          try {
            recordInstructionDownload(downloadMeta);
          } catch (error) {
            console.error('PDF download stats error:', error);
          }
        }
      });
    }

    let stage = 'before-generation';

    try {
      if (req.user.role === 'user') {
        stage = 'check-download-quota';
        const quota = downloadQuotaService.get(req.user.sub);
        if (quota.remaining === 0) return sendDownloadLimit(res, quota);
      }

      stage = 'generate-pdf';

      const pdf = await createInstructionPdfBuffer(instruction, {
        companyProfile: getInstructionPdfCompanyProfile(req.user),
      });

      stage = 'validate-buffer';

      if (!Buffer.isBuffer(pdf)) {
        throw new Error('PDF generator returned non-Buffer value');
      }

      if (pdf.length < 1000) {
        throw new Error(`PDF buffer is too small: ${pdf.length}`);
      }

      if (pdf.subarray(0, 4).toString() !== '%PDF') {
        throw new Error('Generated buffer does not contain PDF header');
      }

      if (res.destroyed) return;

      if (req.user.role === 'user') {
        stage = 'consume-download-quota';
        // Persist the final atomic check before delivery; concurrent PDF generation
        // cannot let multiple requests spend the last remaining download.
        const quota = downloadQuotaService.consume(req.user.sub);
        if (!quota.allowed) return sendDownloadLimit(res, quota);
        res.set('X-Download-Limit', String(quota.limit));
        res.set('X-Download-Remaining', String(quota.remaining));
        res.append('Access-Control-Expose-Headers', 'X-Download-Limit, X-Download-Remaining');
      }

      /*
       * ====================================================
       * HTTP RESPONSE
       *
       * ВАЖНО:
       *
       * Не устанавливаем Content-Length вручную.
       * Не вставляем кириллицу / RFC5987 filename*=...
       * в Content-Disposition.
       *
       * Express сам корректно рассчитает Content-Length
       * для Buffer.
       * ====================================================
       */

      stage = 'set-response-headers';

      res.status(200);

      res.set('Content-Type', 'application/pdf');

      res.set('Content-Disposition', 'attachment; filename="instruction.pdf"');

      res.set('Cache-Control', 'private, no-store, max-age=0');

      res.set('X-Content-Type-Options', 'nosniff');

      stage = 'send-buffer';

      // A counted attachment must be sent in full, never converted by Express
      // into an empty 304 response based on a previous PDF's cache validators.
      delete req.headers['if-none-match'];
      delete req.headers['if-modified-since'];

      return res.send(pdf);
    } catch (error) {
      writePdfError({
        error,
        stage,
        instructionId: req.params.id,
        user: req.user,
      });

      console.error('Instruction PDF error:', {
        stage,
        instructionId: req.params.id,
        error,
      });

      /*
       * Если заголовки ещё не отправлены —
       * возвращаем нормальный JSON.
       */

      if (!res.headersSent) {
        if (stage === 'check-download-quota' || stage === 'consume-download-quota') {
          return res.status(503).json({
            code: 'DOWNLOAD_QUOTA_UNAVAILABLE',
            error: 'Не удалось проверить лимит скачиваний. Попробуйте позже.',
          });
        }

        return res.status(500).json({
          error: 'Не удалось сформировать PDF',
        });
      }

      /*
       * Если ошибка произошла уже во время
       * отправки ответа — просто завершаем.
       */

      return res.end();
    }
  },
);
