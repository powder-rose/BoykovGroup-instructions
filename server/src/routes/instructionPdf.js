import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Router } from 'express';

import { instructionsRepository } from '../services/instructionsRepository.js';

import { requirePdfAccess } from '../middleware/pdfAccess.js';

import { createInstructionPdfBuffer } from '../services/instructionPdfService.js';
import { getInstructionPdfCompanyProfile } from '../services/instructionPdfProfile.js';

import { recordInstructionDownload } from '../services/downloadStatsService.js';

export const instructionPdfRouter = Router();

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const PDF_ERROR_LOG = path.resolve(__dirname, '../../data/pdf-download-errors.log');

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
