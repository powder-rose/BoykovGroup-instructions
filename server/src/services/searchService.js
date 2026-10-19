import { instructionsRepository } from './instructionsRepository.js';

import { getInstructionPopularity } from './instructionPopularityService.js';

import { normalizeProfessionKey } from './professionNormalizer.js';
import { filterInstructionsByTaxonomy } from './instructionTaxonomyFilterService.js';

/*
 * SEARCH V4
 *
 * Цель:
 * - точные совпадения выше всего;
 * - учитывать ё/е;
 * - учитывать дефисы;
 * - учитывать русские окончания;
 * - допускать небольшие опечатки;
 * - находить близкие профессии;
 * - не искать по intro/content;
 * - не показывать случайные совпадения.
 */

const SEARCH_STOP_WORDS = new Set([
  'инструкция',
  'инструкции',
  'иот',

  'охрана',
  'охраны',
  'труда',

  'для',
  'при',
  'по',

  'в',
  'во',
  'на',
  'с',
  'со',
  'к',
  'от',
  'из',

  'работа',
  'работе',
  'работах',
  'работы',
  'работ',

  'выполнение',
  'выполнении',
]);

/*
 * Строка для поискового сравнения.
 *
 * электромонтёр
 * электромонтер
 *
 * становятся одинаковыми.
 *
 * слесарь-ремонтник
 * слесарь ремонтник
 *
 * тоже становятся одинаковыми.
 */
function normalizeSearchText(value = '') {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[-‐-‒–—―_/\\]+/g, ' ')
    .replace(/[^a-zа-я0-9\s]/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuery(value = '') {
  return normalizeSearchText(value)
    .replace(/^инструкция\s+по\s+охране\s+труда\s*/u, '')
    .replace(/^иот\s*/u, '')
    .replace(/^для\s+/u, '')
    .trim();
}

function normalizeTitleCore(value = '') {
  return normalizeSearchText(value)
    .replace(/^инструкция\s+по\s+охране\s+труда\s*/u, '')
    .replace(/^для\s+/u, '')
    .trim();
}

function tokenize(value = '') {
  const all = normalizeSearchText(value).split(' ').filter(Boolean);

  const meaningful = all.filter(token => !SEARCH_STOP_WORDS.has(token));

  /*
   * Если пользователь ввёл только
   * служебное слово, не превращаем
   * запрос в пустой.
   */
  return meaningful.length ? meaningful : all;
}

function timestamp(value) {
  const result = Date.parse(String(value ?? ''));

  return Number.isFinite(result) ? result : 0;
}

function compareNewest(a, b) {
  const difference = timestamp(b?.createdAt) - timestamp(a?.createdAt);

  if (difference !== 0) {
    return difference;
  }

  return String(a?.title ?? '').localeCompare(String(b?.title ?? ''), 'ru');
}

function getPopularityMap(instructionCount) {
  try {
    const result = getInstructionPopularity({
      period: 'total',

      limit: Math.max(5000, instructionCount),
    });

    const rows = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];

    const map = new Map();

    for (const row of rows) {
      const id = String(row?.id ?? '');

      if (!id) {
        continue;
      }

      const views = Number(row?.total ?? row?.views ?? row?.viewCount ?? row?.count ?? 0);

      map.set(
        id,

        Number.isFinite(views) ? views : 0,
      );
    }

    return map;
  } catch (error) {
    console.error('Instruction popularity sorting error:', error);

    return new Map();
  }
}

function sortInstructions(instructions, sortMode, allCount) {
  const items = [...instructions];

  if (sortMode === 'popular') {
    const popularity = getPopularityMap(allCount);

    items.sort((a, b) => {
      const aViews = popularity.get(String(a?.id ?? '')) ?? 0;

      const bViews = popularity.get(String(b?.id ?? '')) ?? 0;

      if (aViews !== bViews) {
        return bViews - aViews;
      }

      return compareNewest(a, b);
    });

    return items;
  }

  return items.sort(compareNewest);
}

/*
 * Levenshtein нужен только для
 * небольших опечаток.
 *
 * Например:
 *
 * электромонтер
 * электромонетр
 */
function levenshteinDistance(first, second) {
  if (first === second) {
    return 0;
  }

  if (!first) {
    return second.length;
  }

  if (!second) {
    return first.length;
  }

  const previous = Array.from(
    {
      length: second.length + 1,
    },

    (_, index) => index,
  );

  for (let i = 1; i <= first.length; i += 1) {
    let diagonal = previous[0];

    previous[0] = i;

    for (let j = 1; j <= second.length; j += 1) {
      const old = previous[j];

      const cost = first[i - 1] === second[j - 1] ? 0 : 1;

      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);

      diagonal = old;
    }
  }

  return previous[second.length];
}

function commonPrefixLength(first, second) {
  const limit = Math.min(first.length, second.length);

  let index = 0;

  while (index < limit && first[index] === second[index]) {
    index += 1;
  }

  return index;
}

