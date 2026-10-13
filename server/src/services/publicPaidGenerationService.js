import { buildInstructionIntro } from '../utils/instructionIntro.js';

import { createBackgroundTaskController } from '../lifecycle/backgroundTaskController.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nanoid } from 'nanoid';

import { instructionsRepository } from './instructionsRepository.js';

import { generateInstructionWithYandexGpt, isYandexGptConfigured } from './yandexGptService.js';

import { runExclusive } from './generationLock.js';

import { normalizeProfessionKey } from './professionNormalizer.js';

import { createInstructionHash } from './instructionHashService.js';

import { assertInstructionQuality } from './instructionQualityChecker.js';

import { refundCloudPaymentsTransaction } from './cloudPaymentsApiService.js';

import {
  getPublicGenerationOrder,
  updatePublicGenerationOrder,
  listRecoverablePublicGenerationOrders,
} from './publicGenerationOrderService.js';

import { slugify } from '../utils/slug.js';

import { getProfessionGenitive } from '../utils/professionGenitive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCKS_DIR = path.join(__dirname, '..', 'data', 'publicGenerationLocks');

const LOCK_STALE_MS = 30 * 60 * 1000;

fs.mkdirSync(LOCKS_DIR, {
  recursive: true,
});

const processingOrders = new Set();

const publicGenerationBackgroundTasks = createBackgroundTaskController();

function lockPath(orderId) {
  return path.join(LOCKS_DIR, `${orderId}.lock`);
}

function tryAcquireOrderLock(orderId) {
  const filepath = lockPath(orderId);

  try {
    const fd = fs.openSync(filepath, 'wx');

    fs.writeFileSync(
      fd,
      JSON.stringify({
        pid: process.pid,

        createdAt: new Date().toISOString(),
      }),
    );

    fs.closeSync(fd);

    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }

    try {
      const stat = fs.statSync(filepath);

      const age = Date.now() - stat.mtimeMs;

      if (age > LOCK_STALE_MS) {
        fs.unlinkSync(filepath);

        return tryAcquireOrderLock(orderId);
      }
    } catch {
      return false;
    }

    return false;
  }
}

function releaseOrderLock(orderId) {
  try {
    fs.unlinkSync(lockPath(orderId));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[PublicPaidGeneration] lock release:', error.message);
    }
  }
}

function findExisting(profession) {
  const professionKey = normalizeProfessionKey(profession);

  if (!professionKey) {
    return null;
  }

  if (typeof instructionsRepository.findByProfessionKey !== 'function') {
    return null;
  }

  return instructionsRepository.findByProfessionKey(professionKey) || null;
}

/*
 * AI_SEMANTIC_MODERATION_AND_REFUND_V2
 *
 * Полный возврат оплаченного заказа.
 *
 * cloudPaymentsApiService дополнительно:
 * - сверяет InvoiceId / сумму / валюту;
 * - проверяет Refunded;
 * - использует стабильный X-Request-ID.
 */
async function refundRejectedOrder(order, failureCode, internalReason) {
  const current = getPublicGenerationOrder(order.id) || order;

  if (current.status === 'refunded') {
    return current;
  }

  if (!current.transactionId) {
    return updatePublicGenerationOrder(current.id, {
      status: 'refund_pending',

      failureCode: failureCode || current.failureCode || 'REFUND_REQUIRED',

      internalError: 'Paid order has no transactionId',
    });
  }

  const refundStartedAt = current.refundStartedAt || new Date().toISOString();

  updatePublicGenerationOrder(current.id, {
    status: 'refunding',

    refundStartedAt,

    failureCode: failureCode || current.failureCode || 'REFUND_REQUIRED',

    internalError: internalReason ? String(internalReason).slice(0, 1000) : current.internalError,
  });

  try {
    const result = await refundCloudPaymentsTransaction({
      transactionId: current.transactionId,

      amount: current.amount,

      invoiceId: current.id,

      currency: current.currency,
    });

    if (!result?.success) {
      const error = new Error('CloudPayments refund was not successful');

      error.code = 'CLOUDPAYMENTS_REFUND_FAILED';

      throw error;
    }

    const updated = updatePublicGenerationOrder(current.id, {
      status: 'refunded',

      refundTransactionId: result.refundTransactionId ?? current.refundTransactionId ?? null,

      refundStartedAt,

      refundedAt: new Date().toISOString(),

      failureCode: failureCode || current.failureCode || 'REFUND_REQUIRED',

      internalError: null,
    });

    console.log(
      '[PublicPaidGeneration] Refund completed:',
      current.id,
      result.alreadyRefunded ? '(already refunded)' : '',
    );

    return updated;
  } catch (error) {
    const updated = updatePublicGenerationOrder(current.id, {
      status: 'refund_pending',

      refundStartedAt,

      failureCode: failureCode || current.failureCode || 'REFUND_REQUIRED',

      internalError: String(error?.message || error).slice(0, 1000),
    });

    console.error(
      '[PublicPaidGeneration] Refund pending:',
      current.id,
      error?.code || error?.message || error,
    );

    publicGenerationBackgroundTasks.scheduleTimeout(() => {
      queuePublicGenerationOrder(current.id);
    }, 60 * 1000);

    return updated;
  }
}

