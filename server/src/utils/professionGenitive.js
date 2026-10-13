import { PROFESSION_GENITIVE_OVERRIDES } from '../data/professionGenitiveOverrides.js';

/*
 * Deterministic profession -> genitive converter.
 *
 * IMPORTANT:
 * Regex endings are encoded with Unicode escapes.
 * This avoids corruption of Cyrillic characters when
 * source code is transferred through shell/terminal tools.
 */

export function getProfessionGenitive(profession) {
  const normalized = String(profession ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) {
    return normalized;
  }

  /*
   * Exact manually verified overrides
   * always have highest priority.
   */
  const exact = PROFESSION_GENITIVE_OVERRIDES[normalized];

  if (exact) {
    return normalizeProfessionResultCase(exact);
  }

  /*
   * Case-insensitive lookup.
   */
  const lower = normalized.toLowerCase();

  for (const [key, value] of Object.entries(PROFESSION_GENITIVE_OVERRIDES)) {
    if (key.toLowerCase() === lower) {
      return normalizeProfessionResultCase(value);
    }
  }

  return normalizeProfessionResultCase(declineProfessionHeuristic(normalized));
}

/*
 * Masculine/feminine/neuter adjective endings:
 *
 * -ый -> -ого
 * -ой -> -ого
 * -ий -> -его
 * -ая -> -ой
 * -яя -> -ей
 * -ое -> -ого
 * -ее -> -его
 */
const ADJECTIVE_ENDING =
  /(?:\u044b\u0439|\u043e\u0439|\u0438\u0439|\u0430\u044f|\u044f\u044f|\u043e\u0435|\u0435\u0435)$/iu;

function looksLikeAdjective(word) {
  return ADJECTIVE_ENDING.test(word);
}

function declineAdjective(word) {
  if (/\u044b\u0439$/iu.test(word)) {
    return word.slice(0, -2) + '\u043e\u0433\u043e';
  }

  if (/\u043e\u0439$/iu.test(word)) {
    return word.slice(0, -2) + '\u043e\u0433\u043e';
  }

  if (/\u0438\u0439$/iu.test(word)) {
    return word.slice(0, -2) + '\u0435\u0433\u043e';
  }

  if (/\u0430\u044f$/iu.test(word)) {
    return word.slice(0, -2) + '\u043e\u0439';
  }

  if (/\u044f\u044f$/iu.test(word)) {
    return word.slice(0, -2) + '\u0435\u0439';
  }

  if (/\u043e\u0435$/iu.test(word)) {
    return word.slice(0, -2) + '\u043e\u0433\u043e';
  }

  if (/\u0435\u0435$/iu.test(word)) {
    return word.slice(0, -2) + '\u0435\u0433\u043e';
  }

  return word;
}

/*
 * Declines one noun that names the profession.
 *
 * For compound phrases we normally decline only
 * the head noun:
 *
 * specialist po obrabotke informatsii
 * ->
 * specialista po obrabotke informatsii
 */
