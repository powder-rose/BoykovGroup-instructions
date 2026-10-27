import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { acquireFileLeaseLock, releaseFileLeaseLock } from '../utils/fileLeaseLock.js';
import { createFiscalEvent } from './fiscalReceiptPayload.js';
import {
  INSTRUCTION_PRICE_MINOR,
  MAX_TOPUP_MINOR,
  WALLET_CURRENCY,
  validateTopupAmount,
  walletError,
} from './walletMoney.js';

const DEFAULT_FILE = fileURLToPath(new URL('../../data/wallets.json', import.meta.url));
const emptyState = () => ({ version: 1, topups: [], payments: [], refunds: [], purchases: [] });
const nonempty = value => typeof value === 'string' && value.length > 0;
const positive = value => Number.isSafeInteger(value) && value > 0;
const now = () => new Date().toISOString();

export function normalizePurchaseFormat(format = 'pdf') {
  if (format !== 'pdf' && format !== 'docx')
    throw walletError('INVALID_FORMAT', 'Выберите PDF или Word.', 400);
  return format;
}

function assertState(condition) {
  if (!condition)
    throw walletError('WALLET_UNAVAILABLE', 'Не удалось прочитать баланс. Попробуйте позже.', 503);
}

function validateState(state) {
  assertState(state?.version === 1);
  for (const key of ['topups', 'payments', 'refunds', 'purchases']) {
    assertState(Array.isArray(state[key]));
    const ids = new Set();
    for (const row of state[key]) {
      assertState(
        row &&
          nonempty(row.id) &&
          !ids.has(row.id) &&
          nonempty(row.createdAt) &&
          Number.isFinite(Date.parse(row.createdAt)),
      );
      ids.add(row.id);
    }
  }
  const topups = new Map();
  const requests = new Set();
  for (const order of state.topups) {
    assertState(order.id.startsWith('wt_') && nonempty(order.userId) && nonempty(order.publicId));
    assertState(
      positive(order.amountMinor) &&
        order.amountMinor <= MAX_TOPUP_MINOR &&
        order.amountMinor % INSTRUCTION_PRICE_MINOR === 0 &&
        order.currency === WALLET_CURRENCY,
    );
    assertState(
      nonempty(order.requestId) &&
        order.consent?.offerAccepted === true &&
        order.consent?.personalDataConsentAccepted === true,
    );
    const requestKey = JSON.stringify([order.userId, order.requestId]);
    assertState(!requests.has(requestKey));
    requests.add(requestKey);
    topups.set(order.id, order);
  }
  const transactions = new Set();
  for (const payment of state.payments) {
    const order = topups.get(payment.orderId);
    assertState(
      order && order.userId === payment.userId && payment.amountMinor === order.amountMinor,
    );
    assertState(!transactions.has(payment.id));
    transactions.add(payment.id);
  }
  const refunded = new Map();
  for (const refund of state.refunds) {
    const order = topups.get(refund.orderId);
    assertState(
      order &&
        order.userId === refund.userId &&
        nonempty(refund.paymentId) &&
        positive(refund.amountMinor),
    );
    assertState(!transactions.has(refund.id));
    transactions.add(refund.id);
    const payment = state.payments.find(item => item.id === refund.paymentId);
    assertState(!payment || payment.orderId === refund.orderId);
    const amount = (refunded.get(refund.paymentId) || 0) + refund.amountMinor;
    assertState(amount <= order.amountMinor);
    refunded.set(refund.paymentId, amount);
  }
  const owned = new Set();
  for (const purchase of state.purchases) {
    const format = purchase.format === undefined ? 'pdf' : purchase.format;
    assertState(format === 'pdf' || format === 'docx');
    assertState(
      nonempty(purchase.userId) && nonempty(purchase.instructionId) && nonempty(purchase.title),
    );
    assertState(
      purchase.amountMinor === INSTRUCTION_PRICE_MINOR &&
        purchase.instruction &&
        typeof purchase.instruction === 'object',
    );
    const key = JSON.stringify([purchase.userId, purchase.instructionId, format]);
    assertState(!owned.has(key));
    owned.add(key);
  }
  return state;
}

