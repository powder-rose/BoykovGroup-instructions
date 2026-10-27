import { Router } from 'express';
import { getUserById } from '../services/userService.js';
import { normalizePurchaseFormat, walletRepository } from '../services/walletRepository.js';
import { walletPaymentService } from '../services/walletPaymentService.js';
import { downloadQuotaService } from '../services/downloadQuotaService.js';
import { instructionsRepository } from '../services/instructionsRepository.js';
import { toPublicInstruction } from '../services/instructionPublicView.js';
import { createInstructionPdfBuffer } from '../services/instructionPdfService.js';
import {
  createInstructionDocxBuffer,
  DOCX_CONTENT_TYPE,
} from '../services/instructionDocxService.js';
import { getInstructionPdfCompanyProfile } from '../services/instructionPdfProfile.js';
import { recordInstructionDownload } from '../services/downloadStatsService.js';
import { INSTRUCTION_PRICE_MINOR, walletError } from '../services/walletMoney.js';
import { captureFiscalContext } from '../services/fiscalReceiptPayload.js';

export function createWalletRouter({
  userLookup = getUserById,
  store = walletRepository,
  payments = walletPaymentService,
  quotas = downloadQuotaService,
  instructions = instructionsRepository,
  generatePdf = createInstructionPdfBuffer,
  generateDocx = createInstructionDocxBuffer,
  profileLookup = getInstructionPdfCompanyProfile,
  recordDownload = recordInstructionDownload,
} = {}) {
  const router = Router();
  const run = handler => (req, res, next) =>
    Promise.resolve()
      .then(() => handler(req, res))
      .catch(next);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.vary('Authorization');
    try {
      const user =
        req.user?.role === 'user' && typeof req.user.sub === 'string'
          ? userLookup(req.user.sub)
          : null;
      if (!user || user.role !== 'user' || user.id !== req.user.sub)
        return res.status(401).json({ error: 'Войдите в личный кабинет.' });
      req.walletUser = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/',
    run((req, res) => res.json(store.getView(req.walletUser.id))),
  );
  router.get(
    '/checkout',
    run((req, res) => {
      const userId = req.walletUser.id;
      const instructionId = String(req.query.instructionId || '');
      const format = normalizePurchaseFormat(req.query.format);
      const owned = instructionId ? store.findPurchase(userId, instructionId, format) : null;
      const instruction =
        owned?.instruction || (instructionId ? instructions.getById(instructionId) : null);
      if (instructionId && !instruction)
        throw walletError('INSTRUCTION_NOT_FOUND', 'Инструкция не найдена.', 404);
      res.json({
        wallet: store.getView(userId),
        quota: format === 'pdf' ? quotas.get(userId) : null,
        instruction: instruction
          ? { id: instructionId, title: instruction.title, purchaseId: owned?.id || null, format }
          : null,
      });
    }),
  );

  router.post(
    '/topups',
    run((req, res) => {
      if (req.body?.offerAccepted !== true || req.body?.personalDataConsentAccepted !== true)
        throw walletError(
          'CONSENT_REQUIRED',
          'Примите условия оферты и согласие на обработку персональных данных.',
          422,
        );
      const publicId = String(process.env.CLOUDPAYMENTS_PUBLIC_ID || '').trim();
      if (!publicId || !process.env.CLOUDPAYMENTS_API_SECRET)
        throw walletError(
          'PAYMENT_UNAVAILABLE',
          'Пополнение временно недоступно. Попробуйте позже.',
          503,
        );
      const order = store.createTopup({
        userId: req.walletUser.id,
        amountMinor: req.body.amountMinor,
        requestId: req.body.requestId,
        publicId,
        consent: {
          offerAccepted: true,
          personalDataConsentAccepted: true,
          acceptedAt: new Date().toISOString(),
          offerUrl: 'https://boykovdocs.ru/offer/',
          personalDataConsentUrl: 'https://boykovdocs.ru/personal-data-consent/',
          ip: req.ip,
          userAgent: String(req.get('user-agent') || '').slice(0, 1000),
        },
        fiscalContext: captureFiscalContext(req.walletUser),
      });
      res.status(201).json({
        ...store.getOrderView(req.walletUser.id, order.id),
        publicTerminalId: order.publicId,
        userInfo: {
          accountId: req.walletUser.id,
          email: req.walletUser.email,
          phone: req.walletUser.phone,
          fullName: req.walletUser.name,
        },
      });
    }),
  );
  router.post(
    '/topups/:id/confirm',
    run(async (req, res) => {
      res.json({
        topup: await payments.confirm(req.walletUser.id, req.params.id, req.body?.transactionId),
        wallet: store.getView(req.walletUser.id),
      });
    }),
  );

  async function prepareDocument(req, instruction, format) {
    const generate = format === 'docx' ? generateDocx : generatePdf;
    const buffer = await generate(instruction, { companyProfile: profileLookup(req.user) });
    const valid =
      Buffer.isBuffer(buffer) &&
      buffer.length >= 1000 &&
      (format === 'docx'
        ? buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
          buffer.includes(Buffer.from('word/document.xml')) &&
          buffer.includes(Buffer.from('[Content_Types].xml'))
        : buffer.subarray(0, 4).toString() === '%PDF');
    if (!valid)
      throw walletError(
        format === 'docx' ? 'DOCX_UNAVAILABLE' : 'PDF_UNAVAILABLE',
        `Не удалось сформировать ${format === 'docx' ? 'Word' : 'PDF'}. Попробуйте ещё раз.`,
        503,
      );
    return buffer;
  }

  router.post(
    '/purchases',
    run(async (req, res) => {
      if (req.body?.priceMinor !== INSTRUCTION_PRICE_MINOR)
        throw walletError('PRICE_CONFIRMATION_REQUIRED', 'Подтвердите покупку за 50 ₽.');
      const format = normalizePurchaseFormat(req.body?.format);
      if (format === 'docx' && req.body?.confirmed !== true)
        throw walletError('PURCHASE_CONFIRMATION_REQUIRED', 'Подтвердите покупку Word за 50 ₽.');
      const instructionId =
        typeof req.body.instructionId === 'string' ? req.body.instructionId : '';
      const existing = store.findPurchase(req.walletUser.id, instructionId, format);
      if (existing)
        return res.json({ purchaseId: existing.id, wallet: store.getView(req.walletUser.id) });
      if (format === 'pdf' && quotas.get(req.walletUser.id).remaining > 0)
        throw walletError(
          'FREE_DOWNLOADS_AVAILABLE',
          'У вас ещё есть бесплатные скачивания. Откройте инструкцию и скачайте PDF бесплатно.',
          409,
        );
      const instruction = instructions.getById(instructionId);
      if (!instruction) throw walletError('INSTRUCTION_NOT_FOUND', 'Инструкция не найдена.', 404);
      const snapshot = toPublicInstruction(instruction);
      const fiscalContext = captureFiscalContext(req.walletUser);
      if (store.getView(req.walletUser.id).balanceMinor < INSTRUCTION_PRICE_MINOR)
        throw walletError('INSUFFICIENT_BALANCE', 'Для покупки нужно 50 ₽ на балансе.', 409);
      // Expensive work stays outside the short file transaction. A broken PDF cannot spend money.
      await prepareDocument(req, snapshot, format);
      if (res.destroyed) return;
      const purchase = store.purchase({
        userId: req.walletUser.id,
        instructionId,
        instruction: snapshot,
        format,
        fiscalContext,
      });
      res.json({ purchaseId: purchase.id, wallet: store.getView(req.walletUser.id) });
    }),
  );
  router.get(
    '/purchases/:id/:format(pdf|docx)',
    run(async (req, res) => {
      const purchase = store.getPurchase(req.walletUser.id, req.params.id);
      const format = req.params.format;
      if (!purchase || (purchase.format ?? 'pdf') !== format)
        throw walletError('PURCHASE_NOT_FOUND', 'Покупка не найдена.', 404);
      const contentType = format === 'docx' ? DOCX_CONTENT_TYPE : 'application/pdf';
      if (req.method === 'HEAD') return res.type(contentType).end();
      const document = await prepareDocument(req, purchase.instruction, format);
      delete req.headers['if-none-match'];
      delete req.headers['if-modified-since'];
      res.set('Content-Disposition', `attachment; filename="instruction.${format}"`);
      res.set('X-Content-Type-Options', 'nosniff');
      res.once('finish', () => {
        if (
          res.statusCode !== 200 ||
          !String(res.getHeader('content-type') || '').includes(contentType)
        )
          return;
        try {
          recordDownload({
            instructionId: purchase.instructionId,
            title: purchase.title,
            userId: req.walletUser.id,
            kind: 'paid',
          });
        } catch (error) {
          console.error('Paid instruction download stats error:', error);
        }
      });
      res.type(contentType).send(document);
    }),
  );
  router.use((error, _req, res, _next) => {
    console.error('[Wallet]', error.code || 'WALLET_UNAVAILABLE');
    const known = Number.isInteger(error.status) && error.status >= 400 && error.status < 600;
    res.status(known ? error.status : 503).json({
      code: known ? error.code : 'WALLET_UNAVAILABLE',
      error: known ? error.message : 'Не удалось обновить баланс. Попробуйте позже.',
    });
  });
  return router;
}

export const walletRouter = createWalletRouter();
