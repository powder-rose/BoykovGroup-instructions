/*
 * ============================================================
 * CONTENT MODERATION
 * ============================================================
 *
 * Используется для публичной платной генерации инструкций.
 *
 * ВАЖНО:
 * frontend-проверка может улучшать UX,
 * но окончательное решение всегда принимает backend.
 */

/*
 * Сообщение пользователю намеренно нейтральное.
 *
 * Не сообщаем конкретное запрещённое слово,
 * чтобы не помогать подбирать обход фильтра.
 */
const PUBLIC_REJECTION_MESSAGE =
  'Не удалось принять этот запрос. Укажите законную профессию или вид работ в нейтральной формулировке.';

/*
 * Внутренние коды.
 * Их можно писать в серверный лог.
 */
export const MODERATION_REASON = Object.freeze({
  EMPTY: 'EMPTY',

  TOO_SHORT: 'TOO_SHORT',

  TOO_LONG: 'TOO_LONG',

  INVALID_FORMAT: 'INVALID_FORMAT',

  URL_OR_CONTACT: 'URL_OR_CONTACT',

  PROFANITY: 'PROFANITY',

  SEXUAL_SERVICES: 'SEXUAL_SERVICES',

  CRIMINAL_ACTIVITY: 'CRIMINAL_ACTIVITY',

  DRUG_ACTIVITY: 'DRUG_ACTIVITY',

  PROMPT_INJECTION: 'PROMPT_INJECTION',

  GARBAGE_INPUT: 'GARBAGE_INPUT',

  GENERATED_CONTENT: 'GENERATED_CONTENT',
});

/*
 * ------------------------------------------------------------
 * Нормализация
 * ------------------------------------------------------------
 */

