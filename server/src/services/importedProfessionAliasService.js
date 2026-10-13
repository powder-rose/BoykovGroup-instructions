import { IMPORTED_PROFESSION_ALIASES } from '../data/importedProfessionAliases.js';

import { PROFESSION_GENITIVE_OVERRIDES } from '../data/professionGenitiveOverrides.js';

/*
 * Нормализуем только технические различия.
 *
 * ВАЖНО:
 * не удаляем дефисы из профессии.
 */
function normalizeSpaces(value) {
  return String(value ?? '')
    .replace(/\u00a0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeDashes(value) {
  return String(value ?? '').replace(/[\p{Pd}\u2212]/gu, '-');
}

/*
 * Нормализация только ДЛЯ СРАВНЕНИЯ.
 *
 * Здесь:
 *
 *   инженер - программист
 *   инженер-программист
 *
 * считаются одинаковыми.
 *
 * Но возвращаемое пользователю название
 * этой функцией не формируется.
 */
function normalizeForCompare(value) {
  return normalizeSpaces(normalizeDashes(value))
    .replace(/\s*-\s*/gu, '-')
    .toLocaleLowerCase('ru-RU');
}

/*
 * Имя, которое реально попадёт
 * в profession/title.
 *
 * Здесь дефисы сохраняются.
 */
function normalizeReturnedProfession(value) {
  return normalizeSpaces(normalizeDashes(value));
}

/*
 * Убираем путь и расширение.
 *
 * Поддерживает:
 *
 *   file.docx
 *   C:\folder\file.docx
 *   /folder/file.docx
 */
function getFilenameStem(filename) {
  const base =
    String(filename ?? '')
      .split(/[\\/]/u)
      .pop() ?? '';

  return normalizeSpaces(base.replace(/\.[^/.\\]+$/u, '').replace(/_/gu, ' '));
}

/*
 * Если filename уже содержит готовую
 * форму после "для", проверяем,
 * известна ли её именительная форма.
 *
 * Например:
 *
 *   автослесаря
 *       ↓
 *   автослесарь
 *
 * Это нужно для profession.
 *
 * Для неизвестных сложных профессий
 * возвращаем null и НЕ пытаемся
 * склонять их эвристикой.
 */
function findCanonicalByGenitive(profession) {
  const target = normalizeForCompare(profession);

  for (const [canonical, genitive] of Object.entries(PROFESSION_GENITIVE_OVERRIDES)) {
    if (normalizeForCompare(genitive) === target) {
      return canonical;
    }
  }

  return null;
}

/*
 * Обрабатываем уже извлечённую
 * часть filename.
 */
function finalizeProfession(value) {
  let extracted = normalizeReturnedProfession(value)
    /*
     * Защита от:
     *
     * ИОТ для для оператора...
     */
    .replace(/^(?:для\s+)+/iu, '')
    .trim();

  /*
   * TRAILING TECHNICAL PLUS
   *
   * Некоторые исходные файлы называются:
   *
   *   ИОТ для работника офиса +.docx
   *
   * "+" здесь является технической пометкой
   * файла, а не частью профессии.
   *
   * Удаляем только плюс, перед которым есть
   * пробел. Поэтому C++ остаётся C++.
   */
  extracted = extracted.replace(/\s+\++\s*$/u, '').trim();

  if (!extracted) {
    return null;
  }

  /*
   * Если мы точно знаем именительную
   * форму — используем её.
   *
   * автослесаря -> автослесарь
   * автомаляра  -> автомаляр
   */
  const canonical = findCanonicalByGenitive(extracted);

  if (canonical) {
    return canonical;
  }

  /*
   * ВАЖНО.
   *
   * Для неизвестной профессии НЕ вызываем
   * declineProfessionHeuristic().
   *
   * Строка уже находится после "для":
   *
   *   инженера по робототехнике
   *
   * поэтому возвращаем технический маркер:
   *
   *   для инженера по робототехнике
   *
   * buildInstructionTitle() понимает,
   * что повторно склонять её нельзя.
   */
  return `для ${extracted}`;
}

/*
 * ============================================================
 * ГЛАВНЫЙ FILENAME-FIRST ПАРСЕР
 * ============================================================
 *
 * Словарь здесь НЕ нужен.
 *
 * Поддерживаем:
 *
 *   ИОТ для автослесаря.docx
 *
 *   ИОТ для инженера-проектировщика
 *   систем ВК 3 категории.docx
 *
 *   Инструкция по охране труда
 *   для оператора лазерной установки.docx
 *
 *   ИОТ для для оператора штабелеукладчика.docx
 */
function extractStandardProfession(filename) {
  const stem = getFilenameStem(filename);

  if (!stem) {
    return null;
  }

  const match = stem.match(
    /^(?:иот|инструкция\s+по\s+охране\s+труда)\s*(?:[:\-–—]\s*)?(?:для\s+)+(.+)$/iu,
  );

  if (!match) {
    return null;
  }

  return finalizeProfession(match[1]);
}

/*
 * ============================================================
 * LEGACY DICTIONARY FALLBACK
 * ============================================================
 *
 * Нужен только для файлов,
 * которые НЕ называются стандартно
 * "ИОТ для ...".
 *
 * 370 существующих aliases
 * продолжают работать.
 */
const aliases = [...IMPORTED_PROFESSION_ALIASES].sort((a, b) => {
  const cleanA = normalizeForCompare(a.replace(/\*$/u, ''));

  const cleanB = normalizeForCompare(b.replace(/\*$/u, ''));

  return cleanB.length - cleanA.length;
});

function aliasMatches(alias, candidate) {
  const isPrefix = alias.endsWith('*');

  const aliasValue = normalizeForCompare(isPrefix ? alias.slice(0, -1) : alias);

  const candidateValue = normalizeForCompare(candidate);

  if (isPrefix) {
    return candidateValue.startsWith(aliasValue);
  }

  return candidateValue === aliasValue;
}

function extractFromLegacyDictionary(filename) {
  const stem = getFilenameStem(filename);

  if (!stem) {
    return null;
  }

  /*
   * Например:
   *
   *   ИОТ автослесаря.docx
   *
   * без слова "для".
   */
  const withoutIot = normalizeSpaces(stem.replace(/^иот\s+/iu, ''));

  const matchedAlias = aliases.find(alias => aliasMatches(alias, withoutIot));

  if (!matchedAlias) {
    return null;
  }

  return finalizeProfession(withoutIot);
}

/*
 * Эту функцию вызывает normalizeProfession()
 * ПЕРЕД старым анализом текста.
 */
export function getImportedProfessionFromFilename(filename) {
  /*
   * 1. Стандартный filename —
   *    источник истины.
   *
   *    Никакого словаря.
   */
  const standard = extractStandardProfession(filename);

  if (standard) {
    return standard;
  }

  /*
   * 2. Только для нестандартных
   *    filename пробуем старый словарь.
   */
  return extractFromLegacyDictionary(filename);
}
