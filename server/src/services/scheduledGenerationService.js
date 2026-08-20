import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { instructionsRepository } from "./instructionsRepository.js";
import { generateInstructionWithYandexGpt, isYandexGptConfigured } from "./yandexGptService.js";
import { slugify } from "../utils/slug.js";
import { runExclusive, isGenerationInFlight } from "./generationLock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_PATH = path.join(__dirname, "..", "data", "professionQueue.json");

/**
 * Список профессий-кандидатов для автогенерации — server/src/data/professionQueue.json.
 * Можно свободно редактировать/дополнять файл, перезапуск сервера не требуется —
 * очередь перечитывается перед каждым запуском генерации.
 */
function loadQueue() {
  try {
    const raw = fs.readFileSync(QUEUE_PATH, "utf-8");
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("Не удалось прочитать очередь профессий для автогенерации:", err.message);
    return [];
  }
}

/**
 * Находит первую профессию из очереди, для которой в базе ещё нет инструкции
 * и для которой прямо сейчас не идёт генерация (см. generationLock.js) —
 * иначе при пересечении по времени с ручной генерацией той же профессии
 * очередь выбрала бы её же ещё раз.
 */
function pickNextProfession() {
  const queue = loadQueue();
  for (const profession of queue) {
    const id = slugify(profession);
    if (id && !instructionsRepository.exists(id) && !isGenerationInFlight(id)) {
      return { profession, id };
    }
  }
  return null;
}

/**
 * Генерирует через YandexGPT одну очередную инструкцию из очереди и сохраняет её.
 * Используется и ежедневным планировщиком (jobs/dailyGenerationJob.js), и ручным
 * запуском из панели администратора (POST /api/instructions/run-scheduled-generation) —
 * оба места вызывают ровно эту функцию, чтобы поведение не расходилось.
 *
 * @returns {Promise<
 *   | { status: "generated", instruction: object }
 *   | { status: "skipped", reason: string }
 *   | { status: "error", reason: string }
 * >}
 */
export async function runScheduledGeneration() {
  if (!isYandexGptConfigured()) {
    return {
      status: "skipped",
      reason: "YandexGPT не настроен на сервере (нет YANDEX_API_KEY/YANDEX_FOLDER_ID)",
    };
  }

  const next = pickNextProfession();
  if (!next) {
    return {
      status: "skipped",
      reason: "Очередь профессий пуста — инструкции для всех профессий из списка уже созданы",
    };
  }

  try {
    const instruction = await runExclusive(next.id, async () => {
      // Пока эта генерация ждала своей очереди (маловероятно, но на всякий
      // случай), инструкцию мог успеть сохранить кто-то другой — например,
      // админ вручную сгенерировал ту же профессию. Тогда просто используем
      // готовый результат, не генерируя второй раз.
      const alreadySaved = instructionsRepository.getById(next.id);
      if (alreadySaved) return alreadySaved;

      const generated = await generateInstructionWithYandexGpt(next.profession);
      const built = {
        id: next.id,
        title: generated.title,
        profession: generated.profession,
        intro: generated.intro,
        sections: generated.sections,
        source: "generated",
        generatedBy: "schedule",
        createdAt: new Date().toISOString(),
      };
      instructionsRepository.save(built);
      console.log(`[авто-генерация] Добавлена новая инструкция: «${built.title}»`);
      return built;
    });
    return { status: "generated", instruction };
  } catch (err) {
    console.error("[авто-генерация] Ошибка генерации инструкции:", err.message);
    return { status: "error", reason: err.message };
  }
}