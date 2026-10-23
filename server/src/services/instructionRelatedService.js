import { rankInstructionsByQuery } from './searchService.js';

function compareTitles(first, second) {
  return (
    first.title.localeCompare(second.title, 'ru', { sensitivity: 'base' }) ||
    first.id.localeCompare(second.id)
  );
}

function isPublished(instruction) {
  return (
    instruction &&
    typeof instruction.id === 'string' &&
    instruction.id &&
    typeof instruction.title === 'string' &&
    instruction.title.trim() &&
    String(instruction.status || '').toLowerCase() !== 'draft' &&
    String(instruction.seoStatus || '').toLowerCase() !== 'draft'
  );
}

export function rankRelatedInstructions(instruction, records, { limit = 8, catalog } = {}) {
  const maximum = Number.isFinite(limit) ? Math.max(0, Math.min(Math.trunc(limit), 8)) : 8;
  if (!instruction || !maximum) return [];

  const categories = new Set(
    [...(catalog?.sections || []), ...(catalog?.legacyCategories || [])].map(item => item.id),
  );
  const tags = new Set(
    [...(catalog?.tags || []), ...(catalog?.legacyTags || [])].map(item => item.id),
  );
  const ownTags = new Set((instruction.tagIds || []).filter(id => tags.has(id)));
  const category = categories.has(instruction.primaryCategoryId)
    ? instruction.primaryCategoryId
    : null;
  const ownSlug = instruction.slug || instruction.id;
  const candidates = records.filter(
    item => isPublished(item) && item.id !== instruction.id && (item.slug || item.id) !== ownSlug,
  );
  const preferred = candidates
    .map(item => ({
      instruction: item,
      sameSection: Boolean(category && item.primaryCategoryId === category),
      sharedTags: new Set((item.tagIds || []).filter(id => ownTags.has(id))).size,
    }))
    .filter(item => item.sameSection || item.sharedTags)
    .sort(
      (first, second) =>
        Number(second.sameSection) - Number(first.sameSection) ||
        second.sharedTags - first.sharedTags ||
        compareTitles(first.instruction, second.instruction),
    )
    .map(item => item.instruction);
  const preferredRecords = new Set(preferred);
  const query = instruction.profession || instruction.title;
  const fallback = String(query || '').trim()
    ? rankInstructionsByQuery(
        candidates.filter(item => !preferredRecords.has(item)),
        query,
        { sort: 'relevance', allowPartialMatch: true },
      )
    : [];
  const ids = new Set();
  const slugs = new Set();
  const result = [];

  for (const item of [...preferred, ...fallback]) {
    const slug = item.slug || item.id;
    if (ids.has(item.id) || slugs.has(slug)) continue;
    ids.add(item.id);
    slugs.add(slug);
    result.push(item);
    if (result.length === maximum) break;
  }

  return result;
}
