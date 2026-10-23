import { getLegacyInstructionTaxonomyCatalog } from './instructionTaxonomySource.js';
import { validateInstructionTaxonomyAssignment } from './instructionTaxonomyAssignmentCatalog.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';

const MAX_AUTO_TAGS = 5;
const WORD_BOUNDARY =
  '(?:(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}]))';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TAG_TYPES = new Set(['profession', 'work', 'equipment']);
const PROFESSION_SCOPES = new Set(['core', 'phrase']);

const catalog = getLegacyInstructionTaxonomyCatalog();

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 1000);
}

function compilePattern(pattern) {
  // JavaScript's native \b does not treat Cyrillic as word characters.
  return new RegExp(String(pattern).replaceAll('\\b', WORD_BOUNDARY).replaceAll('ё', 'е'), 'iu');
}

export function validateInstructionTaxonomyCatalog(data) {
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.tags)) {
    throw new Error('Taxonomy catalog must contain categories and tags');
  }

  const categoryIds = new Set();
  const categorySlugs = new Set();
  const tagIds = new Set();
  const tagSlugs = new Set();
  const tagNames = new Map();

  for (const item of data.categories) {
    if (!SLUG_PATTERN.test(item?.id || '') || !SLUG_PATTERN.test(item?.slug || '')) {
      throw new Error('Invalid category identifier');
    }
    if (categoryIds.has(item.id) || categorySlugs.has(item.slug)) {
      throw new Error(`Duplicate category: ${item.id}`);
    }
    if (item.indexPolicy !== 'noindex') {
      throw new Error('New categories must be noindex until editorial approval');
    }
    categoryIds.add(item.id);
    categorySlugs.add(item.slug);
  }

  for (const item of data.tags) {
    if (!SLUG_PATTERN.test(item?.id || '') || !SLUG_PATTERN.test(item?.slug || '')) {
      throw new Error('Invalid tag identifier');
    }
    if (tagIds.has(item.id) || tagSlugs.has(item.slug)) {
      throw new Error(`Duplicate tag: ${item.id}`);
    }
    if (!TAG_TYPES.has(item.type)) {
      throw new Error(`Unknown tag type: ${item.id}`);
    }
    if (item.indexPolicy !== 'noindex') {
      throw new Error('New tag pages must be noindex until editorial approval');
    }
    if (!Array.isArray(item.aliases) || !item.label || !item.suggestionRule?.pattern) {
      throw new Error(`Invalid tag definition: ${item.id}`);
    }
    if (item.suggestionRule.field !== (item.type === 'profession' ? 'profession' : 'title')) {
      throw new Error(`Invalid suggestion source: ${item.id}`);
    }
    if (
      item.suggestionRule.scope !== undefined &&
      (item.type !== 'profession' || !PROFESSION_SCOPES.has(item.suggestionRule.scope))
    ) {
      throw new Error(`Invalid profession suggestion scope: ${item.id}`);
    }

    compilePattern(item.suggestionRule.pattern);
    if (item.suggestionRule.excludePattern) {
      compilePattern(item.suggestionRule.excludePattern);
    }

    for (const label of [item.label, ...item.aliases]) {
      if (typeof label !== 'string' || !label.trim()) {
        throw new Error(`Invalid alias: ${item.id}`);
      }
      const normalized = normalizeText(label);
      const owner = tagNames.get(normalized);
      if (owner && owner !== item.id) {
        throw new Error(`Conflicting tag alias: ${label}`);
      }
      tagNames.set(normalized, item.id);
    }

    tagIds.add(item.id);
    tagSlugs.add(item.slug);
  }

  return true;
}

// The catalog is versioned and committed, not generated from live user queries.
validateInstructionTaxonomyCatalog(catalog);

const categoriesById = new Map(catalog.categories.map(item => [item.id, item]));
const tagsById = new Map(catalog.tags.map(item => [item.id, item]));
const preparedTags = catalog.tags.map(tag => ({
  tag,
  pattern: compilePattern(tag.suggestionRule.pattern),
  exclude: tag.suggestionRule.excludePattern
    ? compilePattern(tag.suggestionRule.excludePattern)
    : null,
}));

