import { buildInstructionIntro } from '../utils/instructionIntro.js';
import fetch from 'node-fetch';
import {
  SECTION_DEFINITIONS,
  buildSystemPrompt,
  buildSectionUserPrompt,
} from '../prompts/generateInstructionPrompt.js';
import { getProfessionGenitive } from '../utils/professionGenitive.js';

import { createGenerationUsageId, recordGenerationUsageCall } from './generationUsageService.js';

const YANDEX_GPT_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

function getConfig() {
  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;
  const model = process.env.YANDEX_GPT_MODEL || 'yandexgpt/latest';
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

async function callYandexGpt(messages, { apiKey, folderId, model }, maxTokens, usageMeta = {}) {
  const response = await fetch(YANDEX_GPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${apiKey}`,
      'x-folder-id': folderId,
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
    const errText = await response.text().catch(() => '');
    throw new Error(`YandexGPT API   ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.result?.alternatives?.[0]?.message?.text;
  if (!text) {
    throw new Error('YandexGPT API   ');
  }

  recordGenerationUsageCall({
    generationId: usageMeta.generationId,

    profession: usageMeta.profession,

    model,

    sectionNumber: usageMeta.sectionNumber,

    attempt: usageMeta.attempt,

    usage: data?.result?.usage,
  });

  return text;
}

/**  //        ( ### ... ###). */
function parseTitleIntroSection(text) {
  const titleMatch = text.match(/###\s*\s*###\s*([\s\S]*?)(?=###\s*\s*###)/i);
  const introMatch = text.match(/###\s*\s*###\s*([\s\S]*?)(?=###\s*\s*###)/i);
  const sectionMatch = text.match(/###\s*\s*###\s*([\s\S]*)$/i);

  return {
    title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null,
    intro: introMatch ? introMatch[1].trim().replace(/\s+/g, ' ') : null,
    sectionText: sectionMatch ? sectionMatch[1].trim() : text.trim(),
  };
}

/**        N.M.          . */
function parseSectionParagraphs(text, sectionNumber) {
  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!normalized) return [];

  /*
   * Защитный режим.
   *
   * Если модель вопреки prompt вернула JSON:
   *
   * {
   *   "sections": [
   *     {
   *       "number": 1,
   *       "paragraphs": [...]
   *     }
   *   ]
   * }
   *
   * извлекаем paragraphs вместо сохранения всего JSON как текста.
   */
  try {
    let jsonCandidate = normalized;

    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fencedMatch) {
      jsonCandidate = fencedMatch[1].trim();
    } else {
      const firstBrace = normalized.indexOf('{');
      const lastBrace = normalized.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonCandidate = normalized.slice(firstBrace, lastBrace + 1);
      }
    }

    if (jsonCandidate.startsWith('{')) {
      const parsed = JSON.parse(jsonCandidate);

      let section = null;

      if (Array.isArray(parsed.sections)) {
        section =
          parsed.sections.find(item => Number(item?.number) === Number(sectionNumber)) ??
          parsed.sections[0] ??
          null;
      } else if (Array.isArray(parsed.paragraphs)) {
        section = parsed;
      }

      if (section && Array.isArray(section.paragraphs)) {
        const paragraphs = section.paragraphs
          .map(paragraph =>
            String(paragraph ?? '')
              .trim()
              .replace(/\s+/g, ' '),
          )
          .filter(Boolean);

        if (paragraphs.length > 0) {
          console.warn(
            `[YandexGPT] Раздел ${sectionNumber} пришёл как JSON; paragraphs восстановлены автоматически.`,
          );

          return paragraphs;
        }
      }
    }
  } catch (err) {
    // Это нормально: основной ожидаемый формат — обычный текст.
  }

  /*
   * Основной формат:
   *
   * 1.1. Первый пункт
   * 1.2. Второй пункт
   * ...
   */
  const markerRegex = new RegExp(`(?:^|\\n)[ \\t]*(${sectionNumber}\\.\\d+\\.)`, 'g');

  const markerStarts = [];

  let match;

  while ((match = markerRegex.exec(normalized)) !== null) {
    markerStarts.push(match.index + match[0].indexOf(match[1]));
  }

  if (markerStarts.length === 0) {
    return [];
  }

  const paragraphs = [];

  for (let i = 0; i < markerStarts.length; i++) {
    const start = markerStarts[i];

    const end = i + 1 < markerStarts.length ? markerStarts[i + 1] : normalized.length;

    const chunk = normalized.slice(start, end).trim().replace(/\s+/g, ' ');

    if (chunk) {
      paragraphs.push(chunk);
    }
  }

  return paragraphs;
}

/*
 * STRICT_GENERATED_SECTION_VALIDATION_V1
 *
 * Правило применяется только к AI-генерации.
 * Загружаемые готовые инструкции этим валидатором
 * не затрагиваются.
 */
const MIN_GENERATED_PARAGRAPH_CHARS = 200;
const MAX_SECTION_GENERATION_ATTEMPTS = 3;

function validateGeneratedSection(paragraphs, sectionDef) {
  const issues = [];

  if (!Array.isArray(paragraphs)) {
    return ['PARAGRAPHS_NOT_ARRAY'];
  }

  if (paragraphs.length !== sectionDef.requiredCount) {
    issues.push(`COUNT:${paragraphs.length}/${sectionDef.requiredCount}`);
  }

  for (let index = 0; index < sectionDef.requiredCount; index += 1) {
    const paragraph = String(paragraphs[index] ?? '')
      .replace(/\s+/gu, ' ')
      .trim();

    const expectedPrefix = `${sectionDef.number}.${index + 1}.`;

    if (!paragraph.startsWith(expectedPrefix)) {
      issues.push(`${expectedPrefix} NUMBERING`);

      continue;
    }

    const body = paragraph.slice(expectedPrefix.length).trim();

    if (body.length < MIN_GENERATED_PARAGRAPH_CHARS) {
      issues.push(`${expectedPrefix} LENGTH:${body.length}`);
    }
  }

  return issues;
}

function buildStrictRetryPrompt(sectionDef, issues) {
  return `
Предыдущий ответ НЕ соответствует обязательным требованиям.

Обнаруженные нарушения:
${issues.join('; ')}

Перепиши ВЕСЬ текущий раздел заново.

Требуется СТРОГО ${sectionDef.requiredCount} подпунктов:
от ${sectionDef.number}.1 до ${sectionDef.number}.${sectionDef.requiredCount}.

Каждый подпункт должен содержать НЕ МЕНЕЕ ${MIN_GENERATED_PARAGRAPH_CHARS} СИМВОЛОВ содержательного текста после номера.

Не пропускай номера.
Не объединяй пункты.
Не добавляй дополнительные пункты.
Не используй вложенные списки.
Не сокращай последние пункты.

Верни весь раздел полностью заново и только его подпункты.
`;
}

/* TARGETED_PARAGRAPH_REPAIR_V4 */
async function tryTargetedParagraphRepair(
  paragraphs,
  issues,
  config,
  profession,
  sectionDef,
  generationId,
  sectionAttempt,
) {
  if (
    !Array.isArray(paragraphs) ||
    paragraphs.length !== sectionDef.requiredCount ||
    !Array.isArray(issues) ||
    issues.length === 0
  ) {
    return null;
  }

  const lengthMarker = ' LENGTH:';
  const sectionPrefix = `${sectionDef.number}.`;
  const indexes = [];

  for (const issue of issues) {
    const issueText = String(issue ?? '').trim();

    const markerPosition = issueText.indexOf(lengthMarker);

    if (markerPosition === -1) {
      return null;
    }

    const numberPart = issueText.slice(0, markerPosition).trim();

    if (!numberPart.startsWith(sectionPrefix) || !numberPart.endsWith('.')) {
      return null;
    }

    const subsectionText = numberPart.slice(sectionPrefix.length, -1);

    const subsectionNumber = Number(subsectionText);

    if (
      !Number.isInteger(subsectionNumber) ||
      subsectionNumber < 1 ||
      subsectionNumber > sectionDef.requiredCount
    ) {
      return null;
    }

    indexes.push(subsectionNumber - 1);
  }

  const uniqueIndexes = [...new Set(indexes)];

  if (uniqueIndexes.length === 0) {
    return null;
  }

  const tasks = uniqueIndexes
    .map(index => {
      const prefix = `${sectionDef.number}.${index + 1}.`;

      return [
        `ПОДПУНКТ ${prefix}`,
        `Требование: ${String(sectionDef.checklist[index] ?? '').trim()}`,
        `Текущий короткий текст: ${String(paragraphs[index] ?? '')
          .split(/\s+/u)
          .join(' ')
          .trim()}`,
      ].join('\n');
    })
    .join('\n\n');

  const repairMessages = [
    {
      role: 'system',
      text:
        'Исправь только перечисленные подпункты инструкции по охране труда. ' +
        'Сохрани исходные номера. Пиши профессиональным официально-деловым русским языком. ' +
        'Не добавляй заголовки, Markdown, комментарии или другие подпункты.',
    },
    {
      role: 'user',
      text: [
        `Профессия или вид работ: ${profession}.`,
        `Раздел: ${sectionDef.heading}.`,
        tasks,
        `Каждый исправленный подпункт должен содержать НЕ МЕНЕЕ ${MIN_GENERATED_PARAGRAPH_CHARS} СИМВОЛОВ текста после номера.`,
        'Целевой объем — 350-500 символов.',
        'Верни только исправленные подпункты с их точными номерами.',
        'Не повторяй остальные подпункты раздела.',
      ].join('\n\n'),
    },
  ];

  const repairMaxTokens = String(Math.min(1800, 650 * uniqueIndexes.length + 250));

  console.warn(
    '[YandexGPT] Точечный repair раздела ' +
      sectionDef.number +
      ' для "' +
      profession +
      '": ' +
      uniqueIndexes.map(index => `${sectionDef.number}.${index + 1}`).join(', '),
  );

  const rawText = await callYandexGpt(repairMessages, config, repairMaxTokens, {
    generationId,
    profession,
    sectionNumber: sectionDef.number,
    attempt: sectionAttempt,
    mode: 'targeted-paragraph-repair',
  });

  const clean = String(rawText ?? '')
    .replaceAll('\r', '')
    .replaceAll('```', '')
    .trim();

  const found = uniqueIndexes.map(index => {
    const prefix = `${sectionDef.number}.${index + 1}.`;

    return {
      index,
      prefix,
      position: clean.indexOf(prefix),
    };
  });

  if (found.some(item => item.position === -1)) {
    console.warn('[YandexGPT] Точечный repair не вернул все требуемые номера');

    return null;
  }

  found.sort((a, b) => a.position - b.position);

  const repaired = [...paragraphs];

  for (let position = 0; position < found.length; position += 1) {
    const item = found[position];

    const end = position + 1 < found.length ? found[position + 1].position : clean.length;

    const paragraph = clean.slice(item.position, end).split(/\s+/u).join(' ').trim();

    if (!paragraph.startsWith(item.prefix)) {
      return null;
    }

    const body = paragraph.slice(item.prefix.length).trim();

    if (body.length < MIN_GENERATED_PARAGRAPH_CHARS) {
      console.warn(
        '[YandexGPT] Точечный repair снова слишком короткий: ' +
          item.prefix +
          ' LENGTH:' +
          body.length,
      );

      return null;
    }

    repaired[item.index] = `${item.prefix} ${body}`;
  }

  return repaired;
}

async function generateSection(
  messages,
  config,
  profession,
  sectionDef,
  includeTitleAndIntro,
  generationId,
) {
  const userPrompt = buildSectionUserPrompt(profession, sectionDef, {
    includeTitleAndIntro,
  });

  /*
   * FRESH_RETRY_CONTEXT_V1
   *
   * Retry не получает предыдущий сгенерированный ответ.
   */
  const systemMessage = messages.find(message => message?.role === 'system') ?? {
    role: 'system',
    text: buildSystemPrompt(),
  };

  const baseMessages = [
    systemMessage,
    {
      role: 'user',
      text: userPrompt,
    },
  ];

  const maxTokens = estimateMaxTokens(sectionDef.requiredCount);

  let lastIssues = [];

  for (let attempt = 1; attempt <= MAX_SECTION_GENERATION_ATTEMPTS; attempt += 1) {
    const attemptMessages =
      attempt === 1
        ? baseMessages
        : [
            systemMessage,
            {
              role: 'user',
              text: userPrompt + '\n\n' + buildStrictRetryPrompt(sectionDef, lastIssues),
            },
          ];

    const rawText = await callYandexGpt(attemptMessages, config, maxTokens, {
      generationId,
      profession,
      sectionNumber: sectionDef.number,
      attempt,
    });

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

    let issues = validateGeneratedSection(paragraphs, sectionDef);

    if (issues.length > 0) {
      const repairedParagraphs = await tryTargetedParagraphRepair(
        paragraphs,
        issues,
        config,
        profession,
        sectionDef,
        generationId,
        attempt,
      );

      if (repairedParagraphs) {
        paragraphs = repairedParagraphs;

        issues = validateGeneratedSection(paragraphs, sectionDef);

        if (issues.length === 0) {
          console.log(
            '[YandexGPT] Раздел ' + sectionDef.number + ': короткие подпункты исправлены точечно',
          );
        }
      }
    }

    if (issues.length === 0) {
      return {
        title,
        intro,
        section: {
          number: sectionDef.number,
          heading: sectionDef.heading,
          paragraphs,
        },
      };
    }

    lastIssues = issues;

    console.warn(
      `[YandexGPT] Раздел ${sectionDef.number} для "${profession}" ` +
        `не прошёл строгую проверку, попытка ${attempt}: ` +
        issues.join('; '),
    );

    if (attempt >= MAX_SECTION_GENERATION_ATTEMPTS) {
      break;
    }
  }

  throw new Error(
    `YandexGPT: раздел ${sectionDef.number} для "${profession}" ` +
      `не соответствует обязательной структуре после ` +
      `${MAX_SECTION_GENERATION_ATTEMPTS} попыток: ` +
      lastIssues.join('; '),
  );
}

/**
 * Генерирует только указанные разделы инструкции.
 *
 * Каждый раздел получает отдельный короткий messages-контекст,
 * поэтому предыдущие разделы не увеличивают input tokens.
 *
 * Все вызовы объединяются одним generationId.
 */
export async function generateInstructionSectionsWithYandexGpt(
  profession,
  sectionNumbers,
  options = {},
) {
  const { apiKey, folderId, model } = getConfig();

  if (!apiKey || !folderId) {
    throw new Error(
      'YandexGPT не настроен: отсутствует YANDEX_API_KEY или YANDEX_FOLDER_ID в server/.env',
    );
  }

  const requestedNumbers = [
    ...new Set(
      (Array.isArray(sectionNumbers) ? sectionNumbers : [sectionNumbers])
        .map(Number)
        .filter(Number.isFinite),
    ),
  ];

  if (requestedNumbers.length === 0) {
    return {
      profession,
      sections: [],
    };
  }

  const sectionDefinitions = requestedNumbers.map(number => {
    const definition = SECTION_DEFINITIONS.find(item => Number(item.number) === number);

    if (!definition) {
      throw new Error(`Неизвестный раздел инструкции: ${number}`);
    }

    return definition;
  });

  const config = {
    apiKey,
    folderId,
    model,
  };

  const generationId = createGenerationUsageId(options?.source || 'generation');

  const sections = [];

  for (const sectionDef of sectionDefinitions) {
    /*
     * ВАЖНО:
     * новый короткий контекст на каждый раздел.
     *
     * Разделы 1-4 не отправляются в prompt
     * при восстановлении только раздела №5.
     */
    const messages = [
      {
        role: 'system',
        text: buildSystemPrompt(),
      },
    ];

    const result = await generateSection(
      messages,
      config,
      profession,
      sectionDef,
      false,
      generationId,
    );

    sections.push(result.section);
  }

  return {
    profession,
    sections,
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
export async function generateInstructionWithYandexGpt(profession, options = {}) {
  const { apiKey, folderId, model } = getConfig();
  if (!apiKey || !folderId) {
    throw new Error('YandexGPT  :  YANDEX_API_KEY  YANDEX_FOLDER_ID  server/.env');
  }
  const config = { apiKey, folderId, model };

  /*
   * Один ID на всю инструкцию.
   *
   * Все 5 разделов и retry-запросы
   * будут объединены в одну генерацию.
   */
  const generationId = createGenerationUsageId(options?.source || 'generation');

  let title = null;
  let intro = null;
  const sections = [];

  for (const sectionDef of SECTION_DEFINITIONS) {
    /*
     * FRESH_CONTEXT_PER_SECTION_V1
     *
     * Каждый раздел получает новый короткий контекст.
     *
     * Раздел 2 больше не получает текст раздела 1,
     * раздел 3 не получает 1-2 и т.д.
     *
     * Retry внутри текущего раздела по-прежнему
     * имеет доступ к первой попытке этого раздела.
     */
    const messages = [
      {
        role: 'system',
        text: buildSystemPrompt(),
      },
    ];
    const includeTitleAndIntro = sectionDef.number === 1;
    const result = await generateSection(
      messages,
      config,
      profession,
      sectionDef,
      includeTitleAndIntro,
      generationId,
    );

    if (includeTitleAndIntro) {
      title = result.title;
      intro = buildInstructionIntro(title || result.title);
    }

    sections.push(result.section);
  }

  /*
   * FINAL_SCOPE_TITLE_V2
   *
   * Вход может быть:
   *
   * 1. профессией / должностью:
   *    "электромонтер"
   *
   * 2. видом работ:
   *    "при работе на высоте"
   *    "при эксплуатации оборудования"
   *    "при выполнении погрузочно-разгрузочных работ"
   *
   * Виды работ нельзя пропускать через
   * getProfessionGenitive(), поскольку это
   * не название профессии.
   */
  const normalizedSubject = String(profession ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  const isWorkScope = /^при(?=\s|$)/iu.test(normalizedSubject);

  let finalTitle;

  if (isWorkScope) {
    /*
     * Вид работ уже находится в нужной
     * грамматической форме:
     *
     * при работе...
     * при эксплуатации...
     * при выполнении...
     */
    finalTitle = `Инструкция по охране труда ${normalizedSubject}`;
  } else {
    /*
     * Для профессии / должности сохраняем
     * существующую логику склонения.
     */
    const professionGenitive = String(getProfessionGenitive(normalizedSubject) ?? normalizedSubject)
      .trim()
      .replace(/^(?:для\s+)+/iu, '')
      .trim();

    finalTitle = `Инструкция по охране труда для ${professionGenitive}`;
  }

  /*
   * Intro строится ТОЛЬКО из окончательного
   * заголовка.
   *
   * Благодаря этому один helper корректно
   * работает и для профессии, и для вида работ.
   */
  const finalIntro = buildInstructionIntro(finalTitle);

  return {
    title: finalTitle,

    profession: normalizedSubject,

    intro: finalIntro,

    sections,
  };
}
