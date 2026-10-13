import { parseImportedInstruction } from './importedInstructionParser.js';

import { normalizeUploadedFilename } from '../utils/uploadedFilename.js';

import { extractTextFromUpload, splitIntoParagraphs } from './documentTextExtractor.js';

import { createInstructionHash } from './instructionHashService.js';

import { compareInstruction } from './instructionVersionService.js';

import { instructionsRepository } from './instructionsRepository.js';

import { normalizeProfessionKey } from './professionNormalizer.js';

import {
  cleanDocumentText,
  normalizeProfession,
  buildInstructionTitle,
} from './documentCleanerService.js';

import { assertInstructionQuality } from './instructionQualityChecker.js';

import { nanoid } from 'nanoid';

import { slugify } from '../utils/slug.js';

/**
 * Финальная нормализация структуры импортированной инструкции.
 *
 * Formatter может вернуть корректные sections/paragraphs,
 * но без исходной нумерации пунктов.
 *
 * Здесь гарантируем:
 *   1.1. ...
 *   1.2. ...
 *   2.1. ...
 *
 * Уже существующую нумерацию сохраняем.
 */

/**
 * Финальная очистка абзацев импортированной инструкции.
 *
 * Возвращает:
 *   string -> содержательный пункт
 *   null   -> технический мусор, который нужно удалить
 *
 * Никакой новый текст здесь НЕ создаётся.
 */