// High-specificity evidence wins over generic words such as "слесарь", "водитель"
// and "менеджер". Equal scores are left for an editor to resolve.
const categorySignals = [
  [
    'medical',
    12,
    /врач[а-я]*|медицинск|медсестр|акушерк|фельдшер|фармацевт|провизор|рентген|стоматолог|клиник|поликлиник|эпидемиолог|педиатр|хирург|санитарк/iu,
  ],
  [
    'agriculture',
    12,
    /сельскохозяйствен|агроном|ветеринар|животновод|дояр|комбайнер|тракторист|механизатор|птицевод|зоотехник|пастух/iu,
  ],
  [
    'warehouse',
    12,
    /погрузчик|электроштабел|складск|кладовщ|грузчик|стропальщик|такелаж|грузоподъемн|грузоподъёмн|погрузочно-разгрузочн/iu,
  ],
  [
    'electrical',
    12,
    /электромонт|электрик|электроустанов|кабельщик|электролаборат|электротехнич|электроснабжен|подстанц|кипиа|энергетик/iu,
  ],
  [
    'property',
    12,
    /сантехник|дворник|уборщ|клинер|клининг|водопровод|канализац|котельн|теплов[а-я]* сет|жкх|обслуживани[а-я]* здан|очистн[а-я]* сооружен/iu,
  ],
  [
    'retail',
    12,
    /повар|официант|бариста|бармен|кондитер|пекар|кухонн|продавец|продавца|продавщиц|гостиниц|горничн|хаускипинг|сушист|хостес/iu,
  ],
  [
    'construction',
    12,
    /каменщик|бетонщик|кровельщ|штукатур|маляр|плиточн|арматурщик|строительно-монтажн|строительн[а-я]* лес|геодезист/iu,
  ],
  [
    'transport',
    11,
    /(?<![\p{L}\p{N}])водител|автомобил|автобус|автоколонн|автотранспорт|автослесар|бульдозер|экскаватор|железнодорожн|автокран|диспетчер автомобильного/iu,
  ],
  [
    'manufacturing',
    11,
    /аппаратчик|токар|фрезеровщик|станочн|станк[аеуах]|сварщик|литейщик|штамповщик|шлифовщик|флексограф|прокатн[а-я]* стан|пескоструйщик/iu,
  ],
  [
    'office',
    11,
    /бухгалтер|программист|системн[а-я]* администратор|юриск|юрист|кадров|делопроизвод|офисн|секретар|аналитик|маркетинг|разработчик|копирайтер|финансист|экономист/iu,
  ],
  ['retail', 8, /магазин|розничн|общепит|ресторан|кафе|торгов[а-я]* зал/iu],
  ['warehouse', 8, /склад[аеу]|погрузк|разгрузк|складирован|перемещени[яе] груз|комплектовщик/iu],
  [
    'construction',
    8,
    /(?<![\p{L}\p{N}])строител(?:ь|я|ю|ем|и|ей|ями|ях|ям)(?![\p{L}\p{N}])|строительств[а-я]*|строительн[а-я]* (?:работ|участ|организац|контрол|цех|отдел|конструкц|и монтажн)|монтаж[а-я]* конструкц|землян[а-я]* работ/iu,
  ],
  ['transport', 7, /спецтехник|автохозяйств|машинист[а-я]* крана/iu],
  ['property', 7, /уборк[аеи]|эксплуатац[а-я]* здан|насосн[а-я]* станц/iu],
  [
    'manufacturing',
    6,
    /производственн[а-я]* лини|технологическ[а-я]* установ|цех[ауе]|производств[а-я]* оборудован/iu,
  ],
  ['office', 6, /директор|руководител|менеджер|административн/iu],
];

function getProfessionPhrase(instruction, title) {
  const profession = normalizeText(instruction?.profession);
  if (profession) {
    return /^(?:при|во время|в ходе)\s/u.test(profession) ? '' : profession;
  }
  return title.match(/^инструкци[яи] по охране труда для\s+(.+)$/u)?.[1] || '';
}

function getProfessionCore(profession) {
  // A mention in a specialization is not the holder's profession:
  // "medical nurse of a surgeon" is a nurse, not a surgeon.
  if (/^медицинск[а-я]* сестр[а-я]*/u.test(profession)) {
    return profession.match(/^медицинск[а-я]* сестр[а-я]*/u)?.[0] || profession;
  }
  if (/^(?:ассистент|помощник)[а-я]* врач/u.test(profession)) {
    return profession.split(' ')[0];
  }

  return profession.split(/\s+(?:по|при|на|в|для|с|со|из|от|над|под)\s/u)[0];
}