/*
 * Сравнение отдельных слов.
 *
 * 1.00 — полное совпадение
 * 0.95 — начало слова
 * ~0.86 — близкая словоформа
 * ~0.80 — небольшая опечатка
 */
function tokenSimilarity(first, second) {
  if (first === second) {
    return 1;
  }

  if (!first || !second) {
    return 0;
  }

  const shorter = first.length <= second.length ? first : second;

  const longer = first.length > second.length ? first : second;

  /*
   * Частичный ввод:
   *
   * бухгал
   * бухгалтер
   *
   * электромонт
   * электромонтер
   */
  if (shorter.length >= 3 && longer.startsWith(shorter)) {
    return shorter.length === 3 ? 0.91 : 0.96;
  }

  /*
   * Русские окончания:
   *
   * библиотекарь / библиотекаря
   * машинист / машиниста
   * пожарная / пожарной
   */
  const prefix = commonPrefixLength(first, second);

  const prefixRatio = prefix / Math.min(first.length, second.length);

  if (prefix >= 5 && prefixRatio >= 0.72) {
    return Math.min(0.93, 0.82 + prefixRatio * 0.1);
  }

  /*
   * Опечатки разрешаем только
   * для достаточно длинных слов.
   */
  const maxLength = Math.max(first.length, second.length);

  if (maxLength < 5) {
    return 0;
  }

  const distance = levenshteinDistance(first, second);

  const allowedDistance = maxLength >= 9 ? 2 : 1;

  if (distance > allowedDistance) {
    return 0;
  }

  const similarity = 1 - distance / maxLength;

  return similarity >= 0.76 ? similarity : 0;
}