function sanitizeImportedParagraph(value = '') {
  let text = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  /*
   * Сохраняем номер отдельно, чтобы анализировать
   * только содержимое пункта.
   *
   * Например:
   *
   * 1.23. __________
   *
   * numberPrefix = "1.23. "
   * content      = "__________"
   */
  const numbered = text.match(/^\s*(\d+\.\d+\.?)\s*(.*)$/u);

  const numberPrefix = numbered ? numbered[1].replace(/\.$/, '') + '. ' : '';

  let content = numbered ? numbered[2].trim() : text;

  /*
   * Иногда после номера остаётся служебная
   * пунктуация:
   *
   * 1.2. , другие средства...
   *
   * превращаем в:
   *
   * 1.2. другие средства...
   */
  content = content.replace(/^[,;:]+(?:\s+|$)/u, '').trim();

  if (!content) {
    return null;
  }

  /*
   * ----------------------------------------------------------
   * 1. МЕСТА ДЛЯ ПОДПИСИ / ДАТЫ
   * ----------------------------------------------------------
   *
   * 1.23. _______________ //
   * ____________________
   * ______ / ______
   */
  if (/^[\s_—–\-./\\|:;,*()[\]{}]+$/u.test(content)) {
    return null;
  }

  /*
   * Убираем декоративные символы,
   * чтобы распознать:
   *
   * Подпись: __________
   * Дата __________
   * Ф.И.О. __________
   */
  const wordsOnly = content
    .replace(/[_—–\-./\\|:;,*()[\]{}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ru-RU');

  const garbageLabels = new Set(['подпись', 'расшифровка подписи', 'фио', 'ф и о', 'дата', 'м п']);

  if (garbageLabels.has(wordsOnly)) {
    return null;
  }

  /*
   * ----------------------------------------------------------
   * 2. РЕКВИЗИТЫ ОРГАНИЗАЦИИ
   * ----------------------------------------------------------
   *
   * , ИНН , Юридический адрес:
   * ИНН:
   * КПП:
   * ОГРН:
   * Юридический адрес:
   */
  const normalized = content
    .toLocaleLowerCase('ru-RU')
    .replace(/^[,;:._\-–—/\\|\s]+/u, '')
    .trim();

  const requisiteLabels = [
    'инн',
    'кпп',
    'огрн',
    'огрнип',
    'бик',
    'юридический адрес',
    'фактический адрес',
    'почтовый адрес',
    'расчетный счет',
    'расчётный счёт',
    'корреспондентский счет',
    'корреспондентский счёт',
    'наименование организации',
  ];

  const requisiteMatches = requisiteLabels.filter(label => normalized.includes(label));

  /*
   * В короткой строке несколько реквизитов:
   *
   * ИНН, Юридический адрес
   */
  if (requisiteMatches.length >= 2 && normalized.length < 250) {
    return null;
  }

  /*
   * Строка фактически является самим реквизитом:
   *
   * ИНН:
   * Юридический адрес:
   */
  for (const label of requisiteLabels) {
    if (normalized === label || normalized === `${label}:` || normalized.startsWith(`${label}: `)) {
      return null;
    }
  }

  /*
   * Содержательный пункт сохраняем.
   *
   * Если исходный номер был — также сохраняем его.
   */
  return (numberPrefix + content).trim();
}

function normalizeImportedSections(sections = []) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.map((section, sectionIndex) => {
    const parsedNumber = Number.parseInt(section?.number, 10);

    const sectionNumber =
      Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : sectionIndex + 1;

    const heading = String(section?.heading ?? '')
      // ## Заголовок
      .replace(/^\s*#{1,6}\s*/, '')
      // 1. Заголовок
      .replace(/^\s*\d+\.\s*/, '')
      .trim();

    const rawParagraphs = Array.isArray(section?.paragraphs) ? section.paragraphs : [];

    const cleanedParagraphs = [];

    for (const value of rawParagraphs) {
      let paragraph = String(value ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();

      if (!paragraph) {
        continue;
      }

      /*
       * Иногда formatter может продублировать heading
       * внутри paragraphs.
       */
      const withoutMarkdownHeading = paragraph.replace(/^\s*#{1,6}\s*/, '').trim();

      if (
        heading &&
        withoutMarkdownHeading.toLocaleLowerCase('ru-RU') === heading.toLocaleLowerCase('ru-RU')
      ) {
        continue;
      }

      /*
       * Финальная очистка импортированного пункта.
       * Может вернуть null — тогда это мусор.
       */
      const sanitized = sanitizeImportedParagraph(withoutMarkdownHeading);

      if (!sanitized) {
        continue;
      }

      cleanedParagraphs.push(sanitized);
    }

    const paragraphs = cleanedParagraphs.map((paragraph, paragraphIndex) => {
      /*
       * Уже есть:
       *
       * 1.1. Текст
       * 1.1 Текст
       *
       * Нормализуем к:
       *
       * 1.1. Текст
       */
      const existingNumber = paragraph.match(/^\s*(\d+)\.(\d+)\.?\s+(.*)$/s);

      if (existingNumber) {
        return `${existingNumber[1]}.` + `${existingNumber[2]}. ` + existingNumber[3].trim();
      }

      /*
       * Номера нет — восстанавливаем
       * по позиции абзаца в разделе.
       */
      return `${sectionNumber}.` + `${paragraphIndex + 1}. ` + paragraph;
    });

    return {
      ...section,
      number: sectionNumber,
      heading,
      paragraphs,
    };
  });
}

/*
 * Проверка профессии / вида работ,
 * извлечённых из импортируемого DOCX.
 *
 * Это НЕ whitelist:
 * редкие профессии и инструкции
 * "при работе...", "при выполнении..."
 * должны продолжать импортироваться.
 */
function getSuspiciousImportedProfessionReason(value = '') {
  const profession = String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(/\s+/g, ' ')
    .trim();

  if (!profession) {
    return 'не удалось определить профессию ' + 'или вид работ';
  }

  /*
   * Уже обнаруженные реальные мусорные
   * значения из массового импорта.
   */
  const blockedPatterns = [
    {
      pattern: /(?:^|\s)приколист(?:а|у|ом|е)?(?:\s|$)/iu,

      reason: 'некорректное название «приколист»',
    },

    {
      pattern: /уборк\p{L}*\s+в\s+ноль/iu,

      reason: 'некорректное выражение «уборка в ноль»',
    },
  ];

  for (const item of blockedPatterns) {
    if (item.pattern.test(profession)) {
      return item.reason;
    }
  }

  /*
   * Явный технический мусор.
   */
  if (/https?:\/\/|www\./iu.test(profession)) {
    return 'в названии обнаружена ссылка';
  }

  if (/[<>{}\[\]]|={2,}|_{3,}/u.test(profession)) {
    return 'в названии обнаружены ' + 'служебные символы';
  }

  /*
   * На этом этапе "для для жестянщика"
   * уже должен быть нормализован в
   * "жестянщика".
   *
   * Если повтор всё же сохранился,
   * считаем это ошибкой.
   */
  if (/\b(?:для\s+){2,}/iu.test(profession)) {
    return 'обнаружен повтор предлога «для»';
  }

  return null;
}

export async function processInstructionFile({ buffer, filename, mimetype, source = 'uploaded' }) {
  filename = normalizeUploadedFilename(filename);

  const rawText = await extractTextFromUpload({
    buffer,

    originalName: filename,

    mimetype,
  });

  const cleanedText = cleanDocumentText(rawText);

  const paragraphs = splitIntoParagraphs(cleanedText);

  if (!paragraphs.length) {
    throw new Error('Не удалось извлечь текст документа');
  }

  const profession = normalizeProfession(filename, cleanedText);

  const formatted = parseImportedInstruction(cleanedText);

  if (!formatted.sections.length) {
    throw new Error('Не удалось распознать разделы и нумерованные пункты инструкции');
  }

  const rawProfession = String(formatted?.profession || profession || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+\++\s*$/u, '')
    .trim();

  const finalProfession = rawProfession.replace(/^(?:для\s+)+/iu, '').trim();

  const suspiciousProfessionReason = getSuspiciousImportedProfessionReason(finalProfession);

  if (suspiciousProfessionReason) {
    const error = new Error(
      `Импорт требует проверки: ${suspiciousProfessionReason}. ` +
        `Извлечено: «${finalProfession}». ` +
        `Файл: «${filename}»`,
    );

    error.code = 'IMPORT_REVIEW_REQUIRED';

    throw error;
  }

  const isWorkScope = /^при(?=\s|$)/iu.test(finalProfession);

  const finalTitle = isWorkScope
    ? `Инструкция по охране труда ${finalProfession}`
    : buildInstructionTitle(rawProfession);

  const professionKey = normalizeProfessionKey(finalProfession);

  let instruction = {
    id: `${slugify(finalTitle)}-${nanoid(6)}`,

    title: finalTitle,

    profession: finalProfession,

    professionKey: professionKey,

    intro: isWorkScope
      ? `Инструкция устанавливает требования охраны труда ${finalProfession}.`
      : 'Инструкция устанавливает требования охраны труда при выполнении работ по профессии.',

    sections: normalizeImportedSections(
      formatted?.sections?.length
        ? formatted.sections
        : [
            {
              number: 1,
              heading: 'Общие требования охраны труда',
              paragraphs,
            },
          ],
    ),

    source,

    uploadedBy: 'admin',

    version: '1.0',

    createdAt: new Date().toISOString(),

    updatedAt: new Date().toISOString(),
  };

  instruction.contentHash = createInstructionHash(instruction);

  try {
    assertInstructionQuality(instruction);
  } catch (error) {
    /*
     * ВАЖНО:
     *
     * Загруженные инструкции НЕ достраиваем
     * и НЕ генерируем отсутствующие разделы.
     *
     * Quality checker здесь используется
     * только для диагностики.
     *
     * Сохраняем документ в том составе,
     * в котором он был загружен после очистки
     * и нормализации.
     */
    console.warn(
      `[Import quality warning] ${filename}:`,
      error?.qualityErrors || error?.message || error,
    );
  }

  instruction.contentHash = createInstructionHash(instruction);

  const existing = instructionsRepository.findByProfessionKey(instruction.professionKey);

  if (existing) {
    return compareInstruction(existing, instruction);
  }

  return {
    action: 'new',

    instruction,
  };
}
