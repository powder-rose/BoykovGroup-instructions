import cron from "node-cron";
import { runScheduledGeneration } from "../services/scheduledGenerationService.js";

// По умолчанию — раз в час (24 срабатывания в сутки, ~20-30 в требуемом
// диапазоне), каждое срабатывание добавляет одну новую инструкцию из очереди.
// Переопределяется через DAILY_GENERATION_CRON в server/.env (формат — обычное cron-выражение).
const DAILY_CRON_EXPRESSION = process.env.DAILY_GENERATION_CRON || "0 * * * *";

/** Запускает фоновое задание автогенерации: по умолчанию ~24 новые инструкции из очереди в сутки. */
export function startDailyGenerationJob() {
  if (!cron.validate(DAILY_CRON_EXPRESSION)) {
    console.error(
      `[авто-генерация] Некорректное cron-выражение DAILY_GENERATION_CRON="${DAILY_CRON_EXPRESSION}" — задание не запущено.`
    );
    return;
  }

  cron.schedule(DAILY_CRON_EXPRESSION, async () => {
    console.log("[авто-генерация] Запуск генерации инструкции по расписанию...");
    const result = await runScheduledGeneration();
    if (result.status === "skipped") {
      console.log(`[авто-генерация] Пропущено: ${result.reason}`);
    } else if (result.status === "error") {
      console.error(`[авто-генерация] Ошибка: ${result.reason}`);
    }
  });

  console.log(
    `[авто-генерация] Задание запланировано (cron: "${DAILY_CRON_EXPRESSION}"). ` +
      "Задание срабатывает, только пока процесс сервера запущен."
  );

  // Cron не срабатывает мгновенно при старте — он ждёт ближайшего момента
  // по расписанию, а это при интервале в час (и тем более при 2-3 фиксированных
  // часах в сутки) может быть далеко не сразу. Чтобы очередь начинала
  // пополняться сразу при запуске сервера, а не после ожидания первого
  // тика по расписанию, запускаем одну генерацию немедленно при старте —
  // дальше идёт по обычному cron-расписанию.
  console.log("[авто-генерация] Запуск стартовой генерации (не дожидаясь расписания)...");
  runScheduledGeneration()
    .then((result) => {
      if (result.status === "generated") {
        console.log(`[авто-генерация] Стартовая генерация: добавлена «${result.instruction.title}»`);
      } else if (result.status === "skipped") {
        console.log(`[авто-генерация] Стартовая генерация пропущена: ${result.reason}`);
      } else {
        console.error(`[авто-генерация] Ошибка стартовой генерации: ${result.reason}`);
      }
    })
    .catch((err) => {
      console.error("[авто-генерация] Необработанная ошибка стартовой генерации:", err);
    });
}