function declineNoun(word) {
  if (!word) {
    return word;
  }

  /*
   * Already genitive-looking service abbreviations /
   * indeclinable vowel endings are left untouched.
   */
  if (/[\u043e\u0435\u0451\u0443\u044e\u0438]$/iu.test(word)) {
    return word;
  }

  /*
   * -ия -> -ии
   */
  if (/\u0438\u044f$/iu.test(word)) {
    return word.slice(0, -2) + '\u0438\u0438';
  }

  /*
   * -я -> -и
   */
  if (/\u044f$/iu.test(word)) {
    return word.slice(0, -1) + '\u0438';
  }

  /*
   * -а:
   *
   * сестра -> сестры
   * уборщица -> уборщицы
   * работница -> работницы
   *
   * after г/к/х/ж/ч/ш/щ use -и.
   */
  if (/\u0430$/iu.test(word)) {
    const stem = word.slice(0, -1);

    if (/[\u0433\u043a\u0445\u0436\u0447\u0448\u0449]$/iu.test(stem)) {
      return stem + '\u0438';
    }

    return stem + '\u044b';
  }

  /*
   * Masculine -ь:
   *
   * водитель -> водителя
   * испытатель -> испытателя
   * секретарь -> секретаря
   * слесарь -> слесаря
   */
  if (/\u044c$/iu.test(word)) {
    return word.slice(0, -1) + '\u044f';
  }

  /*
   * Masculine -й:
   *
   * рабочий is handled as an adjective above,
   * but this is useful for noun-like forms.
   */
  if (/\u0439$/iu.test(word)) {
    return word.slice(0, -1) + '\u044f';
  }

  /*
   * Common profession ending -ец.
   *
   * Explicit common forms first.
   */
  const lower = word.toLowerCase();

  const SPECIAL = new Map([
    [
      '\u043f\u0440\u043e\u0434\u0430\u0432\u0435\u0446',
      '\u043f\u0440\u043e\u0434\u0430\u0432\u0446\u0430',
    ],
    ['\u043a\u0443\u0437\u043d\u0435\u0446', '\u043a\u0443\u0437\u043d\u0435\u0446\u0430'],
    ['\u0431\u043e\u0435\u0446', '\u0431\u043e\u0439\u0446\u0430'],
    ['\u0436\u0438\u043b\u0435\u0446', '\u0436\u0438\u043b\u044c\u0446\u0430'],
  ]);

  if (SPECIAL.has(lower)) {
    return preserveInitialCase(word, SPECIAL.get(lower));
  }

  /*
   * Normal masculine consonant:
   *
   * архитектор -> архитектора
   * визажист -> визажиста
   * сварщик -> сварщика
   * бухгалтер -> бухгалтера
   * инженер -> инженера
   */
  if (/[\u0431-\u044f]$/iu.test(word)) {
    return word + '\u0430';
  }

  return word;
}

function declineHead(word) {
  if (word.includes('-')) {
    return word
      .split('-')
      .map(part => (looksLikeAdjective(part) ? declineAdjective(part) : declineNoun(part)))
      .join('-');
  }

  if (looksLikeAdjective(word)) {
    return declineAdjective(word);
  }

  return declineNoun(word);
}

function declineProfessionHeuristic(profession) {
  const words = profession.split(' ').filter(Boolean);

  if (words.length === 0) {
    return profession;
  }

  /*
   * One-word substantivized adjective:
   *
   * рабочий -> рабочего
   * дежурный -> дежурного
   * горничная -> горничной
   */
  if (words.length === 1) {
    return declineHead(words[0]);
  }

  /*
   * Decline leading adjectives.
   *
   * главный инженер
   * ->
   * главного инженера
   *
   * медицинская сестра
   * ->
   * медицинской сестры
   */
  let adjectiveCount = 0;

  while (adjectiveCount < words.length - 1 && looksLikeAdjective(words[adjectiveCount])) {
    adjectiveCount += 1;
  }

  if (adjectiveCount > 0) {
    const result = [];

    for (let i = 0; i < adjectiveCount; i += 1) {
      result.push(declineAdjective(words[i]));
    }

    result.push(declineHead(words[adjectiveCount]));

    result.push(...words.slice(adjectiveCount + 1));

    return result.filter(Boolean).join(' ');
  }

  /*
   * Default multiword profession:
   * decline only its head.
   *
   * специалист по обработке информации
   * ->
   * специалиста по обработке информации
   *
   * заместитель технического директора
   * ->
   * заместителя технического директора
   */
  return [declineHead(words[0]), ...words.slice(1)].filter(Boolean).join(' ');
}

/*
 * PROFESSION_RESULT_CASE_V2
 *
 * После "для" название профессии
 * начинается со строчной буквы.
 *
 * Аббревиатуры из 2+ заглавных
 * символов сохраняются.
 */
function normalizeProfessionResultCase(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return text;
  }

  if (/^[A-ZА-ЯЁ]{2}/u.test(text)) {
    return text;
  }

  return text[0].toLocaleLowerCase('ru-RU') + text.slice(1);
}

function preserveInitialCase(source, target) {
  if (!source || !target) {
    return target;
  }

  const first = source[0];

  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return target[0].toUpperCase() + target.slice(1);
  }

  return target;
}
