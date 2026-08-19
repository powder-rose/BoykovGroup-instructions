import { PROFESSION_GENITIVE_OVERRIDES } from "../data/professionGenitiveOverrides.js";

/**
 * Возвращает профессию в родительном падеже — для названия документа вида
 * «Инструкция по охране труда для {профессия в род. падеже}».
 *
 * Раньше это склонение целиком отдавалось на откуп YandexGPT (в промпте
 * есть просьба «сформулируй название со склонением»), но модель делает это
 * не всегда надёжно — например, может оставить исходную форму без
 * склонения («для электромонтёр» вместо «для электромонтёра»). Поэтому
 * название теперь строится детерминированно в коде (см. yandexGptService.js),
 * а эта функция — единственное место, отвечающее за само склонение:
 *
 * 1. Сначала точный словарь PROFESSION_GENITIVE_OVERRIDES — вручную
 *    выверенные формы для всех профессий из очереди автогенерации
 *    (professionQueue.json). Для них результат гарантированно верный.
 * 2. Если профессии нет в словаре (например, админ вручную вбил в поиске
 *    профессию не из очереди) — эвристика по типичным окончаниям русских
 *    существительных/прилагательных. Не идеальна для всех возможных слов
 *    русского языка, но покрывает подавляющее большинство типичных
 *    названий должностей и рабочих профессий.
 */
export function getProfessionGenitive(profession) {
  const normalized = String(profession ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;

  const exact = PROFESSION_GENITIVE_OVERRIDES[normalized];
  if (exact) return exact;

  // Словарь нечувствителен к регистру/лишним пробелам — на случай, если
  // профессию ввели не в точности как в очереди (с большой буквы и т.п.).
  const lower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(PROFESSION_GENITIVE_OVERRIDES)) {
    if (key.toLowerCase() === lower) return value;
  }

  return declineProfessionHeuristic(normalized);
}

const ADJECTIVE_ENDING = /(ый|ой|ий|ая|яя|ое|ее)$/i;

function looksLikeAdjective(word) {
  return ADJECTIVE_ENDING.test(word);
}

function declineAdjective(word) {
  if (/ий$/i.test(word)) return word.slice(0, -2) + "его";
  if (/(ый|ой)$/i.test(word)) return word.slice(0, -2) + "ого";
  if (/ая$/i.test(word)) return word.slice(0, -2) + "ой";
  if (/яя$/i.test(word)) return word.slice(0, -2) + "ей";
  return word;
}

// Склоняет одно существительное (без пробелов) в родительный падеж —
// по типичным окончаниям русских существительных мужского/женского рода,
// используемых в названиях профессий.
function declineNoun(word) {
  if (!word) return word;

  // Причастие/прилагательное в роли существительного: «дежурный», «рабочий», «горнорабочий».
  if (/(ый|ой)$/i.test(word)) return word.slice(0, -2) + "ого";
  if (/ий$/i.test(word)) return word.slice(0, -2) + "его";

  // Беглая гласная перед «ец»: «кузнец» -> «кузнеца».
  if (/ец$/i.test(word) && word.length > 3) return word.slice(0, -2) + "ца";

  // Мягкий знак на конце мужского рода: «слесарь» -> «слесаря», «токарь» -> «токаря».
  if (/ь$/i.test(word)) return word.slice(0, -1) + "я";

  // Женский род на «-а»/«-я»: «сестра» -> «сестры», после шипящих/г,к,х — «-и».
  if (/[гкхжчшщ]а$/i.test(word)) return word.slice(0, -1) + "и";
  if (/а$/i.test(word)) return word.slice(0, -1) + "ы";
  if (/я$/i.test(word)) return word.slice(0, -1) + "и";

  // По умолчанию — обычное мужского рода существительное с окончанием
  // на согласную: «сварщик» -> «сварщика».
  return word + "а";
}

// Склоняет «голову» словосочетания — само слово или, если это составное
// слово через дефис («слесарь-ремонтник», «докер-механизатор»), каждую
// часть по отдельности («слесаря-ремонтника», «докера-механизатора»).
function declineHead(word) {
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => declineNoun(part))
      .join("-");
  }
  return declineNoun(word);
}

/**
 * Эвристическое склонение произвольной, не входящей в очередь, профессии.
 * Склоняет только «голову» словосочетания (первое слово/составное слово
 * через дефис) и, если это пара «прилагательное + существительное» —
 * оба слова. Остальная часть фразы (обычно уже управляемое дополнение —
 * «... технологического оборудования», «... по ремонту автомобилей»)
 * оставляется без изменений, так как её падеж не зависит от падежа
 * склоняемого слова.
 */
function declineProfessionHeuristic(profession) {
  const words = profession.split(" ");
  if (words.length === 1) {
    return declineHead(words[0]);
  }

  // Ведущая цепочка из одного или нескольких прилагательных перед
  // существительным, например «ветеринарный фельдшер», «системный
  // администратор», «младший научный сотрудник» — склоняем каждое
  // прилагательное в цепочке и следующее за ней существительное.
  let adjectiveCount = 0;
  while (adjectiveCount < words.length - 1 && looksLikeAdjective(words[adjectiveCount])) {
    adjectiveCount++;
  }
  if (adjectiveCount > 0) {
    const declinedAdjectives = words.slice(0, adjectiveCount).map(declineAdjective);
    const declinedNoun = declineHead(words[adjectiveCount]);
    const rest = words.slice(adjectiveCount + 1).join(" ");
    return [...declinedAdjectives, declinedNoun, rest].filter(Boolean).join(" ");
  }

  // «существительное + прилагательное», например «крановщик портальный»,
  // «трубопроводчик судовой» — ровно два слова, второе явно прилагательное.
  if (words.length === 2 && looksLikeAdjective(words[1])) {
    return `${declineHead(words[0])} ${declineAdjective(words[1])}`;
  }

  // Общий случай: склоняем только первое слово, остальное — уже управляемая
  // (например, родительным падежом) зависимая часть фразы без изменений.
  const rest = words.slice(1).join(" ");
  return [declineHead(words[0]), rest].filter(Boolean).join(" ");
}