function normalizeBase(value = '') {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * Версия только для поиска попыток обхода.
 *
 * Результат этой функции НИКОГДА
 * не используется как название профессии.
 */
function foldLookalikes(value = '') {
  const map = {
    a: 'а',
    c: 'с',
    e: 'е',
    k: 'к',
    m: 'м',
    o: 'о',
    p: 'р',
    t: 'т',
    x: 'х',
    y: 'у',

    0: 'о',
    3: 'з',
    4: 'ч',
    6: 'б',
    8: 'в',

    '@': 'а',
  };

  return normalizeBase(value)
    .split('')
    .map(character => map[character] ?? character)
    .join('');
}

function wordsOf(value = '') {
  return value
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function compactOf(value = '') {
  return value.replace(/[^\p{L}\p{N}]+/gu, '');
}

/*
 * Формы для проверки попыток обхода:
 *
 * п р о с т и т у т к а
 * п.р.о.с.т.и.т.у.т.к.а
 * проооститутка
 */
function compactVariants(value = '') {
  const compact = compactOf(value);

  const collapsed = compact.replace(/(.)\1+/gu, '$1');

  return [compact, collapsed];
}

function cleanProfessionForUse(value = '') {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * ------------------------------------------------------------
 * Мат
 * ------------------------------------------------------------
 *
 * Здесь намеренно не используется что-то вроде:
 *
 *   text.includes("бля")
 *
 * потому что это даёт ложные срабатывания
 * в обычных словах.
 */

const PROFANITY_EXACT = new Set([
  'блять',
  'бля',
  'сука',
  'суки',
  'хуй',
  'хуи',
  'хуя',
  'хуе',
  'нахуй',
  'похуй',
  'мудак',
  'мудаки',
  'гандон',
  'гондон',
  'долбоеб',
  'долбоебы',

  'fuck',
  'fucking',
  'shit',
  'bitch',
]);

const PROFANITY_PREFIXES = [
  'бляд',
  'ебан',
  'ебат',
  'ебуч',
  'еблан',
  'ебля',
  'пизд',
  'долбоеб',
  'хуйн',
  'хуев',
  'хуес',
  'охуе',
  'нахуя',
  'залуп',
];

const PROFANITY_OBFUSCATED = [
  'блять',
  'блядь',
  'хуй',
  'пизда',
  'пиздец',
  'ебать',
  'ебаный',
  'долбоеб',
  'мудак',
];

/*
 * ============================================================
 * GENERIC_PROFANITY_OBFUSCATION_V1
 * ============================================================
 *
 * Универсальная detection-only проверка.
 *
 * Поддерживает:
 *
 * - кириллицу / латиницу;
 * - цифры вместо букв;
 * - смешанный алфавит;
 * - разделители между буквами;
 * - повторяющиеся буквы;
 * - транслитерацию распространённых вариантов.
 *
 * Никогда не используется для формирования
 * названия профессии.
 */

const GENERIC_PROFANITY_EXTRA_EXACT = new Set([
  'жопа',
  'говно',
  'мразь',
  'сволочь',
  'ублюдок',
  'падла',
  'шлюха',

  'asshole',
  'cunt',
  'whore',
]);

const GENERIC_PROFANITY_EXTRA_PREFIXES = [
  /*
   * Дополнительные русские корни.
   */
  'пидор',
  'пидар',
  'пидарас',
  'пидр',

  'мудил',

  'блят',

  'уеб',
  'заеб',
  'выеб',
  'проеб',
  'доеб',
  'наеб',
  'разъеб',

  'шлюх',
  'ублюд',

  /*
   * Английские корни.
   */
  'fuck',
  'motherfuck',
  'shit',
  'bitch',
  'asshole',

  /*
   * GENERIC_PROFANITY_TRANSLIT_ALIASES_V1
   *
   * Транслитерация, где одна русская буква
   * может превращаться в несколько латинских.
   *
   * Например:
   *   я -> ya
   *   ю -> yu
   *   ж -> zh
   *   ч -> ch
   *   ш -> sh
   */
  'blyad',
  'blyat',
  'blyadi',
  'blyaha',

  'yebat',
  'ebat',
  'ebanut',
  'eblan',

  'pizda',
  'pizdec',
  'pizd',

  'pidor',
  'pidar',
  'pidaras',

  'dolboeb',

  'mudak',
  'mudil',

  'gandon',
  'gondon',

  'zalupa',

  'shluha',
  'shlyuha',

  'suka',
];

/*
 * Эквивалентные символы для detection.
 *
 * Некоторые символы намеренно неоднозначны.
 * Например латинская p может изображать
 * и русскую "п", и русскую "р".
 */
const GENERIC_PROFANITY_CONFUSABLES = Object.freeze({
  а: 'аa@',
  б: 'бb6',
  в: 'вv8b',
  г: 'гg',
  д: 'дd',
  е: 'еe',
  з: 'зz3',

  и: 'иiu1',
  й: 'йyi1',

  к: 'кk',
  л: 'лl',
  м: 'мm',
  н: 'нnh',

  о: 'оo0',

  п: 'пpn',
  р: 'рpr',

  с: 'сcs',
  т: 'тt',

  у: 'уuy',

  ф: 'фf',
  х: 'хxh',

  ц: 'цc',
  ч: 'ч4',

  ш: 'шw',
  щ: 'щw',

  ы: 'ыbi',
  ь: 'ьb',

  э: 'эe',
  ю: 'юu',

  /*
   * y нужен, например, для:
   *
   * blyad
   */
  я: 'я9y',

  /*
   * Обратные соответствия для слов,
   * записанных преимущественно латиницей.
   */
  a: 'aа@',
  b: 'bбвь68',
  c: 'cс',
  d: 'dд',
  e: 'eе',
  f: 'fф',
  g: 'gг',

  h: 'hнх',

  i: 'iи1',

  j: 'j',

  k: 'kк',
  l: 'lл',
  m: 'mм',

  n: 'nнп',

  o: 'oо0',

  p: 'pпр',

  q: 'q',

  r: 'rр',
  s: 'sс',
  t: 'tт',

  /*
   * u может использоваться
   * как "у" и как "и".
   */
  u: 'uуи',

  v: 'vв',
  w: 'wшщ',
  x: 'xх',

  y: 'yуйя',

  z: 'zз3',

  0: '0оo',
  1: '1иiй',
  3: '3зz',
  4: '4ч',
  6: '6бb',
  8: '8вv',
  9: '9яy',
});

function buildGenericProfanityRegex(root, prefixMode = false) {
  const normalized = normalizeBase(root);

  /*
   * В этот механизм допускаем только
   * однословные корни.
   */
  if (!/^[\p{L}\p{N}]+$/u.test(normalized)) {
    return null;
  }

  const separator = '[^\\p{L}\\p{N}]*';

  const parts = Array.from(normalized).map(character => {
    const equivalents = GENERIC_PROFANITY_CONFUSABLES[character];

    if (equivalents) {
      /*
       * "+" также ловит растягивание:
       *
       * хуууй
       * пидооор
       * fuuuck
       */
      return '[' + equivalents + ']+';
    }

    /*
     * normalized root здесь уже
     * состоит только из букв/цифр.
     */
    return character + '+';
  });

  const body = parts.join(separator);

  const leftBoundary = '(?:^|[^\\p{L}\\p{N}])';

  /*
   * Для PREFIXES окончание слова
   * не требуется.
   *
   * Например:
   *
   * пизд...
   * ебан...
   * долбоеб...
   */
  const rightBoundary = prefixMode ? '' : '(?=$|[^\\p{L}\\p{N}])';

  return new RegExp(leftBoundary + body + rightBoundary, 'u');
}

const GENERIC_PROFANITY_EXACT_REGEXES = [...PROFANITY_EXACT, ...GENERIC_PROFANITY_EXTRA_EXACT]
  .map(root => buildGenericProfanityRegex(root, false))
  .filter(Boolean);

const GENERIC_PROFANITY_PREFIX_REGEXES = [
  ...new Set([...PROFANITY_PREFIXES, ...PROFANITY_OBFUSCATED, ...GENERIC_PROFANITY_EXTRA_PREFIXES]),
]
  .map(root => buildGenericProfanityRegex(root, true))
  .filter(Boolean);

function containsGenericObfuscatedProfanity(value = '') {
  const normalized = normalizeBase(value);

  if (!normalized) {
    return false;
  }

  if (GENERIC_PROFANITY_EXACT_REGEXES.some(regex => regex.test(normalized))) {
    return true;
  }

  if (GENERIC_PROFANITY_PREFIX_REGEXES.some(regex => regex.test(normalized))) {
    return true;
  }

  return false;
}

function containsProfanity(normalized, folded) {
  /*
   * GENERIC_PROFANITY_CALL_V1
   */
  if (containsGenericObfuscatedProfanity(normalized)) {
    return true;
  }

  const words = [...wordsOf(normalized), ...wordsOf(folded)];

  for (const word of words) {
    if (PROFANITY_EXACT.has(word)) {
      return true;
    }

    if (PROFANITY_PREFIXES.some(prefix => word.startsWith(prefix))) {
      return true;
    }
  }

  /*
   * Проверяем запись вида:
   *
   * п р о с ...
   * б.л.я.д.ь
   *
   * только если в исходной строке действительно
   * много односимвольных частей.
   *
   * Это уменьшает риск ложных совпадений
   * внутри нормальных слов.
   */
  const rawParts = folded.split(/[^\p{L}\p{N}]+/gu).filter(Boolean);

  const singleCharacterParts = rawParts.filter(part => part.length === 1).length;

  const looksSpaced = rawParts.length >= 3 && singleCharacterParts / rawParts.length >= 0.55;

  if (looksSpaced) {
    const compact = compactOf(folded);

    if (PROFANITY_OBFUSCATED.some(word => compact.includes(word))) {
      return true;
    }
  }

  return false;
}

/*
 * ------------------------------------------------------------
 * Запрещённые категории публичного сервиса
 * ------------------------------------------------------------
 *
 * Это именно политика сервиса.
 * Не пытаемся превращать этот список
 * в юридический классификатор профессий РФ.
 */

const SEXUAL_SERVICE_PHRASES = [
  'проститутка',
  'проститутки',
  'проститут',
  'сутенер',
  'сутенеры',
  'секс работник',
  'секс работница',
  'секс услуги',
  'сексуальные услуги',
  'интим услуги',
  'интимные услуги',
  'эскортница',
  'эскортницы',
  'эскортник',
  'эскорт услуги',

  'prostitute',
  'prostitution',
  'pimp',
  'sex worker',
];

/*
 * Компактные формы применяются только
 * для detection, никогда не публикуются
 * как название профессии.
 */
const SEXUAL_SERVICE_COMPACT = [
  'проститут',
  'сутенер',
  'сексработник',
  'сексработница',
  'сексуслуги',
  'сексуальныеуслуги',
  'интимуслуги',
  'интимныеуслуги',
  'эскортница',
  'эскортник',
  'эскортуслуги',
];

const CRIMINAL_PHRASES = [
  'наемный убийца',
  'наемная убийца',
  'киллер',
  'вор в законе',
  'вор домушник',
  'карманник',
  'грабитель',
  'разбойник',
  'мошенник',
  'торговец людьми',

  'contract killer',
  'hitman',
  'human trafficker',
];

const DRUG_ACTIVITY_PHRASES = [
  'наркокурьер',
  'нарко курьер',
  'наркодилер',
  'нарко дилер',
  'торговец наркотиками',
  'сбытчик наркотиков',
  'сбыт наркотиков',
  'изготовитель наркотиков',
  'производитель наркотиков',
  'закладчик наркотиков',
  'делать закладки наркотиков',

  'drug dealer',
  'drug courier',
];

function containsPhrase(value, phrases) {
  const normalized = ` ${wordsOf(value).join(' ')} `;

  return phrases.some(phrase => {
    const needle = ` ${wordsOf(normalizeBase(phrase)).join(' ')} `;

    return normalized.includes(needle);
  });
}

function containsSexualServices(normalized, folded) {
  /*
   * Сначала обычная проверка слов и фраз.
   */
  if (
    containsPhrase(normalized, SEXUAL_SERVICE_PHRASES) ||
    containsPhrase(folded, SEXUAL_SERVICE_PHRASES)
  ) {
    return true;
  }

  /*
   * Затем проверяем форму без разделителей.
   *
   * Это блокирует, например:
   *
   * п р о с т и т у т к а
   * п.р.о.с.т.и.т.у.т.к.а
   * с-у-т-е-н-е-р
   */
  const compactCandidates = [...compactVariants(normalized), ...compactVariants(folded)];

  if (
    compactCandidates.some(candidate =>
      SEXUAL_SERVICE_COMPACT.some(forbidden => candidate.includes(forbidden)),
    )
  ) {
    return true;
  }

  /*
   * Дополнительная проверка корней
   * в обычных словах.
   */
  const words = [...wordsOf(normalized), ...wordsOf(folded)];

  return words.some(
    word =>
      word.startsWith('проститут') ||
      word.startsWith('сутенер') ||
      word.startsWith('эскортниц') ||
      word.startsWith('эскортник'),
  );
}

function containsCriminalActivity(normalized, folded) {
  return containsPhrase(normalized, CRIMINAL_PHRASES) || containsPhrase(folded, CRIMINAL_PHRASES);
}

function containsDrugActivity(normalized, folded) {
  return (
    containsPhrase(normalized, DRUG_ACTIVITY_PHRASES) ||
    containsPhrase(folded, DRUG_ACTIVITY_PHRASES)
  );
}

/*
 * ------------------------------------------------------------
 * Prompt injection / мусор вместо профессии
 * ------------------------------------------------------------
 */

const PROMPT_INJECTION_PATTERNS = [
  /игнорируй\s+(?:все\s+)?предыдущ/iu,
  /забудь\s+(?:все\s+)?предыдущ/iu,
  /системн(?:ый|ого)\s+(?:промпт|prompt)/iu,
  /system\s+prompt/iu,
  /ignore\s+(?:all\s+)?previous/iu,
  /ты\s+(?:являешься|теперь)\s+(?:чат|chat|модель|ассистент)/iu,
  /верни\s+(?:только\s+)?json/iu,
  /выведи\s+(?:системн|секрет|ключ)/iu,
  /покажи\s+(?:системн|секрет|api\s*key)/iu,
];

function containsPromptInjection(value) {
  return PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(value));
}

function containsUrlOrContact(value) {
  return (
    /https?:\/\//iu.test(value) ||
    /www\./iu.test(value) ||
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/iu.test(value)
  );
}

function reject(reasonCode) {
  return {
    allowed: false,

    reasonCode,

    message: PUBLIC_REJECTION_MESSAGE,

    normalized: null,
  };
}

/*
 * ============================================================
 * PUBLIC REQUEST MODERATION
 * ============================================================
 */

/*
 * OBVIOUS_ILLEGAL_PHRASES_HARDBLOCK_V1
 *
 * Очевидные формулировки, которые лучше
 * блокировать ещё ДО оплаты.
 *
 * Это дополнительный барьер поверх
 * существующих списков/обфускации.
 */
function detectObviousIllegalRequest(value) {
  const normalized = normalizeBase(value);

  if (!normalized) {
    return null;
  }

  /*
   * Сексуальные услуги.
   *
   * Ловит, например:
   * - оказание интимных услуг за деньги
   * - интимные услуги
   * - проституция
   */
  const sexual = [
    /(?:^|\s)интимн[\p{L}]*\s+услуг[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)сексуальн[\p{L}]*\s+услуг[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)секс\s*услуг[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)проституц[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)проститут[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)сутенер[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)эскорт\s+услуг[\p{L}]*(?:\s|$)/u,
  ].some(pattern => pattern.test(normalized));

  if (sexual) {
    return MODERATION_REASON.SEXUAL_SERVICES;
  }

  /*
   * Незаконный оборот наркотиков.
   *
   * Не блокируем само слово "наркотики":
   * оно допустимо, например, в медицинском,
   * правоохранительном или профилактическом
   * контексте.
   *
   * Нужна связка с торговлей/сбытом/
   * распространением/курьером/дилером.
   */
  const drugTrade = [
    /(?:^|\s)нарко\s*дилер[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)нарко\s*курьер[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)торгов[\p{L}]*\s+(?:запрещенн[\p{L}]*\s+)?наркот[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)продаж[\p{L}]*\s+(?:запрещенн[\p{L}]*\s+)?наркот[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)сбыт[\p{L}]*\s+(?:запрещенн[\p{L}]*\s+)?наркот[\p{L}]*(?:\s|$)/u,
    /(?:^|\s)распростран[\p{L}]*\s+(?:запрещенн[\p{L}]*\s+)?наркот[\p{L}]*(?:\s|$)/u,
  ].some(pattern => pattern.test(normalized));

  if (drugTrade) {
    return MODERATION_REASON.DRUG_ACTIVITY;
  }

  return null;
}

export function moderateProfessionRequest(value) {
  const obviousIllegalReason = detectObviousIllegalRequest(value);

  if (obviousIllegalReason) {
    return {
      allowed: false,

      reasonCode: obviousIllegalReason,

      message: PUBLIC_REJECTION_MESSAGE,

      normalized: null,
    };
  }

  /*
   * PUBLIC_PROFANITY_HARDBLOCK_V1
   *
   * Серверная защита публичной платной формы.
   * Выполняется ДО создания заказа и ДО CloudPayments.
   *
   * Detection-only:
   * результат нормализации никогда не используется
   * как название профессии.
   */
  {
    const moderationProbeRaw = String(value ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е');

    /*
     * Дополнительные латинские/цифровые подмены
     * именно для этой проверки.
     */
    /*
     * MIXED_PIDOR_SKELETON_V2
     *
     * Detection-only проверка смешанных
     * кириллических/латинских вариантов.
     */
    const hasForbiddenSkeleton =
      /(?:^|[^\p{L}\p{N}])[пp]+[^\p{L}\p{N}]*[иiu1]+[^\p{L}\p{N}]*[дd]+[^\p{L}\p{N}]*[оo0]+[^\p{L}\p{N}]*[рpr]+/iu.test(
        moderationProbeRaw,
      );

    const moderationProbeMap = {
      p: 'п',
      i: 'и',
      u: 'и',
      d: 'д',
      o: 'о',
      r: 'р',
      s: 'с',
      a: 'а',

      0: 'о',
      1: 'и',
    };

    const moderationProbeFolded = moderationProbeRaw
      .split('')
      .map(character => moderationProbeMap[character] ?? character)
      .join('');

    const collapseRepeats = value => value.replace(/(.)\1+/gu, '$1');

    const moderationTokens = moderationProbeFolded.split(/[^\p{L}\p{N}]+/gu).filter(Boolean);

    /*
     * Обычные варианты:
     *
     * пидор
     * пидорас
     * пидоры
     * пидр
     * пидооор
     * п1дор
     * pidor
     * p1dor
     * пiдoр
     */
    const hasForbiddenToken = moderationTokens.some(token => {
      const candidate = collapseRepeats(token);

      return candidate.startsWith('пидор') || candidate.startsWith('пидр');
    });

    /*
     * Разделённые варианты:
     *
     * п и д о р
     * п-и-д-о-р
     * п.и.д.о.р
     * p i d o r
     */
    const singleParts = moderationTokens.filter(token => token.length === 1).length;

    const looksSeparated =
      moderationTokens.length >= 3 && singleParts / moderationTokens.length >= 0.55;

    let hasForbiddenSeparated = false;

    if (looksSeparated) {
      const joined = collapseRepeats(moderationTokens.join(''));

      hasForbiddenSeparated = joined.startsWith('пидор') || joined.startsWith('пидр');
    }

    if (hasForbiddenSkeleton || hasForbiddenToken || hasForbiddenSeparated) {
      return {
        allowed: false,

        reasonCode: MODERATION_REASON.PROFANITY,

        message: PUBLIC_REJECTION_MESSAGE,

        normalized: null,
      };
    }
  }

  const cleaned = cleanProfessionForUse(value);

  if (!cleaned) {
    return reject(MODERATION_REASON.EMPTY);
  }

  if (cleaned.length < 3) {
    return reject(MODERATION_REASON.TOO_SHORT);
  }

  if (cleaned.length > 180) {
    return reject(MODERATION_REASON.TOO_LONG);
  }

  /*
   * Управляющие символы кроме обычных пробелов
   * в названии профессии не нужны.
   */
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(cleaned)) {
    return reject(MODERATION_REASON.INVALID_FORMAT);
  }

  const letterCount = (cleaned.match(/\p{L}/gu) || []).length;

  if (letterCount < 3) {
    return reject(MODERATION_REASON.GARBAGE_INPUT);
  }

  const normalized = normalizeBase(cleaned);

  const folded = foldLookalikes(cleaned);

  const words = wordsOf(normalized);

  if (words.length > 40) {
    return reject(MODERATION_REASON.GARBAGE_INPUT);
  }

  if (containsUrlOrContact(normalized)) {
    return reject(MODERATION_REASON.URL_OR_CONTACT);
  }

  if (containsPromptInjection(normalized) || containsPromptInjection(folded)) {
    return reject(MODERATION_REASON.PROMPT_INJECTION);
  }

  if (containsProfanity(normalized, folded)) {
    return reject(MODERATION_REASON.PROFANITY);
  }

  if (containsSexualServices(normalized, folded)) {
    return reject(MODERATION_REASON.SEXUAL_SERVICES);
  }

  if (containsDrugActivity(normalized, folded)) {
    return reject(MODERATION_REASON.DRUG_ACTIVITY);
  }

  if (containsCriminalActivity(normalized, folded)) {
    return reject(MODERATION_REASON.CRIMINAL_ACTIVITY);
  }

  return {
    allowed: true,

    reasonCode: null,

    message: null,

    normalized: cleaned,
  };
}

/*
 * Удобно для Express route.
 */
export function assertProfessionAllowed(value) {
  const result = moderateProfessionRequest(value);

  if (result.allowed) {
    return result.normalized;
  }

  const error = new Error(result.message);

  error.code = 'CONTENT_MODERATION_REJECTED';

  error.moderationReason = result.reasonCode;

  error.statusCode = 422;

  throw error;
}

/*
 * ============================================================
 * GENERATED DOCUMENT MODERATION
 * ============================================================
 *
 * Перед публикацией повторно проверяем:
 *
 * 1. profession;
 * 2. отсутствие мата в итоговом документе;
 * 3. отсутствие prompt-инструкций,
 *    случайно попавших в ответ генератора.
 *
 * Здесь специально НЕ делаем широкую проверку
 * любых упоминаний преступлений/наркотиков
 * во всех paragraphs:
 *
 * законная инструкция врача, охранника,
 * сотрудника лаборатории и т.д. может содержать
 * такие слова в нормальном профессиональном контексте.
 */

export function moderateGeneratedInstruction(instruction) {
  if (!instruction || typeof instruction !== 'object') {
    return reject(MODERATION_REASON.GENERATED_CONTENT);
  }

  const professionResult = moderateProfessionRequest(instruction.profession);

  if (!professionResult.allowed) {
    return professionResult;
  }

  const strings = [];

  strings.push(instruction.title, instruction.profession, instruction.intro);

  if (Array.isArray(instruction.sections)) {
    for (const section of instruction.sections) {
      strings.push(section?.heading);

      if (Array.isArray(section?.paragraphs)) {
        strings.push(...section.paragraphs);
      }
    }
  }

  const text = strings
    .filter(value => typeof value === 'string')
    .join('\n')
    .slice(0, 500000);

  const normalized = normalizeBase(text);

  const folded = foldLookalikes(text);

  if (containsProfanity(normalized, folded)) {
    return reject(MODERATION_REASON.PROFANITY);
  }

  if (containsPromptInjection(normalized)) {
    return reject(MODERATION_REASON.GENERATED_CONTENT);
  }

  return {
    allowed: true,

    reasonCode: null,

    message: null,

    normalized: professionResult.normalized,
  };
}

export function assertGeneratedInstructionAllowed(instruction) {
  const result = moderateGeneratedInstruction(instruction);

  if (result.allowed) {
    return true;
  }

  const error = new Error('Сгенерированный документ не прошёл проверку перед публикацией.');

  error.code = 'GENERATED_CONTENT_REJECTED';

  error.moderationReason = result.reasonCode;

  error.statusCode = 422;

  throw error;
}
