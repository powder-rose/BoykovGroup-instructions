import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

const DEFAULT_CLOUDPAYMENTS_HTTP_TIMEOUT_MS = 15_000;

function getCloudPaymentsHttpTimeoutMs() {
  const configured = Number.parseInt(String(process.env.CLOUDPAYMENTS_HTTP_TIMEOUT_MS ?? ''), 10);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_CLOUDPAYMENTS_HTTP_TIMEOUT_MS;
}

function cloudPaymentsFetch(url, options) {
  return fetchWithTimeout(globalThis.fetch, url, options, {
    timeoutMs: getCloudPaymentsHttpTimeoutMs(),
    timeoutCode: 'CLOUDPAYMENTS_HTTP_TIMEOUT',
  });
}

function getCredentials() {
  const publicId = String(process.env.CLOUDPAYMENTS_PUBLIC_ID ?? '').trim();

  const apiSecret = String(process.env.CLOUDPAYMENTS_API_SECRET ?? '').trim();

  if (!publicId || !apiSecret) {
    const error = new Error('CloudPayments API is not configured');

    error.code = 'CLOUDPAYMENTS_NOT_CONFIGURED';

    throw error;
  }

  return {
    publicId,
    apiSecret,
  };
}

function normalizeTransactionId(value) {
  const raw = String(value ?? '').trim();

  if (!/^\d{1,20}$/u.test(raw)) {
    const error = new Error('Invalid CloudPayments transaction ID');

    error.code = 'INVALID_TRANSACTION_ID';

    throw error;
  }

  const number = Number(raw);

  if (!Number.isSafeInteger(number) || number <= 0) {
    const error = new Error('CloudPayments transaction ID is outside safe integer range');

    error.code = 'INVALID_TRANSACTION_ID';

    throw error;
  }

  return number;
}

async function queryCloudPaymentsTransaction(endpoint, body) {
  const { publicId, apiSecret } = getCredentials();

  const authorization = Buffer.from(`${publicId}:${apiSecret}`, 'utf8').toString('base64');

  const response = await cloudPaymentsFetch(`https://api.cloudpayments.ru/${endpoint}`, {
    method: 'POST',

    headers: {
      Authorization: `Basic ${authorization}`,

      'Content-Type': 'application/json',

      Accept: 'application/json',
    },

    body: JSON.stringify(body),
  });

  const raw = await response.text();

  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      const error = new Error('CloudPayments returned invalid JSON');

      error.code = 'CLOUDPAYMENTS_INVALID_RESPONSE';

      throw error;
    }
  }

  if (!response.ok) {
    const error = new Error(`CloudPayments HTTP ${response.status}`);

    error.code = 'CLOUDPAYMENTS_HTTP_ERROR';

    error.httpStatus = response.status;

    throw error;
  }

  /*
   * Для неизвестной транзакции CloudPayments
   * может вернуть Success=false.
   *
   * Это не ошибка нашего сервера:
   * просто платёж пока нельзя подтвердить.
   */
  if (!payload?.Success || !payload?.Model) {
    return null;
  }

  return payload.Model;
}

export async function getCloudPaymentsTransaction(transactionId) {
  return queryCloudPaymentsTransaction('payments/get', {
    TransactionId: normalizeTransactionId(transactionId),
  });
}

export function findCloudPaymentsTransaction(invoiceId) {
  return queryCloudPaymentsTransaction('v2/payments/find', { InvoiceId: invoiceId });
}

/*
 * ============================================================
 * CLOUDPAYMENTS_REFUND_V1
 * ============================================================
 */

