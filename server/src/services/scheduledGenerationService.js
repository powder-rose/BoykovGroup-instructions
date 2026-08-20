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
    if (id && !instructionsRepository.exists(id) && !isGenerationInFlight(id)) {
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
export async function runScheduledGeneration() {
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
      console.log(`[-]   : ${built.title}`);
      return built;
    });
    return { status: "generated", instruction };
  } catch (err) {
    console.error("[-]   :", err.message);
    return { status: "error", reason: err.message };
  }
}
