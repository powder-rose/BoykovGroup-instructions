import {
  acquireScheduledGenerationLock,
  releaseScheduledGenerationLock,
  startScheduledGenerationLockHeartbeat,
} from './scheduledGenerationFileLock.js';

import {
  isAutoGenerationEnabled
} from "./autoGenerationSettingsService.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { instructionsRepository } from "./instructionsRepository.js";
import { saveInstructionWithTaxonomy } from "./instructionTaxonomyPersistence.js";
import { generateInstructionWithYandexGpt, isYandexGptConfigured } from "./yandexGptService.js";
import { slugify } from "../utils/slug.js";
import { runExclusive, isGenerationInFlight } from "./generationLock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_PATH = path.join(__dirname, "..", "data", "professionQueue.json");

/**
 *  -    server/src/data/professionQueue.json.
 *   / ,     
 *      .
 */
function loadQueue() {
  try {
    const raw = fs.readFileSync(QUEUE_PATH, "utf-8");
    const list = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("      :", err.message);
    return [];
  }
}

/**
 *     ,       
 *         (. generationLock.js) 
 *           
 *       .
 */
function pickNextProfession() {
  const queue = loadQueue();
  for (const profession of queue) {
    const id = slugify(profession);
    if (id && !instructionsRepository.getBySlug(id) && !isGenerationInFlight(id)) {
      return { profession, id };
    }
  }
  return null;
}

/**
 *   YandexGPT        .
 *     (jobs/dailyGenerationJob.js),  
 *     (POST /api/instructions/run-scheduled-generation) 
 *      ,    .
 *
 * @returns {Promise<
 *   | { status: "generated", instruction: object }
 *   | { status: "skipped", reason: string }
 *   | { status: "error", reason: string }
 * >}
 */
async function runScheduledGenerationCore(
  options = {}
) {

  const force =
    options?.force === true;

  if (
    !force &&
    !isAutoGenerationEnabled()
  ) {
    return {
      status: "skipped",
      reason:
        "Автогенерация остановлена администратором"
    };
  }

  if (!isYandexGptConfigured()) {
    return {
      status: "skipped",
      reason: "YandexGPT     ( YANDEX_API_KEY/YANDEX_FOLDER_ID)",
    };
  }

  const next = pickNextProfession();
  if (!next) {
    return {
      status: "skipped",
      reason: "           ",
    };
  }

  try {
    const instruction = await runExclusive(next.id, async () => {
      //       (,   
      // ),     -   ,
      //      .   
      //  ,    .
      const alreadySaved = instructionsRepository.getBySlug(next.id);
      if (alreadySaved) return alreadySaved;

      const generated =
        await generateInstructionWithYandexGpt(
          next.profession,
          {
            source: "schedule"
          }
        );
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
      const saved = saveInstructionWithTaxonomy(instructionsRepository, built);
      console.log(`[-]   : ${built.title}`);
      return saved;
    });
    return { status: "generated", instruction };
  } catch (err) {
    console.error("[-]   :", err.message);
    return { status: "error", reason: err.message };
  }
}



export async function runScheduledGeneration(
  options = {}
) {

  const lock =
    acquireScheduledGenerationLock();


  if (!lock.acquired) {

    const owner =
      lock.existing?.pid
        ? ` PID ${lock.existing.pid}`
        : "";

    console.log(
      `[ScheduledGeneration] Пропуск: генерация уже выполняется другим процессом.${owner}`
    );

    return {
      status: "skipped",
      reason:
        "Автогенерация уже выполняется в другом процессе"
    };
  }


  const stopHeartbeat =
    startScheduledGenerationLockHeartbeat(
      lock,
    );

  try {

    return await runScheduledGenerationCore(
      options
    );

  }
  finally {

    stopHeartbeat();

    releaseScheduledGenerationLock(
      lock,
    );
  }
}
