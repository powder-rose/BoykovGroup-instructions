export const INSTRUCTION_PRICE_MINOR = 5000;
export const MAX_TOPUP_MINOR = 1_000_000;
export const WALLET_CURRENCY = 'RUB';

export function walletError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

// Parse decimal provider amounts without rounding fractional kopecks or accepting exponents.
export function rublesToMinor(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const match = String(value).match(/^(0|[1-9]\d{0,10})(?:\.(\d{1,2}))?$/u);
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function validateTopupAmount(amountMinor) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < INSTRUCTION_PRICE_MINOR ||
    amountMinor > MAX_TOPUP_MINOR ||
    amountMinor % INSTRUCTION_PRICE_MINOR !== 0
  ) {
    throw walletError('INVALID_TOPUP_AMOUNT', 'Укажите сумму от 50 до 10 000 ₽, кратную 50 ₽.');
  }
}

export function paymentId(value) {
  const id = String(value ?? '');
  if (!/^[1-9]\d{0,15}$/u.test(id) || !Number.isSafeInteger(Number(id))) {
    throw walletError('INVALID_TRANSACTION_ID', 'Некорректный номер платежа.');
  }
  return id;
}