export async function refundCloudPaymentsTransaction({
  transactionId,
  amount,
  invoiceId,
  currency = 'RUB',
}) {
  const { publicId, apiSecret } = getCredentials();

  const normalizedTransactionId = normalizeTransactionId(transactionId);

  const normalizedAmount = Number(amount);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    const error = new Error('Invalid refund amount');

    error.code = 'INVALID_REFUND_AMOUNT';

    throw error;
  }

  /*
   * Перед возвратом ещё раз проверяем
   * исходную транзакцию.
   */
  const original = await getCloudPaymentsTransaction(normalizedTransactionId);

  if (!original) {
    const error = new Error('Original CloudPayments transaction was not found');

    error.code = 'REFUND_ORIGINAL_NOT_FOUND';

    throw error;
  }

  if (String(original.PublicId ?? '') !== publicId) {
    const error = new Error('Refund transaction belongs to another terminal');

    error.code = 'REFUND_PUBLIC_ID_MISMATCH';

    throw error;
  }

  if (invoiceId && String(original.InvoiceId ?? '') !== String(invoiceId)) {
    const error = new Error('Refund InvoiceId mismatch');

    error.code = 'REFUND_INVOICE_MISMATCH';

    throw error;
  }

  if (
    currency &&
    String(original.Currency ?? '').toUpperCase() !== String(currency).toUpperCase()
  ) {
    const error = new Error('Refund currency mismatch');

    error.code = 'REFUND_CURRENCY_MISMATCH';

    throw error;
  }

  if (Math.abs(Number(original.Amount) - normalizedAmount) > 0.001) {
    const error = new Error('Refund amount does not match original payment');

    error.code = 'REFUND_AMOUNT_MISMATCH';

    throw error;
  }

  /*
   * Идемпотентность после crash:
   * если полный возврат уже зафиксирован
   * CloudPayments, второй refund не делаем.
   */
  if (original.Refunded === true) {
    return {
      success: true,

      alreadyRefunded: true,

      refundTransactionId: null,
    };
  }

  const authorization = Buffer.from(`${publicId}:${apiSecret}`, 'utf8').toString('base64');

  /*
   * Один и тот же заказ всегда использует
   * один и тот же X-Request-ID для полного refund.
   *
   * Это защищает от двойного возврата
   * при retry / network error / Passenger restart.
   */
  const refundRequestId = [
    'boykovdocs-refund',
    String(invoiceId ?? 'no-invoice'),
    String(normalizedTransactionId),
    normalizedAmount.toFixed(2),
  ]
    .join('-')
    .slice(0, 180);

  const response = await cloudPaymentsFetch('https://api.cloudpayments.ru/payments/refund', {
    method: 'POST',

    headers: {
      Authorization: `Basic ${authorization}`,

      'X-Request-ID': refundRequestId,

      'Content-Type': 'application/json',

      Accept: 'application/json',
    },

    body: JSON.stringify({
      TransactionId: normalizedTransactionId,

      Amount: normalizedAmount,
    }),
  });

  const raw = await response.text();

  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      const error = new Error('CloudPayments refund returned invalid JSON');

      error.code = 'CLOUDPAYMENTS_REFUND_INVALID_RESPONSE';

      throw error;
    }
  }

  if (!response.ok) {
    const error = new Error(`CloudPayments refund HTTP ${response.status}`);

    error.code = 'CLOUDPAYMENTS_REFUND_HTTP_ERROR';

    error.httpStatus = response.status;

    throw error;
  }

  if (payload?.Success !== true) {
    const error = new Error(String(payload?.Message || 'CloudPayments rejected refund'));

    error.code = 'CLOUDPAYMENTS_REFUND_REJECTED';

    throw error;
  }

  const refundTransactionId = payload?.Model?.TransactionId ?? null;

  /*
   * Дополнительная верификация.
   *
   * Даже если ответ необычного формата,
   * проверим исходную транзакцию ещё раз.
   */
  if (!refundTransactionId) {
    const verified = await getCloudPaymentsTransaction(normalizedTransactionId);

    if (verified?.Refunded !== true) {
      const error = new Error('CloudPayments refund could not be verified');

      error.code = 'CLOUDPAYMENTS_REFUND_NOT_VERIFIED';

      throw error;
    }
  }

  return {
    success: true,

    alreadyRefunded: false,

    refundTransactionId: refundTransactionId ? String(refundTransactionId) : null,
  };
}
