import express, { Router } from 'express';

import {
  verifyCloudPaymentsHmac as verifyHmac,
  parseCloudPaymentsNotification as parsePayload,
} from '../utils/cloudPaymentsNotification.js';

import {
  getPublicGenerationOrder,
  updatePublicGenerationOrder,
  findPublicGenerationOrderByTransactionId,
} from '../services/publicGenerationOrderService.js';

import { moderateProfessionRequest } from '../services/contentModerationService.js';

import { queuePublicGenerationOrder } from '../services/publicPaidGenerationService.js';

import { instructionsRepository } from '../services/instructionsRepository.js';

import { normalizeProfessionKey } from '../services/professionNormalizer.js';

import { isPromoCodeReservationActive, markPromoCodeUsed } from '../services/promoCodeService.js';

export const cloudPaymentsWebhookRouter = Router();

cloudPaymentsWebhookRouter.use(
  express.raw({
    type: '*/*',

    limit: '100kb',
  }),
);

function amountIsCorrect(value, expected) {
  const amount = Number(value);

  return Number.isFinite(amount) && Math.abs(amount - expected) < 0.0001;
}

function existingInstruction(profession) {
  if (typeof instructionsRepository.findByProfessionKey !== 'function') {
    return null;
  }

  const key = normalizeProfessionKey(profession);

  if (!key) {
    return null;
  }

  return instructionsRepository.findByProfessionKey(key) || null;
}

function isExpired(order) {
  const timestamp = Date.parse(order?.expiresAt ?? '');

  return !Number.isFinite(timestamp) || timestamp < Date.now();
}

/*
 * ============================================================
 * CHECK
 * ============================================================
 */
cloudPaymentsWebhookRouter.post(
  '/check',

  (req, res) => {
    if (!verifyHmac(req)) {
      console.warn('[CloudPayments Check] invalid HMAC');

      return res.status(403).json({
        code: 13,
      });
    }

    let data;

    try {
      data = parsePayload(req);
    } catch {
      return res.json({
        code: 13,
      });
    }

    const orderId = String(data.InvoiceId ?? '');

    const order = getPublicGenerationOrder(orderId);

    if (!order) {
      return res.json({
        code: 10,
      });
    }

    if (isExpired(order)) {
      return res.json({
        code: 20,
      });
    }

    if (order.status !== 'pending_payment') {
      return res.json({
        code: 13,
      });
    }

    if (
      order.promo?.id &&
      order.promo?.reservationId &&
      !isPromoCodeReservationActive(order.promo.id, order.promo.reservationId)
    ) {
      return res.json({
        code: 13,
      });
    }

    if (!amountIsCorrect(data.Amount, order.amount)) {
      return res.json({
        code: 12,
      });
    }

    if (String(data.Currency ?? '').toUpperCase() !== order.currency) {
      return res.json({
        code: 13,
      });
    }

    const moderation = moderateProfessionRequest(order.profession);

    if (!moderation.allowed) {
      return res.json({
        code: 13,
      });
    }

    /*
     * За время между созданием заказа и оплатой
     * инструкция могла появиться в каталоге.
     *
     * В этом случае денег не берём.
     */
    if (existingInstruction(order.profession)) {
      return res.json({
        code: 13,
      });
    }

    return res.json({
      code: 0,
    });
  },
);

/*
 * ============================================================
 * PAY
 * ============================================================
 */
