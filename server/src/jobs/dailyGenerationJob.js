import cron from 'node-cron';

import { runScheduledGeneration } from '../services/scheduledGenerationService.js';

const DAILY_CRON_EXPRESSION = process.env.DAILY_GENERATION_CRON || '0 * * * *';

export function startDailyGenerationJob() {
  if (!cron.validate(DAILY_CRON_EXPRESSION)) {
    console.error(`[ScheduledGeneration] Некорректный cron: "${DAILY_CRON_EXPRESSION}"`);

    return async () => {};
  }

  const activeRuns = new Set();

  async function runGeneration() {
    try {
      console.log('[ScheduledGeneration] Cron trigger');

      const result = await runScheduledGeneration();

      if (result.status === 'generated') {
        console.log(`[ScheduledGeneration] Создано: ${result.instruction.title}`);

        return;
      }

      if (result.status === 'skipped') {
        console.log(`[ScheduledGeneration] Пропуск: ${result.reason}`);

        return;
      }

      console.error(`[ScheduledGeneration] Ошибка: ${result.reason}`);
    } catch (error) {
      console.error('[ScheduledGeneration] Ошибка:', error);
    }
  }

  function startTrackedRun() {
    const promise = runGeneration();

    activeRuns.add(promise);

    promise.then(
      () => activeRuns.delete(promise),

      () => activeRuns.delete(promise),
    );

    return promise;
  }

  const task = cron.schedule(DAILY_CRON_EXPRESSION, () => {
    void startTrackedRun();
  });

  console.log(`[ScheduledGeneration] Cron зарегистрирован: "${DAILY_CRON_EXPRESSION}"`);

  return async () => {
    task.stop();

    while (activeRuns.size > 0) {
      await Promise.allSettled([...activeRuns]);
    }
  };
}
