import { getInstructionTaxonomyAssignmentCatalog } from './instructionTaxonomyAssignmentCatalog.js';

export function getInstructionTaxonomyDisplay(
  instruction,
  { catalog = getInstructionTaxonomyAssignmentCatalog() } = {},
) {
  if (!instruction || typeof instruction !== 'object' || Array.isArray(instruction)) {
    return null;
  }

  const categoriesById = new Map(
    [...catalog.legacyCategories, ...catalog.sections].map(({ id, label }) => [id, label]),
  );
  const tagsById = new Map(
    [...catalog.legacyTags, ...catalog.tags].map(({ id, label }) => [id, label]),
  );
  const categoryLabel = categoriesById.get(instruction.primaryCategoryId);
  const category = categoryLabel
    ? { id: instruction.primaryCategoryId, label: categoryLabel }
    : null;

  const tags = [];
  const seen = new Set();

  if (Array.isArray(instruction.tagIds)) {
    for (const id of instruction.tagIds) {
      const label = tagsById.get(id);
      if (!label || seen.has(id)) continue;
      tags.push({ id, label });
      seen.add(id);
    }
  }

  return category || tags.length ? { category, tags } : null;
}
