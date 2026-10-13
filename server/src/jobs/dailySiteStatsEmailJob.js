import cron from 'node-cron';

import { sendDailySiteStatsEmailIfDue } from '../services/siteStatsEmailService.js';

const CRON_EXPRESSION = process.env.DAILY_STATS_CRON || '0 * * * *';

const TIMEZONE = 'Europe/Moscow';

async function runDailySiteStats() {
  try {
    const result = await sendDailySiteStatsEmailIfDue();

    console.log('[DailySiteStats]', result.status, result.reason || '');
  } catch (error) {
    console.error('[DailySiteStats] Error:', error);
  }
}

export function startDailySiteStatsEmailJob() {
  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(`[DailySiteStats] Invalid cron: "${CRON_EXPRESSION}"`);

    return async () => {};
  }

  const activeRuns = new Set();

  function startTrackedRun() {
    const promise = runDailySiteStats();

    activeRuns.add(promise);

    promise.then(
      () => activeRuns.delete(promise),

      () => activeRuns.delete(promise),
    );

    return promise;
  }

  const task = cron.schedule(
    CRON_EXPRESSION,
    () => {
      void startTrackedRun();
    },
    {
      timezone: TIMEZONE,
    },
  );

  const startupTimer = setTimeout(() => {
    void startTrackedRun();
  }, 5000);

  console.log(`[DailySiteStats] Cron registered: "${CRON_EXPRESSION}", timezone=${TIMEZONE}`);

  return async () => {
    clearTimeout(startupTimer);

    task.stop();

    while (activeRuns.size > 0) {
      await Promise.allSettled([...activeRuns]);
    }
  };
}
