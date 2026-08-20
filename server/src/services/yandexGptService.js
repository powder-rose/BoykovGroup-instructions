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
 *         
 *    (     200 , 
 *    ).    /  
 *  maxTokens   .
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
    throw new Error(`YandexGPT API   ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.result?.alternatives?.[0]?.message?.text;
  if (!text) {
    throw new Error("YandexGPT API   ");
  }
  return text;
}

/**  //        ( ### ... ###). */
function parseTitleIntroSection(text) {
  const titleMatch = text.match(/###\s*\s*###\s*([\s\S]*?)(?=###\s*\s*###)/i);
  const introMatch = text.match(/###\s*\s*###\s*([\s\S]*?)(?=###\s*\s*###)/i);
  const sectionMatch = text.match(/###\s*\s*###\s*([\s\S]*)$/i);

  return {
    title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null,
    intro: introMatch ? introMatch[1].trim().replace(/\s+/g, " ") : null,
    sectionText: sectionMatch ? sectionMatch[1].trim() : text.trim(),
  };
}

/**        N.M.          . */
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
    //         
    //    ,      .
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
 *   ,     messages ( ).
 *             ,
 *         ,   
 *   .
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
      text: `    ${paragraphs.length}    ${sectionDef.requiredCount}.   ${sectionDef.number} ,   ${sectionDef.requiredCount}  (    ),        ,  ,    ${sectionDef.number}.1. ,    .`,
    });

    try {
      const retryText = await callYandexGpt(messages, config, maxTokens);
      const retryParagraphs = parseSectionParagraphs(retryText, sectionDef.number);
      if (retryParagraphs.length > 0) {
        rawText = retryText;
        paragraphs = retryParagraphs;
      } else {
        console.warn(
          `[YandexGPT]  ${sectionDef.number}   "${profession}":     ,    (${paragraphs.length}).`
        );
      }
    } catch (err) {
      console.warn(
        `[YandexGPT]  ${sectionDef.number}   "${profession}":     ${sectionDef.requiredCount}  (: ${paragraphs.length}),   : ${err.message}`
      );
    }

    //          
    //       ,   .
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
 *     YandexGPT (Yandex Foundation Models).
 *    prompts/generateInstructionPrompt.js    .
 *
 *      ,  5   
 *    ,         
 *     200   17/10/14/13/11   
 *        it    .
 * .    prompts/generateInstructionPrompt.js.
 *
 * @param {string} profession
 * @returns {Promise<{title:string, profession:string, intro:string, sections:Array}>}
 */
export async function generateInstructionWithYandexGpt(profession) {
  const { apiKey, folderId, model } = getConfig();
  if (!apiKey || !folderId) {
    throw new Error(
      "YandexGPT  :  YANDEX_API_KEY  YANDEX_FOLDER_ID  server/.env"
    );
  }
  const config = { apiKey, folderId, model };

  const messages = [{ role: "system", text: buildSystemPrompt() }];

  let title = null;
  let intro = null;
  const sections = [];

    for (const sectionDef of SECTION_DEFINITIONS) {
    const includeTitleAndIntro = sectionDef.number === 1;
    const result = await generateSection(
      messages,
      config,
      profession,
      sectionDef,
      includeTitleAndIntro
    );

    if (includeTitleAndIntro) {
      title = result.title;
      intro = result.intro;
    }

    sections.push(result.section);
  }

  const professionGenitive = getProfessionGenitive(profession);

  return {
    title: `Инструкция по охране труда для ${professionGenitive}`,
    profession,
    intro:
     intro ||
`Инструкция по охране труда разработана для профессии ${profession}.`,
    sections,
  };
}