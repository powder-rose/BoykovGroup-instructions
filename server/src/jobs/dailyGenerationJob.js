import cron from "node-cron";
import { runScheduledGeneration } from "../services/scheduledGenerationService.js";

// По умолчанию — 3 раза в сутки (03:00, 11:00, 19:00 по времени сервера),
// каждое срабатывание добавляет одну новую инструкцию из очереди.
// Переопределяется через DAILY_GENERATION_CRON в server/.env (формат — обычное cron-выражение).
const DAILY_CRON_EXPRESSION = process.env.DAILY_GENERATION_CRON || "0 3,11,19 * * *";

/** Запускает фоновое задание автогенерации: по умолчанию 3 новые инструкции из очереди в сутки. */
export function startDailyGenerationJob() {
  if (!cron.validate(DAILY_CRON_EXPRESSION)) {
    console.error(
      `[авто-генерация] Некорректное cron-выражение DAILY_GENERATION_CRON="${DAILY_CRON_EXPRESSION}" — задание не запущено.`
    );
    return;
  }

  cron.schedule(DAILY_CRON_EXPRESSION, async () => {
    console.log("[авто-генерация] Запуск ежедневной генерации инструкции по расписанию...");
    const result = await runScheduledGeneration();
    if (result.status === "skipped") {
      console.log(`[авто-генерация] Пропущено: ${result.reason}`);
    } else if (result.status === "error") {
      console.error(`[авто-генерация] Ошибка: ${result.reason}`);
    }
  });

  console.log(
    `[авто-генерация] Ежедневное задание запланировано (cron: "${DAILY_CRON_EXPRESSION}"). ` +
      "Задание срабатывает, только пока процесс сервера запущен."
  );
}