function getTokenCoverage(queryTokens, candidateTokens) {
  if (!queryTokens.length || !candidateTokens.length) {
    return null;
  }

  const scores = [];

  for (const queryToken of queryTokens) {
    let best = 0;

    for (const candidateToken of candidateTokens) {
      best = Math.max(best, tokenSimilarity(queryToken, candidateToken));
    }

    /*
     * Ключевое ограничение.
     *
     * КАЖДОЕ значимое слово
     * поискового запроса должно
     * найти достаточно близкое
     * слово в профессии.
     */
    if (best < 0.72) {
      return null;
    }

    scores.push(best);
  }

  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function getAlias(value = '') {
  return normalizeSearchText(normalizeProfessionKey(normalizeSearchText(value)));
}

function getSearchScore(instruction, query, { allowPartialMatch = false } = {}) {
  const queryNormalized = normalizeQuery(query);

  if (!queryNormalized) {
    return 0;
  }

  const profession = normalizeSearchText(instruction?.profession ?? '');

  const title = normalizeTitleCore(instruction?.title ?? '');

  const queryTokens = tokenize(queryNormalized);

  const professionTokens = tokenize(profession);

  const titleTokens = tokenize(title);

  /*
   * 1. Полное совпадение.
   */
  if (profession === queryNormalized) {
    return 1000;
  }

  if (title === queryNormalized) {
    return 990;
  }

  /*
   * SEARCH_WORD_FORM_PRIORITY_V1
   *
   * В импортированных документах profession
   * иногда хранится в родительном падеже:
   *
   * администратор  -> администратора
   * библиотекарь   -> библиотекаря
   * водитель       -> водителя
   *
   * Такая форма должна быть релевантнее,
   * чем точное совпадение слова внутри
   * более длинной профессии:
   *
   * "администратора"
   * выше
   * "системный администратор".
   */
  if (queryTokens.length === 1 && professionTokens.length === 1) {
    const singleTokenScore = tokenSimilarity(queryTokens[0], professionTokens[0]);

    if (singleTokenScore >= 0.72) {
      return 960 + Math.round(singleTokenScore * 25);
    }
  }

  /*
   * Если искомая профессия стоит первым
   * словом, такой вариант тоже должен
   * быть выше совпадения где-то внутри.
   *
   * администратор
   * -> администратора гостиницы
   * -> администратора офиса
   *
   * выше:
   * -> системный администратор
   */
  if (queryTokens.length === 1 && professionTokens.length > 1) {
    const firstTokenScore = tokenSimilarity(queryTokens[0], professionTokens[0]);

    if (firstTokenScore >= 0.72) {
      return 920 + Math.round(firstTokenScore * 20);
    }
  }

  /*
   * 2. Профессия начинается
   * непосредственно с запроса.
   */
  if (profession.startsWith(queryNormalized + ' ')) {
    return 940;
  }

  if (title.startsWith(queryNormalized + ' ')) {
    return 930;
  }

  /*
   * 3. Все слова запроса
   * присутствуют буквально.
   */
  const exactProfessionMatch =
    queryTokens.length > 0 && queryTokens.every(token => professionTokens.includes(token));

  if (exactProfessionMatch) {
    return 900;
  }

  /*
   * 4. Все слова запроса
   * совпали с учётом окончаний,
   * частичного ввода и опечаток.
   */
  const professionCoverage = getTokenCoverage(queryTokens, professionTokens);

  if (professionCoverage !== null) {
    return 750 + Math.round(professionCoverage * 120);
  }

  /*
   * 5. Контролируемые синонимы
   * из professionNormalizer.
   *
   * Например:
   *
   * электрик
   * электромонтажник
   * электромонтер
   *
   * Но многословный запрос
   * нельзя сводить к слишком
   * общей профессии.
   */
  const queryAlias = getAlias(queryNormalized);

  const professionAlias = getAlias(profession);

  if (
    queryAlias &&
    professionAlias &&
    queryAlias === professionAlias &&
    (queryTokens.length === 1 || professionTokens.length >= queryTokens.length)
  ) {
    return 800;
  }

  /*
   * 6. Title — резервный источник.
   *
   * intro/content намеренно
   * НЕ используются.
   */
  const titleCoverage = getTokenCoverage(queryTokens, titleTokens);

  if (titleCoverage !== null) {
    return 710 + Math.round(titleCoverage * 80);
  }

  if (allowPartialMatch) {
    // Related documents may share a profession without sharing every qualifier in an H1.
    const meaningfulQuery = queryTokens.filter(
      token => token.length >= 4 && !SEARCH_STOP_WORDS.has(token),
    );
    const candidates = [...new Set([...professionTokens, ...titleTokens])].filter(
      token => token.length >= 4 && !SEARCH_STOP_WORDS.has(token),
    );
    const matches = meaningfulQuery
      .map(token => Math.max(0, ...candidates.map(candidate => tokenSimilarity(token, candidate))))
      .filter(score => score >= 0.82);

    if (matches.length) {
      const coverage = matches.reduce((sum, value) => sum + value, 0) / meaningfulQuery.length;

      return 100 + Math.round(coverage * 400);
    }
  }

  return 0;
}

/*
 * Минимальный проходной балл.
 *
 * Случайные приблизительные
 * совпадения ниже него
 * вообще не показываем.
 */
const MIN_SEARCH_SCORE = 750;

/*
 * Используется и API-каталогом,
 * и SEO-поиском.
 */
export function rankInstructionsByQuery(
  instructions,
  query,
  { sort = 'relevance', allowPartialMatch = false } = {},
) {
  const input = Array.isArray(instructions) ? instructions : [];

  const trimmed = String(query ?? '').trim();

  if (!trimmed) {
    return [...input];
  }

  const ranked = input
    .map(instruction => ({
      instruction,

      score: getSearchScore(instruction, trimmed, { allowPartialMatch }),
    }))
    .filter(item => item.score >= (allowPartialMatch ? 1 : MIN_SEARCH_SCORE));

  const popularity = sort === 'popular' ? getPopularityMap(input.length) : null;

  ranked.sort((a, b) => {
    /*
     * Релевантность ВСЕГДА
     * важнее даты/популярности.
     */
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    if (sort === 'popular') {
      const aViews = popularity.get(String(a.instruction?.id ?? '')) ?? 0;

      const bViews = popularity.get(String(b.instruction?.id ?? '')) ?? 0;

      if (aViews !== bViews) {
        return bViews - aViews;
      }
    }

    if (sort === 'newest') {
      const newest = compareNewest(a.instruction, b.instruction);

      if (newest !== 0) {
        return newest;
      }
    }

    return String(a.instruction?.title ?? '').localeCompare(
      String(b.instruction?.title ?? ''),
      'ru',
      {
        sensitivity: 'base',
      },
    );
  });

  return ranked.map(item => item.instruction);
}

function toSummary(instruction) {
  return {
    id: instruction.id,

    slug: instruction.slug || instruction.id,

    title: instruction.title,

    profession: instruction.profession,

    source: instruction.source,

    createdAt: instruction.createdAt,
  };
}

export function searchInstructions(
  query,
  { page = 1, pageSize = 6, sort = 'newest', category = '', tag = '' } = {},
) {
  const all = filterInstructionsByTaxonomy(instructionsRepository.getAll(), { category, tag });

  const trimmed = String(query ?? '').trim();

  const sortMode = sort === 'popular' ? 'popular' : 'newest';

  let matched;

  if (!trimmed) {
    /*
     * Без поискового запроса
     * поведение каталога остаётся
     * прежним.
     */
    matched = sortInstructions(all, sortMode, all.length);
  } else {
    /*
     * При поиске:
     *
     * relevance →
     * выбранная сортировка
     * только как tie-breaker.
     */
    matched = rankInstructionsByQuery(all, trimmed, {
      sort: sortMode,
    });
  }

  const normalizedPageSize = Math.max(1, Math.min(200, Number.parseInt(pageSize, 10) || 6));

  const total = matched.length;

  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));

  const safePage = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), totalPages);

  const start = (safePage - 1) * normalizedPageSize;

  const items = matched.slice(start, start + normalizedPageSize).map(toSummary);

  return {
    items,

    page: safePage,

    pageSize: normalizedPageSize,

    total,

    totalPages,

    query: trimmed,

    sort: sortMode,
  };
}
