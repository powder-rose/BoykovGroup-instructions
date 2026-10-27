import { createHash } from 'node:crypto';

export function fiscalError(code, status = 503) {
  return Object.assign(new Error('Не удалось подготовить кассовый чек. Обратитесь в поддержку.'), {
    code,
    status,
  });
}

export function getFiscalConfiguration(env = process.env) {
  const enabled = String(env.CLOUDKASSIR_ENABLED || 'false').trim();
  if (enabled === 'false') return null;
  if (enabled !== 'true') throw fiscalError('FISCAL_CONFIGURATION_INVALID');
  const publicId = String(env.CLOUDKASSIR_PUBLIC_ID || env.CLOUDPAYMENTS_PUBLIC_ID || '').trim();
  const apiSecret = String(env.CLOUDKASSIR_API_SECRET || env.CLOUDPAYMENTS_API_SECRET || '').trim();
  const inn = String(env.CLOUDKASSIR_INN || '5027310150').trim();
  const place = String(env.CLOUDKASSIR_CALCULATION_PLACE || 'https://boykovdocs.ru/').trim();
  if (!publicId || !apiSecret || !/^\d{10}(?:\d{2})?$/u.test(inn) || place.length > 256)
    throw fiscalError('FISCAL_CONFIGURATION_INVALID');
  const url = new URL(place);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw fiscalError('FISCAL_CONFIGURATION_INVALID');
  return {
    publicId,
    apiSecret,
    policy: { version: 1, inn, taxationSystem: 1, vat: 5, advanceVat: 105, place },
  };
}

export function captureFiscalContext(customer, env = process.env) {
  const configuration = getFiscalConfiguration(env);
  if (!configuration) return null;
  const resolved = typeof customer === 'function' ? customer() : customer;
  const email = String(resolved?.email || '')
    .trim()
    .toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    throw fiscalError('FISCAL_CONTACT_REQUIRED', 422);
  return { ...configuration.policy, publicId: configuration.publicId, email };
}

export const fiscalEventId = (kind, sourceId) =>
  createHash('sha256').update(`${kind}:${sourceId}`).digest('hex');

const KINDS = {
  'wallet-advance': { method: 3, object: 10, advance: true },
  'wallet-settlement': { method: 4, object: 4, settlement: true },
  'wallet-refund': { method: 3, object: 10, advance: true, refund: true },
  'generation-advance': { method: 1, object: 4, advance: true },
  'generation-settlement': { method: 4, object: 4, settlement: true },
  'generation-refund': { method: 1, object: 4, advance: true, refund: true },
};

export function createFiscalEvent({
  kind,
  context,
  sourceId,
  invoiceId,
  amountMinor,
  title,
  transactionId,
  createdAt,
  dependsOn = [],
}) {
  if (!context) return null;
  const rule = KINDS[kind];
  if (
    !rule ||
    context.version !== 1 ||
    !context.publicId ||
    !context.email ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    !sourceId ||
    !invoiceId ||
    !Number.isFinite(Date.parse(createdAt))
  )
    throw fiscalError('FISCAL_EVENT_INVALID');
  const amount = amountMinor / 100;
  const label = [
    ...String(title || '')
      .replace(/\s+/gu, ' ')
      .trim(),
  ]
    .slice(0, 128)
    .join('');
  if (!label) throw fiscalError('FISCAL_EVENT_INVALID');
  const electronic = rule.settlement ? 0 : amount;
  const receipt = {
    Items: [
      {
        Label: label,
        Price: amount,
        Quantity: 1,
        Amount: amount,
        Vat: rule.advance ? context.advanceVat : context.vat,
        Method: rule.method,
        Object: rule.object,
        UnitCode: 0,
      },
    ],
    TaxationSystem: context.taxationSystem,
    Amounts: { Electronic: electronic, AdvancePayment: rule.settlement ? amount : 0 },
    CalculationPlace: context.place,
    Email: context.email,
    IsBso: false,
    IsInternetPayment: true,
    RussiaTimeZone: 2,
    ...(electronic && transactionId
      ? {
          NonCashPayments: [
            { Amount: electronic, PaymentMethod: 1, PaymentId: String(transactionId) },
          ],
        }
      : {}),
  };
  return {
    id: fiscalEventId(kind, sourceId),
    publicId: context.publicId,
    createdAt,
    dependsOn: [...new Set(dependsOn)],
    payload: {
      Inn: context.inn,
      Type: rule.refund ? 'IncomeReturn' : 'Income',
      InvoiceId: invoiceId,
      CustomerReceipt: receipt,
    },
  };
}
