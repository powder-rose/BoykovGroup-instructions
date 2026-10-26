import { getInstructionTaxonomyAssignmentCatalog } from './instructionTaxonomyAssignmentCatalog.js';

function definitions(catalog) {
  return {
    categories: [...catalog.legacyCategories, ...catalog.sections],
    tags: [...catalog.legacyTags, ...catalog.tags],
  };
}

/** User-facing filters accept exact canonical IDs, never free-text or aliases. */
export function validateInstructionTaxonomyFilters(
  { category = '', tag = '', catalogId = '' } = {},
  { catalog = getInstructionTaxonomyAssignmentCatalog() } = {},
) {
  const { categories, tags } = definitions(catalog);
  const categoriesById = new Set(categories.map(item => item.id));
  const tagsById = new Set(tags.map(item => item.id));
  if (
    typeof catalogId !== 'string' ||
    (catalogId && !catalog.catalogs.some(item => item.id === catalogId))
  ) {
    throw new TypeError('Unknown instruction catalog filter');
  }
  if (typeof category !== 'string' || (category && !categoriesById.has(category))) {
    throw new TypeError('Unknown instruction category filter');
  }
  if (typeof tag !== 'string' || (tag && !tagsById.has(tag))) {
    throw new TypeError('Unknown instruction tag filter');
  }
  return { category, tag, ...(catalogId ? { catalogId } : {}) };
}

/** Filter stored assignments only: do not auto-classify existing records during search. */
export function filterInstructionsByTaxonomy(instructions, filters = {}, options = {}) {
  const catalog = options.catalog || getInstructionTaxonomyAssignmentCatalog();
  const { category, tag, catalogId } = validateInstructionTaxonomyFilters(filters, { catalog });
  const records = Array.isArray(instructions) ? instructions : [];

  if (!category && !tag && !catalogId) return [...records];
  const sectionIds = new Set(
    catalog.sections.filter(section => section.catalogId === catalogId).map(section => section.id),
  );

  return records.filter(instruction => {
    if (!instruction || typeof instruction !== 'object') return false;
    if (catalogId && !sectionIds.has(instruction.primaryCategoryId)) return false;
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
  const catalogCounts = new Map();
  const sectionCatalogs = new Map(catalog.sections.map(section => [section.id, section.catalogId]));
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
      const catalogId = sectionCatalogs.get(instruction.primaryCategoryId);
      if (catalogId) catalogCounts.set(catalogId, (catalogCounts.get(catalogId) || 0) + 1);
    }
    if (Array.isArray(instruction.tagIds)) {
      for (const id of new Set(instruction.tagIds)) {
        if (!tagsById.has(id)) continue;
        tagCounts.set(id, (tagCounts.get(id) || 0) + 1);
      }
    }
  }

  return {
    catalogs: catalog.catalogs.map(({ id, label }) => ({
      id,
      label,
      count: catalogCounts.get(id) || 0,
    })),
    categories: categories
      .filter(item => categoryCounts.has(item.id))
      .map(({ id, label }) => ({
        id,
        label,
        count: categoryCounts.get(id),
        ...(sectionCatalogs.has(id) ? { catalogId: sectionCatalogs.get(id) } : {}),
      })),
    tags: tags
      .filter(item => tagCounts.has(item.id))
      .map(({ id, label, type }) => ({ id, label, type, count: tagCounts.get(id) })),
  };
}