function suggestCategory(text) {
  let maximum = 0;
  const matched = new Set();

  for (const [id, score, regex] of categorySignals) {
    if (!regex.test(text)) continue;
    if (score > maximum) {
      maximum = score;
      matched.clear();
    }
    if (score === maximum) matched.add(id);
  }

  return matched.size === 1 ? [...matched][0] : null;
}

export function getInstructionTaxonomyCatalog() {
  return structuredClone(catalog);
}

export function validateInstructionTaxonomySelection({
  primaryCategoryId = null,
  tagIds = [],
} = {}) {
  if (primaryCategoryId !== null && !categoriesById.has(primaryCategoryId)) {
    throw new Error(`Unknown category: ${primaryCategoryId}`);
  }
  if (!Array.isArray(tagIds) || tagIds.length > MAX_AUTO_TAGS) {
    throw new Error(`Tag IDs must be an array of at most ${MAX_AUTO_TAGS} items`);
  }
  if (new Set(tagIds).size !== tagIds.length) {
    throw new Error('Duplicate tag IDs are not allowed');
  }
  for (const id of tagIds) {
    if (!tagsById.has(id)) throw new Error(`Unknown tag: ${id}`);
  }
  return true;
}

export function suggestInstructionTaxonomy(instruction) {
  const title = normalizeText(instruction?.title);
  const profession = getProfessionPhrase(instruction, title);
  const text = normalizeText(`${title} ${profession}`);
  const primaryCategoryId = suggestCategory(text);
  const role = getProfessionCore(profession);

  const tagIds = preparedTags
    .filter(({ tag, pattern, exclude }) => {
      const subject =
        tag.type === 'profession'
          ? tag.suggestionRule.scope === 'phrase'
            ? profession
            : role
          : title;
      return subject && pattern.test(subject) && (!exclude || !exclude.test(subject));
    })
    .sort((a, b) => {
      const priority = { profession: 0, work: 1, equipment: 2 };
      return priority[a.tag.type] - priority[b.tag.type];
    })
    .slice(0, MAX_AUTO_TAGS)
    .map(({ tag }) => tag.id);

  return {
    primaryCategoryId,
    tagIds,
    needsReview: !primaryCategoryId || tagIds.length === 0,
  };
}

export function prepareInstructionTaxonomy(
  instruction,
  { registry = instructionTaxonomyRegistryRepository.read() } = {},
) {
  if (!instruction || typeof instruction !== 'object' || Array.isArray(instruction)) {
    throw new Error('An instruction object is required');
  }

  validateInstructionTaxonomyAssignment(
    {
      primaryCategoryId: instruction.primaryCategoryId ?? null,
      tagIds: instruction.tagIds ?? [],
    },
    { registry },
  );

  const codedSection = registry.sections.some(item => item.code === instruction.primaryCategoryId);
  const codedTags = new Set(registry.tags.map(item => item.code));
  const hasCodedTags = instruction.tagIds?.some(id => codedTags.has(id)) || false;
  const suggested = suggestInstructionTaxonomy(instruction);
  const oldMeta = instruction.taxonomyMeta ?? {};
  const categoryManual = codedSection || oldMeta.categorySource === 'manual';
  const tagsManual = codedSection || hasCodedTags || oldMeta.tagsSource === 'manual';
  const primaryCategoryId = categoryManual
    ? (instruction.primaryCategoryId ?? null)
    : suggested.primaryCategoryId;
  const tagIds = tagsManual ? (instruction.tagIds ?? []) : suggested.tagIds;

  if (codedSection || hasCodedTags) {
    validateInstructionTaxonomyAssignment({ primaryCategoryId, tagIds }, { registry });
  } else {
    validateInstructionTaxonomySelection({ primaryCategoryId, tagIds });
  }

  return {
    ...instruction,
    primaryCategoryId,
    tagIds,
    taxonomyMeta: {
      ...oldMeta,
      categorySource: categoryManual ? 'manual' : primaryCategoryId ? 'auto' : 'unassigned',
      tagsSource: tagsManual ? 'manual' : tagIds.length ? 'auto' : 'unassigned',
      needsReview: !primaryCategoryId || (!codedSection && tagIds.length === 0),
      schemaVersion: catalog.version,
    },
  };
}
