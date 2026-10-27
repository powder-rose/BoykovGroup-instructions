import { fiscalError, getFiscalConfiguration } from './fiscalReceiptPayload.js';

// CloudKassir keeps X-Request-ID results for one hour. Leave a ten-minute safety margin.
const SAFE_RETRY_MS = 50 * 60 * 1000;
const INTERVAL_MS = 15000;

export function createFiscalReceiptWorker({
  repository,
  api,
  getEvents,
  configuration = getFiscalConfiguration,
  clock = Date.now,
  logger = console,
  intervalMs = INTERVAL_MS,
}) {
  let timer = null;
  let active = null;
  let controller = null;
  let stopped = false;

  async function processEvent(event, signal, config) {
    const previous = repository.read(event.id);
    if (
      previous?.status === 'processed' ||
      previous?.status === 'review' ||
      Number(previous?.nextAttemptAt || 0) > clock()
    )
      return;
    await repository.withEvent(event, async (entry, save) => {
      if (
        entry.status === 'processed' ||
        entry.status === 'review' ||
        Number(entry.nextAttemptAt || 0) > clock() ||
        signal.aborted
      )
        return;
      const review = (reason, providerCode = null) => {
        entry.status = 'review';
        entry.lastError = reason;
        entry.providerCode = providerCode;
        save(entry);
        logger.error('[FiscalReceipt] review required', event.id, reason);
      };
      if (event.publicId !== config.publicId) return review('FISCAL_TERMINAL_CHANGED');
      if (event.reviewReason) return review(event.reviewReason);
      if (entry.status !== 'submitted') {
        if (event.dependsOn.some(id => repository.read(id)?.status !== 'processed')) return;
        if (
          entry.firstAttemptAt !== undefined &&
          (clock() < entry.firstAttemptAt || clock() - entry.firstAttemptAt >= SAFE_RETRY_MS)
        )
          return review('FISCAL_AMBIGUOUS_RESULT');
        entry.firstAttemptAt ??= clock();
        entry.attempts += 1;
        entry.status = 'sending';
        save(entry);
      }
      try {
        if (entry.status === 'submitted') {
          const result = await api.status(entry.receiptId, signal);
          if (result.Model === 'Processed') {
            entry.status = 'processed';
            entry.processedAt = new Date(clock()).toISOString();
            entry.lastError = null;
          } else if (result.Model === 'Error' || result.Model === 'NotFound') {
            return review(`FISCAL_STATUS_${result.Model.toUpperCase()}`);
          } else if (result.Model !== 'Queued') throw fiscalError('FISCAL_RESPONSE_INVALID');
        } else {
          const result = await api.create(event.payload, event.id, signal);
          const receiptId = result.Model?.Id;
          if (typeof receiptId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/u.test(receiptId))
            throw fiscalError('FISCAL_RESPONSE_INVALID');
          entry.receiptId = receiptId;
          entry.status = 'submitted';
          entry.lastError = null;
        }
        entry.nextAttemptAt = clock() + INTERVAL_MS;
        save(entry);
      } catch (error) {
        if (error.permanent)
          return review(error.code || 'FISCAL_REQUEST_REJECTED', error.providerCode);
        if (entry.status === 'sending') entry.status = 'pending';
        entry.lastError = 'FISCAL_RETRY_PENDING';
        entry.nextAttemptAt = clock() + Math.min(60000, INTERVAL_MS * Math.max(1, entry.attempts));
        save(entry);
      }
    });
  }
  async function run(signal) {
    const config = configuration();
    if (!config) return;
    const events = getEvents().sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    const seen = new Set();
    for (const event of events) {
      if (signal.aborted) break;
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      try {
        await processEvent(event, signal, config);
      } catch (error) {
        logger.error(
          '[FiscalReceipt] storage error',
          event.id,
          error.code || 'FISCAL_STORAGE_INVALID',
        );
      }
    }
  }
  function tick() {
    if (stopped) return Promise.resolve();
    if (active) return active;
    controller = new AbortController();
    active = run(controller.signal)
      .catch(error =>
        logger.error('[FiscalReceipt] worker error', error.code || 'FISCAL_SOURCE_UNAVAILABLE'),
      )
      .finally(() => {
        active = null;
        controller = null;
      });
    return active;
  }
  return {
    tick,
    start() {
      if (timer || !configuration()) return;
      stopped = false;
      void tick();
      timer = setInterval(() => {
        void tick();
      }, intervalMs);
      timer.unref?.();
    },
    async stop() {
      stopped = true;
      clearInterval(timer);
      timer = null;
      controller?.abort();
      await active;
    },
  };
}
