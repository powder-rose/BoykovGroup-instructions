import fetch from "node-fetch";
import { buildGenerateInstructionPrompt, INSTRUCTION_SECTION_TEMPLATE } from "../prompts/generateInstructionPrompt.js";

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

/** Достаёт JSON из ответа модели, даже если он обёрнут в ```json ... ``` или содержит лишний текст вокруг. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Не удалось найти JSON в ответе модели");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Приводит распарсенный ответ модели к нашей внутренней схеме инструкции, подстраховываясь от неполных ответов. */
function normalizeInstructionPayload(payload, profession) {
  const sections = INSTRUCTION_SECTION_TEMPLATE.map((tpl) => {
    const fromModel = Array.isArray(payload.sections)
      ? payload.sections.find((s) => Number(s.number) === tpl.number)
      : null;
    const paragraphs =
      fromModel && Array.isArray(fromModel.paragraphs) && fromModel.paragraphs.length > 0
        ? fromModel.paragraphs.map(String)
        : [
            `${tpl.number}.1. Раздел «${tpl.heading.toLowerCase()}» будет дополнен после уточнения деталей по профессии «${profession}».`,
          ];
    return { number: tpl.number, heading: tpl.heading, paragraphs };
  });

  return {
    title: payload.title || `Инструкция по охране труда для ${profession}`,
    profession: payload.profession || profession,
    intro:
      payload.intro ||
      `Настоящая инструкция по охране труда разработана согласно правилам и нормативному акту организации для профессии «${profession}».`,
    sections,
  };
}

/**
 * Генерирует недостающую инструкцию через YandexGPT (Yandex Foundation Models).
 * Промпт вынесен в prompts/generateInstructionPrompt.js — редактируйте только его.
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

  const { system, user } = buildGenerateInstructionPrompt(profession);

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
        maxTokens: "2000",
      },
      messages: [
        { role: "system", text: system },
        { role: "user", text: user },
      ],
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

  const payload = extractJson(text);
  return normalizeInstructionPayload(payload, profession);
}