async function generateAndPublish(order) {
  /*
   * Если процесс был прерван уже во время
   * возврата — только продолжаем возврат.
   * Генерация после этого запрещена.
   */
  if (order.status === 'refunding' || order.status === 'refund_pending') {
    await refundRejectedOrder(order, order.failureCode || 'REFUND_RETRY', order.internalError);

    return;
  }

  /*
   * PRIVATE_GENERATION_BEFORE_PUBLICATION_V2
   *
   * После оплаты приложение не решает,
   * допустима ли профессия по содержанию.
   *
   * Остаётся только защита от повреждённого
   * заказа с пустым значением.
   */
  const profession = String(order.profession ?? '').trim();

  if (!profession) {
    updatePublicGenerationOrder(order.id, {
      status: 'manual_review',

      failureCode: 'INVALID_PROFESSION',

      internalError: 'Paid order has empty profession',
    });

    return;
  }

  /*
   * Если за время оплаты инструкция
   * уже появилась — используем её.
   */
  const existing = findExisting(profession);

  if (existing) {
    const deliveredAt = new Date().toISOString();

    updatePublicGenerationOrder(order.id, {
      status: 'generated',

      generatedInstruction: existing,

      generatedAt: deliveredAt,

      publicationStatus: 'published',

      instructionId: existing.id,

      publishedAt: deliveredAt,

      failureCode: null,

      internalError: null,
    });

    return;
  }

  if (!isYandexGptConfigured()) {
    updatePublicGenerationOrder(order.id, {
      status: 'manual_review',

      failureCode: 'GENERATOR_UNAVAILABLE',

      internalError: 'Generation service is not configured',
    });

    return;
  }

  updatePublicGenerationOrder(order.id, {
    status: 'generating',

    failureCode: null,

    internalError: null,
  });

  const generationKey = slugify(profession) || normalizeProfessionKey(profession) || order.id;

  await runExclusive(
    generationKey,

    async () => {
      /*
       * Проверяем повторно внутри generation lock.
       */
      const alreadyExists = findExisting(profession);

      if (alreadyExists) {
        const deliveredAt = new Date().toISOString();

        updatePublicGenerationOrder(order.id, {
          status: 'generated',

          generatedInstruction: alreadyExists,

          generatedAt: deliveredAt,

          publicationStatus: 'published',

          instructionId: alreadyExists.id,

          publishedAt: deliveredAt,

          failureCode: null,

          internalError: null,
        });

        return;
      }

      const generated = await generateInstructionWithYandexGpt(profession);

      const canonicalProfession = String(profession ?? '').trim();

      const canonicalTitle = `Инструкция по охране труда для ${getProfessionGenitive(canonicalProfession) || canonicalProfession}`;

      const canonicalIntro = buildInstructionIntro(canonicalTitle);

      const baseSlug =
        slugify(`instruktsiya-po-ohrane-truda-dlya-${profession}`) || `instruction-${Date.now()}`;

      const now = new Date().toISOString();

      const instruction = {
        id: `${baseSlug}-${nanoid(6)}`,

        title: canonicalTitle,

        profession: canonicalProfession,

        professionKey: normalizeProfessionKey(canonicalProfession),

        intro: canonicalIntro,

        sections: generated.sections,

        source: 'generated',

        generatedBy: 'public-payment',

        paymentOrderId: order.id,

        version: '1.0',

        createdAt: now,

        updatedAt: now,
      };

      /*
       * Защита №3:
       * проверяем уже готовый документ.
       */

      /*
       * Структурная проверка инструкции.
       */
      assertInstructionQuality(instruction);

      instruction.contentHash = createInstructionHash(instruction);

      /*
       * Последняя проверка перед записью.
       */

      /*
       * Покупатель получает результат сразу,
       * но в публичный instructionsRepository
       * документ пока НЕ записывается.
       */
      updatePublicGenerationOrder(order.id, {
        status: 'generated',

        generatedInstruction: instruction,

        generatedAt: now,

        publicationStatus: 'pending',

        instructionId: null,

        publishedAt: null,

        reviewedAt: null,

        reviewedBy: null,

        rejectionReason: null,

        moderationStatus: null,

        moderationReason: null,

        moderatedAt: null,

        failureCode: null,

        internalError: null,
      });

      console.log('[PublicPaidGeneration] Generated for customer:', instruction.id);
    },
  );
}

export async function processPublicGenerationOrder(orderId) {
  if (processingOrders.has(orderId)) {
    return;
  }

  if (!tryAcquireOrderLock(orderId)) {
    return;
  }

  processingOrders.add(orderId);

  try {
    const order = getPublicGenerationOrder(orderId);

    if (!order) {
      return;
    }

    if (
      !['paid', 'moderating', 'generating', 'refunding', 'refund_pending'].includes(order.status)
    ) {
      return;
    }

    await generateAndPublish(order);
  } catch (error) {
    console.error('[PublicPaidGeneration] failed:', orderId, error);

    updatePublicGenerationOrder(orderId, {
      status: 'manual_review',

      failureCode: error?.code || 'GENERATION_FAILED',

      internalError: String(error?.message || error).slice(0, 1000),
    });
  } finally {
    processingOrders.delete(orderId);

    releaseOrderLock(orderId);
  }
}

export function queuePublicGenerationOrder(orderId) {
  return publicGenerationBackgroundTasks.scheduleImmediate(async () => {
    try {
      await processPublicGenerationOrder(orderId);
    } catch (error) {
      console.error('[PublicPaidGeneration] queue error:', error);
    }
  });
}

export async function stopPublicGenerationProcessing() {
  await publicGenerationBackgroundTasks.stop();
}

export function recoverPublicGenerationOrders() {
  const orders = listRecoverablePublicGenerationOrders();

  for (const order of orders) {
    queuePublicGenerationOrder(order.id);
  }

  if (orders.length > 0) {
    console.log(`[PublicPaidGeneration] recovery queued: ${orders.length}`);
  }
}
