import { readDownloadEvents } from './downloadStatsService.js';
import { instructionsRepository } from './instructionsRepository.js';
import { walletRepository } from './walletRepository.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = { today: 1, '7d': 7, '30d': 30 };
const PERIODS = new Set(['total', ...Object.keys(PERIOD_DAYS)]);
const moscowFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dayKey(value) {
  const parts = Object.fromEntries(
    moscowFormatter
      .formatToParts(value)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function acceptedDate(value, maxTimestamp) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= maxTimestamp ? timestamp : null;
}

function safeTitle(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : fallback;
}

function ranking(groups, getInstruction, kind) {
  return [...groups.values()]
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title, 'ru'))
    .slice(0, 10)
    .map((group, index) => {
      const instruction = getInstruction(group.id);
      const isPublished =
        instruction &&
        String(instruction.status || '').toLowerCase() !== 'draft' &&
        String(instruction.seoStatus || '').toLowerCase() !== 'draft';
      const title = isPublished ? safeTitle(instruction.title, group.title) : group.title;
      return {
        rank: index + 1,
        id: group.id,
        title,
        slug: isPublished ? instruction.slug || instruction.id : null,
        count: group.count,
        ...(kind === 'purchases'
          ? { amountMinor: group.amountMinor }
          : { free: group.free, paid: group.paid, uniqueDownloaders: group.downloaders.size }),
      };
    });
}

/** A privacy-safe report: no customer IDs, hashes, order objects or PDF snapshots. */
export function summarizeCommerceStats({
  period = 'total',
  purchaseEvents = [],
  downloadEvents = [],
  getInstruction = () => null,
  now = new Date(),
} = {}) {
  const normalizedPeriod = PERIODS.has(period) ? period : 'total';
  const nowTimestamp = new Date(now).getTime();
  if (!Number.isFinite(nowTimestamp)) throw new TypeError('Invalid report date');
  const allowedDays =
    normalizedPeriod === 'total'
      ? null
      : new Set(
          Array.from({ length: PERIOD_DAYS[normalizedPeriod] }, (_, index) =>
            dayKey(new Date(nowTimestamp - index * DAY_MS)),
          ),
        );
  const inPeriod = value => {
    const timestamp = acceptedDate(value, nowTimestamp);
    return timestamp !== null && (!allowedDays || allowedDays.has(dayKey(timestamp)));
  };

  const purchaseGroups = new Map();
  let purchaseCount = 0;
  let purchaseAmountMinor = 0;
  for (const purchase of purchaseEvents) {
    const id = purchase?.instructionId;
    const amount = purchase?.amountMinor;
    if (
      typeof id !== 'string' ||
      !id ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      !inPeriod(purchase.createdAt)
    )
      continue;
    purchaseCount += 1;
    purchaseAmountMinor += amount;
    const group = purchaseGroups.get(id) || {
      id,
      title: safeTitle(purchase.title, id),
      count: 0,
      amountMinor: 0,
    };
    group.count += 1;
    group.amountMinor += amount;
    purchaseGroups.set(id, group);
  }

  const downloadGroups = new Map();
  const downloaders = new Set();
  let downloadCount = 0;
  let freeCount = 0;
  let paidCount = 0;
  let trackingStarted = null;
  for (const event of downloadEvents) {
    const id = event?.instructionId;
    if (typeof id !== 'string' || !id || acceptedDate(event.ts, nowTimestamp) === null) continue;
    if (trackingStarted === null || event.ts < trackingStarted) trackingStarted = event.ts;
    if (!inPeriod(event.ts)) continue;
    const paid = event.kind === 'paid';
    downloadCount += 1;
    if (paid) paidCount += 1;
    else freeCount += 1; // Legacy events without `kind` were free downloads.
    if (typeof event.downloader === 'string' && event.downloader) {
      downloaders.add(event.downloader);
    }
    const group = downloadGroups.get(id) || {
      id,
      title: safeTitle(event.title, id),
      count: 0,
      free: 0,
      paid: 0,
      downloaders: new Set(),
    };
    group.count += 1;
    if (paid) group.paid += 1;
    else group.free += 1;
    if (typeof event.downloader === 'string' && event.downloader) {
      group.downloaders.add(event.downloader);
    }
    downloadGroups.set(id, group);
  }

  return {
    period: normalizedPeriod,
    generatedAt: new Date(nowTimestamp).toISOString(),
    purchases: {
      count: purchaseCount,
      amountMinor: purchaseAmountMinor,
      uniqueInstructions: purchaseGroups.size,
      averageMinor: purchaseCount ? Math.round(purchaseAmountMinor / purchaseCount) : 0,
      items: ranking(purchaseGroups, getInstruction, 'purchases'),
    },
    downloads: {
      count: downloadCount,
      free: freeCount,
      paid: paidCount,
      uniqueDownloaders: downloaders.size,
      trackingStarted,
      items: ranking(downloadGroups, getInstruction, 'downloads'),
    },
  };
}

export function getCommerceStats({ period = 'total' } = {}) {
  let downloadEvents;
  try {
    downloadEvents = readDownloadEvents();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    downloadEvents = [];
  }
  return summarizeCommerceStats({
    period,
    purchaseEvents: walletRepository.listAdminPurchases(),
    downloadEvents,
    getInstruction: id => instructionsRepository.getById(id),
  });
}
