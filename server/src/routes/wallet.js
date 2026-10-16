import { Router } from 'express';
import { getUserById } from '../services/userService.js';
import { walletRepository } from '../services/walletRepository.js';
import { walletPaymentService } from '../services/walletPaymentService.js';
import { downloadQuotaService } from '../services/downloadQuotaService.js';
import { instructionsRepository } from '../services/instructionsRepository.js';
import { toPublicInstruction } from '../services/instructionPublicView.js';
import { createInstructionPdfBuffer } from '../services/instructionPdfService.js';
import { getInstructionPdfCompanyProfile } from '../services/instructionPdfProfile.js';
import { INSTRUCTION_PRICE_MINOR, walletError } from '../services/walletMoney.js';

export function createWalletRouter({
  userLookup = getUserById,
  store = walletRepository,
  payments = walletPaymentService,
  quotas = downloadQuotaService,
  instructions = instructionsRepository,
  generatePdf = createInstructionPdfBuffer,
  profileLookup = getInstructionPdfCompanyProfile,
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
      const owned = instructionId ? store.findPurchase(userId, instructionId) : null;
      const instruction =
        owned?.instruction || (instructionId ? instructions.getById(instructionId) : null);
      if (instructionId && !instruction)
        throw walletError('INSTRUCTION_NOT_FOUND', 'Инструкция не найдена.', 404);
      res.json({
        wallet: store.getView(userId),
        quota: quotas.get(userId),
        instruction: instruction
          ? { id: instructionId, title: instruction.title, purchaseId: owned?.id || null }
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

  async function preparePdf(req, instruction) {
    const pdf = await generatePdf(instruction, { companyProfile: profileLookup(req.user) });
    if (!Buffer.isBuffer(pdf) || pdf.length < 1000 || pdf.subarray(0, 4).toString() !== '%PDF')
      throw walletError('PDF_UNAVAILABLE', 'Не удалось сформировать PDF. Попробуйте ещё раз.', 503);
    return pdf;
  }

  router.post(
    '/purchases',
    run(async (req, res) => {
      if (req.body?.priceMinor !== INSTRUCTION_PRICE_MINOR)
        throw walletError('PRICE_CONFIRMATION_REQUIRED', 'Подтвердите покупку за 50 ₽.');
      const instructionId =
        typeof req.body.instructionId === 'string' ? req.body.instructionId : '';
      const existing = store.findPurchase(req.walletUser.id, instructionId);
      if (existing)
        return res.json({ purchaseId: existing.id, wallet: store.getView(req.walletUser.id) });
      if (quotas.get(req.walletUser.id).remaining > 0)
        throw walletError(
          'FREE_DOWNLOADS_AVAILABLE',
          'У вас ещё есть бесплатные скачивания. Откройте инструкцию и скачайте PDF бесплатно.',
          409,
        );
      const instruction = instructions.getById(instructionId);
      if (!instruction) throw walletError('INSTRUCTION_NOT_FOUND', 'Инструкция не найдена.', 404);
      const snapshot = toPublicInstruction(instruction);
      if (store.getView(req.walletUser.id).balanceMinor < INSTRUCTION_PRICE_MINOR)
        throw walletError('INSUFFICIENT_BALANCE', 'Для покупки нужно 50 ₽ на балансе.', 409);
      // Expensive work stays outside the short file transaction. A broken PDF cannot spend money.
      await preparePdf(req, snapshot);
      if (res.destroyed) return;
      const purchase = store.purchase({
        userId: req.walletUser.id,
        instructionId,
        instruction: snapshot,
      });
      res.json({ purchaseId: purchase.id, wallet: store.getView(req.walletUser.id) });
    }),
  );
  router.get(
    '/purchases/:id/pdf',
    run(async (req, res) => {
      const purchase = store.getPurchase(req.walletUser.id, req.params.id);
      if (!purchase) throw walletError('PURCHASE_NOT_FOUND', 'Покупка не найдена.', 404);
      if (req.method === 'HEAD') return res.type('application/pdf').end();
      const pdf = await preparePdf(req, purchase.instruction);
      delete req.headers['if-none-match'];
      delete req.headers['if-modified-since'];
      res.set('Content-Disposition', 'attachment; filename="instruction.pdf"');
      res.set('X-Content-Type-Options', 'nosniff');
      res.type('application/pdf').send(pdf);
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
