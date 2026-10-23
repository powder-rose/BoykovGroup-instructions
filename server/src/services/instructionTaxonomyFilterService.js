import { getInstructionTaxonomyAssignmentCatalog } from './instructionTaxonomyAssignmentCatalog.js';

function definitions(catalog) {
  return {
    categories: [...catalog.legacyCategories, ...catalog.sections],
    tags: [...catalog.legacyTags, ...catalog.tags],
  };
}

/** User-facing filters accept exact canonical IDs, never free-text or aliases. */
export function validateInstructionTaxonomyFilters(
  { category = '', tag = '' } = {},
  { catalog = getInstructionTaxonomyAssignmentCatalog() } = {},
) {
  const { categories, tags } = definitions(catalog);
  const categoriesById = new Set(categories.map(item => item.id));
  const tagsById = new Set(tags.map(item => item.id));
  if (typeof category !== 'string' || (category && !categoriesById.has(category))) {
    throw new TypeError('Unknown instruction category filter');
  }
  if (typeof tag !== 'string' || (tag && !tagsById.has(tag))) {
    throw new TypeError('Unknown instruction tag filter');
  }
  return { category, tag };
}

/** Filter stored assignments only: do not auto-classify existing records during search. */
export function filterInstructionsByTaxonomy(instructions, filters = {}, options = {}) {
  const { category, tag } = validateInstructionTaxonomyFilters(filters, options);
  const records = Array.isArray(instructions) ? instructions : [];

  if (!category && !tag) return [...records];

  return records.filter(instruction => {
    if (!instruction || typeof instruction !== 'object') return false;
    if (category && instruction.primaryCategoryId !== category) return false;
    if (tag && (!Array.isArray(instruction.tagIds) || !instruction.tagIds.includes(tag))) {
      return false;
    }
    return true;
  });
}

/** Only published assignments that actually exist are offered to public visitors. */
export function getInstructionTaxonomyFilterOptions(
  instructions,
  { catalog = getInstructionTaxonomyAssignmentCatalog() } = {},
) {
  const { categories, tags } = definitions(catalog);
  const categoriesById = new Set(categories.map(item => item.id));
  const tagsById = new Set(tags.map(item => item.id));
  const categoryCounts = new Map();
  const tagCounts = new Map();

  for (const instruction of Array.isArray(instructions) ? instructions : []) {
    if (!instruction || typeof instruction !== 'object') continue;
    if (
      String(instruction.status || '').toLowerCase() === 'draft' ||
      String(instruction.seoStatus || '').toLowerCase() === 'draft'
    )
      continue;
    if (categoriesById.has(instruction.primaryCategoryId)) {
      categoryCounts.set(
        instruction.primaryCategoryId,
        (categoryCounts.get(instruction.primaryCategoryId) || 0) + 1,
      );
    }
    if (Array.isArray(instruction.tagIds)) {
      for (const id of new Set(instruction.tagIds)) {
        if (!tagsById.has(id)) continue;
        tagCounts.set(id, (tagCounts.get(id) || 0) + 1);
      }
    }
  }

  return {
    categories: categories
      .filter(item => categoryCounts.has(item.id))
      .map(({ id, label }) => ({ id, label, count: categoryCounts.get(id) })),
    tags: tags
      .filter(item => tagCounts.has(item.id))
      .map(({ id, label, type }) => ({ id, label, type, count: tagCounts.get(id) })),
  };
}
