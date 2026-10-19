import { getInstructionTaxonomyCatalog } from './instructionTaxonomyService.js';

// Use the same versioned dictionary as auto assignment and the admin editor.
// Only public labels and stable IDs reach instruction pages; no editorial metadata.
const catalog = getInstructionTaxonomyCatalog();
const categoriesById = new Map(catalog.categories.map(({ id, label }) => [id, label]));
const tagsById = new Map(catalog.tags.map(({ id, label }) => [id, label]));

export function getInstructionTaxonomyDisplay(instruction) {
  if (!instruction || typeof instruction !== 'object' || Array.isArray(instruction)) {
    return null;
  }

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
      if (tags.length === 5) break;
    }
  }

  return category || tags.length ? { category, tags } : null;
}