function balance(state, userId) {
  const sum = rows =>
    rows.filter(row => row.userId === userId).reduce((total, row) => total + row.amountMinor, 0);
  // Refunds may arrive before Pay. They reduce this payment's credit when Pay arrives,
  // rather than taking money from unrelated top-ups while the original credit is absent.
  const payments = new Set(state.payments.map(row => row.id));
  const value =
    sum(state.payments) -
    sum(state.refunds.filter(row => payments.has(row.paymentId))) -
    sum(state.purchases);
  assertState(Number.isSafeInteger(value));
  return value;
}

function purchaseView({ id, instructionId, title, amountMinor, createdAt, format = 'pdf' }) {
  return { id, instructionId, title, amountMinor, createdAt, format };
}

function orderView(state, order) {
  const payments = state.payments.filter(row => row.orderId === order.id);
  return {
    id: order.id,
    amountMinor: order.amountMinor,
    currency: order.currency,
    createdAt: order.createdAt,
    status: payments.length
      ? 'paid'
      : Date.now() - Date.parse(order.createdAt) > 86_400_000
        ? 'expired'
        : 'pending',
    creditedMinor:
      payments.reduce((sum, row) => sum + row.amountMinor, 0) -
      state.refunds
        .filter(
          row => row.orderId === order.id && payments.some(payment => payment.id === row.paymentId),
        )
        .reduce((sum, row) => sum + row.amountMinor, 0),
  };
}

