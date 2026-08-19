import fetch from "node-fetch";
import {
  SECTION_DEFINITIONS,
  buildSystemPrompt,
  buildSectionUserPrompt,
} from "../prompts/generateInstructionPrompt.js";
import { getProfessionGenitive } from "../utils/professionGenitive.js";

const YANDEX_GPT_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

function getConfig() {
  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;
  const model = process.env.YANDEX_GPT_MODEL || "yandexgpt/latest";
  return { apiKey, folderId, model };
}

export function isYandexGptConfigured() {
  const { apiKey, folderId } = getConfig();
  return Boolean(apiKey && folderId);
}

/**
 * Примерный лимит токенов ответа под конкретный раздел — пропорционально
 * числу требуемых пунктов (по промпту каждый пункт ≥ 200 символов, реальный
 * текст обычно заметно длиннее). Если у вашей модели/тарифа другой предел
 * на maxTokens — поправьте здесь.
 */
function estimateMaxTokens(requiredCount) {
  return String(Math.min(8000, 300 * requiredCount + 500));
}

async function callYandexGpt(messages, { apiKey, folderId, model }, maxTokens) {
  const response = await fetch(YANDEX_GPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${apiKey}`,
      "x-folder-id": folderId,
    },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/${model}`,
      completionOptions: {
        stream: false,
        temperature: 0.3,
        maxTokens,
      },
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`YandexGPT API вернул ошибку ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.result?.alternatives?.[0]?.message?.text;
  if (!text) {
    throw new Error("YandexGPT API вернул пустой ответ");
  }
  return text;
}

/** Достаёт название/введение/текст раздела из ответа на запрос первого раздела (метки ### ... ###). */
function parseTitleIntroSection(text) {
  const titleMatch = text.match(/###\s*НАЗВАНИЕ\s*###\s*([\s\S]*?)(?=###\s*ВВЕДЕНИЕ\s*###)/i);
  const introMatch = text.match(/###\s*ВВЕДЕНИЕ\s*###\s*([\s\S]*?)(?=###\s*РАЗДЕЛ\s*###)/i);
  const sectionMatch = text.match(/###\s*РАЗДЕЛ\s*###\s*([\s\S]*)$/i);

  return {
    title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null,
    intro: introMatch ? introMatch[1].trim().replace(/\s+/g, " ") : null,
    sectionText: sectionMatch ? sectionMatch[1].trim() : text.trim(),
  };
}

/** Разбивает текст раздела на пункты по меткам «N.M.» в начале строки — сами метки остаются в тексте пункта. */
function parseSectionParagraphs(text, sectionNumber) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const markerRegex = new RegExp(`(?:^|\\n)[ \\t]*(${sectionNumber}\\.\\d+\\.)`, "g");
  const markerStarts = [];
  let match;
  while ((match = markerRegex.exec(normalized)) !== null) {
    markerStarts.push(match.index + match[0].indexOf(match[1]));
  }

  if (markerStarts.length === 0) {
    // Модель не проставила номера пунктов — подстраховываемся и возвращаем
    // весь текст одним пунктом, чтобы хотя бы не потерять содержание.
    return [normalized.replace(/\s+/g, " ")];
  }

  const paragraphs = [];
  for (let i = 0; i < markerStarts.length; i++) {
    const start = markerStarts[i];
    const end = i + 1 < markerStarts.length ? markerStarts[i + 1] : normalized.length;
    const chunk = normalized.slice(start, end).trim().replace(/\s+/g, " ");
    if (chunk) paragraphs.push(chunk);
  }
  return paragraphs;
}

/**
 * Генерирует один раздел, накапливая историю диалога в messages (мутирует массив).
 * Если число пунктов не совпало с требуемым — даёт модели один шанс исправиться,
 * а служебные сообщения об исправлении из истории потом убирает, чтобы не раздувать
 * контекст следующих разделов.
 */
async function generateSection(messages, config, profession, sectionDef, includeTitleAndIntro) {
  const userPrompt = buildSectionUserPrompt(profession, sectionDef, { includeTitleAndIntro });
  messages.push({ role: "user", text: userPrompt });

  const maxTokens = estimateMaxTokens(sectionDef.requiredCount);
  let rawText = await callYandexGpt(messages, config, maxTokens);

  let title = null;
  let intro = null;
  let sectionText = rawText;

  if (includeTitleAndIntro) {
    const parsed = parseTitleIntroSection(rawText);
    title = parsed.title;
    intro = parsed.intro;
    sectionText = parsed.sectionText;
  }

  let paragraphs = parseSectionParagraphs(sectionText, sectionDef.number);

  if (paragraphs.length !== sectionDef.requiredCount) {
    const beforeRetryLength = messages.length;
    messages.push({ role: "assistant", text: rawText });
    messages.push({
      role: "user",
      text: `В твоём ответе получилось ${paragraphs.length} пунктов вместо требуемых ${sectionDef.requiredCount}. Пришли раздел ${sectionDef.number} ЗАНОВО, строго с ${sectionDef.requiredCount} пунктами (не больше и не меньше), в том же формате — без заголовка раздела, без пояснений, только пункты вида «${sectionDef.number}.1. текст», каждый с новой строки.`,
    });

    try {
      const retryText = await callYandexGpt(messages, config, maxTokens);
      const retryParagraphs = parseSectionParagraphs(retryText, sectionDef.number);
      if (retryParagraphs.length > 0) {
        rawText = retryText;
        paragraphs = retryParagraphs;
      } else {
        console.warn(
          `[YandexGPT] Раздел ${sectionDef.number} для профессии "${profession}": повтор тоже не дал пунктов, оставляю как есть (${paragraphs.length}).`
        );
      }
    } catch (err) {
      console.warn(
        `[YandexGPT] Раздел ${sectionDef.number} для профессии "${profession}": не удалось получить ровно ${sectionDef.requiredCount} пунктов (итог: ${paragraphs.length}), повтор не удался: ${err.message}`
      );
    }

    // Убираем служебную переписку про «исправь количество» из истории диалога —
    // дальше в ней должен остаться только финальный, принятый вариант раздела.
    messages.splice(beforeRetryLength, messages.length - beforeRetryLength);
  }

  messages.push({ role: "assistant", text: rawText });

  return {
    title,
    intro,
    section: { number: sectionDef.number, heading: sectionDef.heading, paragraphs },
  };
}

/**
 * Генерирует недостающую инструкцию через YandexGPT (Yandex Foundation Models).
 * Промпт вынесен в prompts/generateInstructionPrompt.js — редактируйте только его.
 *
 * В отличие от обычного одного запроса, здесь 5 последовательных запросов —
 * по одному на раздел, с накоплением истории диалога — потому что при строгом
 * требовании «каждый пункт ≥ 200 символов» и 17/10/14/13/11 пунктов на разделы
 * весь документ целиком может не влезть в лимit токенов одного ответа модели.
 * См. комментарий в начале prompts/generateInstructionPrompt.js.
 *
 * @param {string} profession
 * @returns {Promise<{title:string, profession:string, intro:string, sections:Array}>}
 */
export async function generateInstructionWithYandexGpt(profession) {
  const { apiKey, folderId, model } = getConfig();
  if (!apiKey || !folderId) {
    throw new Error(
      "YandexGPT не настроен: задайте YANDEX_API_KEY и YANDEX_FOLDER_ID в server/.env"
    );
  }
  const config = { apiKey, folderId, model };

  const messages = [{ role: "system", text: buildSystemPrompt() }];

  let title = null;
  let intro = null;
  const sections = [];

  for (const sectionDef of SECTION_DEFINITIONS) {
    const includeTitleAndIntro = sectionDef.number === 1;
    const result = await generateSection(messages, config, profession, sectionDef, includeTitleAndIntro);
    if (includeTitleAndIntro) {
      title = result.title;
      intro = result.intro;
    }
    sections.push(result.section);
  }

  // Название всегда строим сами, а не берём то, что вернула модель:
  // склонение профессии в родительном падеже YandexGPT даёт не всегда
  // надёжно (например, может оставить «для электромонтёр» вместо
  // «для электромонтёра»), а getProfessionGenitive — точный словарь для
  // всей очереди автогенерации плюс эвристика для остальных случаев —
  // гарантированно грамматически верно. См. utils/professionGenitive.js.
  const professionGenitive = getProfessionGenitive(profession);

  return {
    title: `Инструкция по охране труда для ${professionGenitive}`,
    profession,
    intro:
      intro ||
      `Настоящая инструкция по охране труда разработана согласно правилам и нормативному акту организации для профессии «${profession}».`,
    sections,
  };
}
