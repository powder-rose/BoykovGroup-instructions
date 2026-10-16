import { walletRepository } from './walletRepository.js';
import {
  getCloudPaymentsTransaction,
  findCloudPaymentsTransaction,
} from './cloudPaymentsApiService.js';
import { paymentId, rublesToMinor, walletError } from './walletMoney.js';

function isLive(value) {
  return value === false || value === 0 || value === '0' || value === 'false';
}

function matchesOrder(order, data) {
  return (
    order &&
    String(data.InvoiceId ?? '') === order.id &&
    String(data.AccountId ?? '') === order.userId &&
    rublesToMinor(data.Amount) === order.amountMinor &&
    data.Currency === order.currency
  );
}

export function createWalletPaymentService({
  store = walletRepository,
  lookup = getCloudPaymentsTransaction,
  find = findCloudPaymentsTransaction,
} = {}) {
  function requireOrder(id) {
    const order = store.getOrder(id);
    if (!order) throw walletError('TOPUP_NOT_FOUND', 'Платёж не найден.', 404);
    return order;
  }

  function verifyApiPayment(order, data) {
    if (!matchesOrder(order, data) || data.PublicId !== order.publicId || data.Type !== 0) {
      throw walletError(
        'PAYMENT_MISMATCH',
        'Параметры платежа не совпадают. Обратитесь в поддержку.',
        409,
      );
    }
    if (!isLive(data.TestMode))
      throw walletError('TEST_PAYMENT', 'Тестовый платёж не пополняет баланс.', 409);
  }

  return {
    check(data) {
      const order = store.getOrder(String(data.InvoiceId ?? ''));
      if (!order) return 10;
      if (
        !matchesOrder(order, data) ||
        data.OperationType !== 'Payment' ||
        data.Status !== 'Completed' ||
        data.SubscriptionId
      )
        return 13;
      if (Date.now() - Date.parse(order.createdAt) > 24 * 60 * 60 * 1000) return 20;
      if (store.getOrderView(order.userId, order.id).status !== 'pending') return 13;
      return 0;
    },
    pay(data) {
      const order = requireOrder(String(data.InvoiceId ?? ''));
      if (
        !matchesOrder(order, data) ||
        data.OperationType !== 'Payment' ||
        data.Status !== 'Completed'
      ) {
        throw walletError('PAYMENT_MISMATCH', 'Параметры платежа не совпадают.', 409);
      }
      // A signed test notification is acknowledged without creating spendable funds.
      if (!isLive(data.TestMode)) return null;
      return store.credit({ orderId: order.id, transactionId: paymentId(data.TransactionId) });
    },
    async confirm(userId, orderId, transactionId) {
      const order = requireOrder(orderId);
      if (order.userId !== userId) throw walletError('TOPUP_NOT_FOUND', 'Платёж не найден.', 404);
      const current = store.getOrderView(userId, orderId);
      if (current.status === 'paid') return current;
      const data = transactionId ? await lookup(paymentId(transactionId)) : await find(order.id);
      if (!data) return current;
      verifyApiPayment(order, data);
      // Refund notifications are accounted individually; never recreate refunded credit
      // from a status response that lacks the refund transaction IDs and exact amounts.
      if (data.Refunded === true)
        throw walletError(
          'PAYMENT_REFUNDED',
          'Платёж возвращён. Если баланс не обновился, обратитесь в поддержку.',
          409,
        );
      if (data.Status === 'Declined' || data.Status === 'Cancelled')
        return { ...current, status: 'declined' };
      if (data.Status !== 'Completed') return current;
      return store.credit({ orderId, transactionId: paymentId(data.TransactionId) });
    },
    refund(data) {
      const order = requireOrder(String(data.InvoiceId ?? ''));
      const amountMinor = rublesToMinor(data.Amount);
      if (
        String(data.AccountId ?? '') !== order.userId ||
        data.OperationType !== 'Refund' ||
        !amountMinor ||
        amountMinor > order.amountMinor ||
        (data.Currency && data.Currency !== order.currency)
      ) {
        throw walletError('REFUND_MISMATCH', 'Параметры возврата не совпадают.', 409);
      }
      return store.refund({
        orderId: order.id,
        transactionId: paymentId(data.TransactionId),
        originalTransactionId: paymentId(data.PaymentTransactionId),
        amountMinor,
      });
    },
  };
}

export const walletPaymentService = createWalletPaymentService();