export function createWalletRepository({ file = DEFAULT_FILE, io = fs } = {}) {
  const marker = `${file}.initialized`;

  function syncDirectory() {
    // POSIX directory fsync makes the atomic rename durable across a power loss.
    // Windows does not support opening directories as ordinary file descriptors.
    if (process.platform === 'win32') return;
    const descriptor = io.openSync(path.dirname(file), 'r');
    try {
      io.fsyncSync(descriptor);
    } finally {
      io.closeSync(descriptor);
    }
  }

  function write(state) {
    validateState(state);
    const temporary = `${file}.${randomUUID()}.tmp`;
    let descriptor;
    try {
      descriptor = io.openSync(temporary, 'wx', 0o600);
      io.writeFileSync(descriptor, `${JSON.stringify(state)}\n`, 'utf8');
      io.fsyncSync(descriptor);
      io.closeSync(descriptor);
      descriptor = undefined;
      io.renameSync(temporary, file);
      syncDirectory();
    } finally {
      if (descriptor !== undefined) io.closeSync(descriptor);
      try {
        io.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== 'ENOENT') console.error('[Wallet] Temporary file cleanup failed');
      }
    }
  }

  function transaction(action) {
    const lock = acquireFileLeaseLock({ filePath: `${file}.lock`, staleMs: 300_000 });
    if (!lock.acquired)
      throw walletError(
        'WALLET_BUSY',
        'Баланс обновляется. Повторите попытку через несколько секунд.',
        503,
      );
    try {
      let state;
      try {
        state = validateState(JSON.parse(io.readFileSync(file, 'utf8')));
      } catch (error) {
        if (error.code !== 'ENOENT' || io.existsSync(marker)) throw error;
        state = emptyState();
        write(state);
      }
      if (!io.existsSync(marker)) {
        const descriptor = io.openSync(marker, 'wx', 0o600);
        try {
          io.writeFileSync(descriptor, '1\n');
          io.fsyncSync(descriptor);
        } finally {
          io.closeSync(descriptor);
        }
        syncDirectory();
      }
      const result = action(state);
      if (result.changed) write(state);
      return structuredClone(result.value);
    } finally {
      // A committed transaction stays successful even if lock cleanup needs recovery.
      try {
        releaseFileLeaseLock(lock);
      } catch {
        console.error('[Wallet] Lock cleanup failed');
      }
    }
  }

  const read = action => transaction(state => ({ value: action(state) }));
  const findPurchase = (state, userId, instructionId, format = 'pdf') =>
    state.purchases.find(
      row =>
        row.userId === userId &&
        row.instructionId === instructionId &&
        (row.format ?? 'pdf') === format,
    );

  return {
    listAdminPurchases() {
      return read(state => state.purchases.map(purchaseView));
    },
    listFiscalEvents() {
      if (!io.existsSync(file)) return [];
      return read(state =>
        [
          ...state.payments.map(row => row.fiscalEvent),
          ...state.refunds
            .filter(row => state.payments.some(payment => payment.id === row.paymentId))
            .map(row => row.fiscalEvent),
          ...state.purchases.map(row => row.fiscalEvent),
        ].filter(Boolean),
      );
    },
    getView(userId) {
      return read(state => ({
        currency: WALLET_CURRENCY,
        balanceMinor: balance(state, userId),
        priceMinor: INSTRUCTION_PRICE_MINOR,
        purchases: state.purchases
          .filter(row => row.userId === userId)
          .map(purchaseView)
          .reverse(),
        topups: state.topups
          .filter(row => row.userId === userId)
          .map(order => orderView(state, order))
          .reverse()
          .slice(0, 30),
        history: [
          ...state.payments
            .filter(row => row.userId === userId)
            .map(row => ({
              id: row.id,
              type: 'topup',
              amountMinor: row.amountMinor,
              createdAt: row.createdAt,
            })),
          ...state.refunds
            .filter(
              row =>
                row.userId === userId &&
                state.payments.some(payment => payment.id === row.paymentId),
            )
            .map(row => ({
              id: row.id,
              type: 'refund',
              amountMinor: -row.amountMinor,
              createdAt: row.createdAt,
            })),
          ...state.purchases
            .filter(row => row.userId === userId)
            .map(row => ({
              id: row.id,
              type: 'purchase',
              title: row.title,
              format: row.format ?? 'pdf',
              amountMinor: -row.amountMinor,
              createdAt: row.createdAt,
            })),
        ]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 30),
      }));
    },
    getOrder(id) {
      return read(state => state.topups.find(row => row.id === id) || null);
    },
    getOrderView(userId, id) {
      return read(state => {
        const order = state.topups.find(row => row.id === id && row.userId === userId);
        return order ? orderView(state, order) : null;
      });
    },
    createTopup({ userId, amountMinor, requestId, publicId, consent, fiscalContext }) {
      validateTopupAmount(amountMinor);
      if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/u.test(requestId))
        throw walletError('INVALID_REQUEST_ID', 'Обновите страницу и повторите попытку.');
      return transaction(state => {
        const existing = state.topups.find(
          row => row.userId === userId && row.requestId === requestId,
        );
        if (existing) {
          if (existing.amountMinor !== amountMinor)
            throw walletError('REQUEST_CONFLICT', 'Сумма этого платежа уже зафиксирована.', 409);
          return { value: existing };
        }
        const order = {
          id: `wt_${randomUUID()}`,
          userId,
          amountMinor,
          currency: WALLET_CURRENCY,
          requestId,
          publicId,
          consent,
          ...(fiscalContext ? { fiscalContext } : {}),
          createdAt: now(),
        };
        state.topups.push(order);
        return { changed: true, value: order };
      });
    },
    credit({ orderId, transactionId, fiscalContext }) {
      return transaction(state => {
        const order = state.topups.find(row => row.id === orderId);
        assertState(order);
        const existing = state.payments.find(row => row.id === transactionId);
        if (existing) {
          assertState(existing.orderId === orderId);
          return { value: orderView(state, order) };
        }
        if (!order.fiscalContext && fiscalContext) {
          const context = typeof fiscalContext === 'function' ? fiscalContext() : fiscalContext;
          if (context) order.fiscalContext = context;
        }
        const payment = {
          id: transactionId,
          orderId,
          userId: order.userId,
          amountMinor: order.amountMinor,
          createdAt: now(),
        };
        if (order.fiscalContext) {
          payment.fiscalEvent = createFiscalEvent({
            kind: 'wallet-advance',
            context: order.fiscalContext,
            sourceId: transactionId,
            invoiceId: order.id,
            amountMinor: order.amountMinor,
            transactionId,
            createdAt: payment.createdAt,
            title: 'Аванс на услуги предоставления инструкций БОЙКОВГРУПП',
          });
          // A signed Refund can arrive before Pay. Only a verified credit releases both receipts.
          for (const refund of state.refunds.filter(row => row.paymentId === transactionId)) {
            refund.fiscalEvent = refundEvent(order, refund, payment);
          }
        }
        state.payments.push(payment);
        return { changed: true, value: orderView(state, order) };
      });
    },
    refund({ orderId, transactionId, originalTransactionId, amountMinor }) {
      return transaction(state => {
        const order = state.topups.find(row => row.id === orderId);
        assertState(order);
        const existing = state.refunds.find(row => row.id === transactionId);
        if (existing) {
          assertState(
            existing.orderId === orderId &&
              existing.paymentId === originalTransactionId &&
              existing.amountMinor === amountMinor,
          );
          return { value: true };
        }
        const refund = {
          id: transactionId,
          paymentId: originalTransactionId,
          orderId,
          userId: order.userId,
          amountMinor,
          createdAt: now(),
        };
        if (order.fiscalContext)
          refund.fiscalEvent = refundEvent(
            order,
            refund,
            state.payments.find(row => row.id === originalTransactionId),
          );
        if (
          refund.fiscalEvent &&
          state.payments.some(row => row.id === originalTransactionId) &&
          balance(state, order.userId) < amountMinor
        )
          refund.fiscalEvent.reviewReason = 'SPENT_ADVANCE_REFUND';
        state.refunds.push(refund);
        return { changed: true, value: true };
      });
    },
    findPurchase(userId, instructionId, format = 'pdf') {
      return read(state => findPurchase(state, userId, instructionId, format) || null);
    },
    getPurchase(userId, id) {
      return read(
        state => state.purchases.find(row => row.id === id && row.userId === userId) || null,
      );
    },
    purchase({ userId, instructionId, instruction, format = 'pdf', fiscalContext }) {
      normalizePurchaseFormat(format);
      return transaction(state => {
        const existing = findPurchase(state, userId, instructionId, format);
        if (existing) return { value: purchaseView(existing) };
        if (balance(state, userId) < INSTRUCTION_PRICE_MINOR)
          throw walletError('INSUFFICIENT_BALANCE', 'Для покупки нужно 50 ₽ на балансе.', 409);
        const purchase = {
          id: `wp_${randomUUID()}`,
          userId,
          instructionId,
          instruction,
          format,
          title: instruction.title || 'Инструкция по охране труда',
          amountMinor: INSTRUCTION_PRICE_MINOR,
          createdAt: now(),
        };
        if (fiscalContext)
          purchase.fiscalEvent = createFiscalEvent({
            kind: 'wallet-settlement',
            context: fiscalContext,
            sourceId: purchase.id,
            invoiceId: purchase.id,
            amountMinor: purchase.amountMinor,
            createdAt: purchase.createdAt,
            title: `${format === 'docx' ? 'Word' : 'PDF'}: ${purchase.title}`,
            dependsOn: state.payments
              .filter(row => row.userId === userId && row.fiscalEvent)
              .map(row => row.fiscalEvent.id),
          });
        state.purchases.push(purchase);
        return { changed: true, value: purchaseView(purchase) };
      });
    },
  };
}

function refundEvent(order, refund, payment) {
  return createFiscalEvent({
    kind: 'wallet-refund',
    context: order.fiscalContext,
    sourceId: refund.id,
    invoiceId: order.id,
    amountMinor: refund.amountMinor,
    transactionId: refund.id,
    createdAt: refund.createdAt,
    title: 'Возврат аванса на услуги предоставления инструкций БОЙКОВГРУПП',
    dependsOn: payment?.fiscalEvent ? [payment.fiscalEvent.id] : [],
  });
}

export const walletRepository = createWalletRepository();
