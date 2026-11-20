import { rublesToMinor } from './walletMoney.js';

const PAID_STATUSES = new Set([
  'paid',
  'moderating',
  'generating',
  'generated',
  'manual_review',
  'refunding',
  'refund_pending',
  'refunded',
]);

/** One persisted order is one payment; receipts and generation attempts are not sales. */
export function summarizeGenerationSales({ orders, inPeriod, nowTimestamp }) {
  const seen = new Set();
  const groups = new Map();
  let count = 0;
  let amountMinor = 0;
  let refundedCount = 0;
  let refundedAmountMinor = 0;

  for (const order of orders) {
    const amount = rublesToMinor(order?.amount);
    const paidAt = typeof order?.paidAt === 'string' ? Date.parse(order.paidAt) : NaN;
    if (
      typeof order?.id !== 'string' ||
      !order.id ||
      seen.has(order.id) ||
      !order.hasPayment ||
      order.paymentMatched !== true ||
      !['live', 'legacy'].includes(order.paymentMode) ||
      !PAID_STATUSES.has(order.status) ||
      order.currency !== 'RUB' ||
      amount === null ||
      amount <= 0 ||
      !Number.isFinite(paidAt) ||
      paidAt > nowTimestamp
    )
      continue;
    seen.add(order.id);

    const refundedAt = typeof order.refundedAt === 'string' ? Date.parse(order.refundedAt) : NaN;
    const refunded =
      Number.isFinite(refundedAt) && refundedAt >= paidAt && refundedAt <= nowTimestamp;
    // A refund belongs to its actual refund day, even when payment was in an earlier period.
    if (refunded && inPeriod(order.refundedAt)) {
      refundedCount += 1;
      refundedAmountMinor += amount;
    }
    if (!inPeriod(order.paidAt)) continue;
    count += 1;
    amountMinor += amount;
    const title =
      typeof order.profession === 'string' && order.profession.trim()
        ? order.profession.trim().replace(/\s+/gu, ' ').slice(0, 500)
        : 'Профессия не указана';
    const key = title.toLocaleLowerCase('ru-RU');
    const group = groups.get(key) || { id: key, title, count: 0, amountMinor: 0 };
    group.count += 1;
    group.amountMinor += amount;
    groups.set(key, group);
  }

  return {
    count,
    amountMinor,
    refundedCount,
    refundedAmountMinor,
    netAmountMinor: amountMinor - refundedAmountMinor,
    averageMinor: count ? Math.round(amountMinor / count) : 0,
    uniqueProfessions: groups.size,
    items: [...groups.values()]
      .sort(
        (left, right) => right.count - left.count || left.title.localeCompare(right.title, 'ru'),
      )
      .slice(0, 10)
      .map((group, index) => ({ ...group, rank: index + 1, slug: null })),
  };
}