cloudPaymentsWebhookRouter.post(
  '/pay',

  (req, res) => {
    if (!verifyHmac(req)) {
      console.warn('[CloudPayments Pay] invalid HMAC');

      return res.status(403).json({
        code: 13,
      });
    }

    let data;

    try {
      data = parsePayload(req);
    } catch {
      return res.status(400).json({
        code: 13,
      });
    }

    const orderId = String(data.InvoiceId ?? '');

    const transactionId = String(data.TransactionId ?? '');

    const order = getPublicGenerationOrder(orderId);

    /*
     * Pay уже означает состоявшийся платеж.
     * Если заказ неизвестен — не запускаем
     * генерацию, но останавливаем бесконечные
     * повторы webhook.
     */
    if (!order) {
      console.error('[CloudPayments Pay] unknown order:', orderId);

      return res.json({
        code: 0,
      });
    }

    /*
     * Проверяем повторное использование
     * TransactionId.
     */
    const transactionOrder = findPublicGenerationOrderByTransactionId(transactionId);

    if (transactionOrder && transactionOrder.id !== order.id) {
      updatePublicGenerationOrder(order.id, {
        status: 'manual_review',

        failureCode: 'DUPLICATE_TRANSACTION',
      });

      return res.json({
        code: 0,
      });
    }

    /*
     * Идемпотентный повтор Pay webhook.
     */
    if (order.transactionId && String(order.transactionId) === transactionId) {
      if (order.status === 'paid' || order.status === 'generating') {
        queuePublicGenerationOrder(order.id);
      }

      return res.json({
        code: 0,
      });
    }

    /*
     * Сумма и валюта контролируются
     * сервером повторно и после Pay.
     */
    const paymentValid =
      amountIsCorrect(data.Amount, order.amount) &&
      String(data.Currency ?? '').toUpperCase() === order.currency &&
      String(data.OperationType ?? 'Payment') === 'Payment' &&
      String(data.Status ?? 'Completed') === 'Completed';

    if (!paymentValid) {
      console.error('[CloudPayments Pay] payment mismatch:', order.id);

      updatePublicGenerationOrder(order.id, {
        status: 'manual_review',

        transactionId,

        paidAt: new Date().toISOString(),

        failureCode: 'PAYMENT_MISMATCH',
      });

      return res.json({
        code: 0,
      });
    }

    /*
     * Даже после оплаты ещё раз проверяем
     * исходный пользовательский запрос.
     */
    const moderation = moderateProfessionRequest(order.profession);

    if (!moderation.allowed) {
      updatePublicGenerationOrder(order.id, {
        status: 'manual_review',

        transactionId,

        paidAt: new Date().toISOString(),

        failureCode: 'MODERATION_AFTER_PAYMENT',
      });

      return res.json({
        code: 0,
      });
    }

    const isTestPayment =
      String(data.TestMode ?? '') === '1' || String(data.TestMode ?? '').toLowerCase() === 'true';

    /*
     * Тестовые CloudPayments-платежи
     * по умолчанию НЕ публикуют инструкции.
     */
    if (isTestPayment && process.env.PUBLIC_GENERATION_PUBLISH_TEST_PAYMENTS !== '1') {
      updatePublicGenerationOrder(order.id, {
        status: 'test_paid',

        transactionId,

        paidAt: new Date().toISOString(),

        failureCode: null,
      });

      if (order.promo?.id) {
        const promoRecorded = markPromoCodeUsed(
          order.promo.id,
          order.id,
          order.promo.reservationId,
        );

        if (!promoRecorded) {
          updatePublicGenerationOrder(order.id, {
            status: 'manual_review',

            transactionId,

            paidAt: new Date().toISOString(),

            failureCode: 'PROMO_RESERVATION_INVALID',
          });

          return res.json({
            code: 0,
          });
        }
      }

      return res.json({
        code: 0,
      });
    }

    updatePublicGenerationOrder(order.id, {
      status: 'paid',

      fiscalPaymentLive: ['false', '0'].includes(String(data.TestMode).toLowerCase()),

      transactionId,

      paidAt: new Date().toISOString(),

      failureCode: null,

      internalError: null,
    });

    if (order.promo?.id) {
      const promoRecorded = markPromoCodeUsed(order.promo.id, order.id, order.promo.reservationId);

      if (!promoRecorded) {
        updatePublicGenerationOrder(order.id, {
          status: 'manual_review',

          transactionId,

          paidAt: new Date().toISOString(),

          failureCode: 'PROMO_RESERVATION_INVALID',
        });

        return res.json({
          code: 0,
        });
      }
    }

    /*
     * ВАЖНО:
     * Pay webhook отвечаем быстро.
     *
     * Генерация выполняется после ответа
     * независимо от HTTP webhook.
     */
    queuePublicGenerationOrder(order.id);

    return res.json({
      code: 0,
    });
  },
);
