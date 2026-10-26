import { InstructionEditorError } from './instructionEditorError.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';
import { getLegacyInstructionTaxonomyCatalog } from './instructionTaxonomySource.js';
import { getInstructionTaxonomyEntityPath } from './instructionTaxonomyRegistryModel.js';

const legacy = getLegacyInstructionTaxonomyCatalog();
const legacyCategories = new Set(legacy.categories.map(item => item.id));
const legacyTags = new Set(legacy.tags.map(item => item.id));

function invalid(message) {
  return new InstructionEditorError(message, { code: 'INVALID_INSTRUCTION_TAXONOMY' });
}

function ordered(items) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

export function getInstructionTaxonomyAssignmentCatalog(
  registry = instructionTaxonomyRegistryRepository.read(),
) {
  const publicCatalogs = new Set(
    registry.catalogs
      .filter(item => item.status === 'published' && item.routeApproved)
      .map(item => item.code),
  );
  const publicPath = entity =>
    entity.status === 'published' &&
    (entity.kind === 'tag' ||
      publicCatalogs.has(entity.kind === 'catalog' ? entity.code : entity.parentCode))
      ? { path: getInstructionTaxonomyEntityPath(registry, entity.kind, entity.code) }
      : {};
  return {
    revision: registry.revision,
    catalogs: ordered(registry.catalogs).map(entity => ({
      id: entity.code,
      label: entity.name,
      ...publicPath(entity),
    })),
    sections: ordered(registry.sections).map(entity => ({
      id: entity.code,
      label: entity.name,
      catalogId: entity.parentCode,
      ...publicPath(entity),
    })),
    tags: ordered(registry.tags).map(entity => ({
      id: entity.code,
      label: entity.name,
      type: 'topic',
      ...publicPath(entity),
    })),
    legacyCategories: legacy.categories.map(({ id, label }) => ({ id, label })),
    legacyTags: legacy.tags.map(({ id, label, type }) => ({ id, label, type })),
  };
}

export function validateInstructionTaxonomyAssignment(
  selection,
  { registry = instructionTaxonomyRegistryRepository.read(), requireSection = false } = {},
) {
  if (
    !selection ||
    typeof selection !== 'object' ||
    Array.isArray(selection) ||
    Object.keys(selection).some(key => !['primaryCategoryId', 'tagIds'].includes(key))
  ) {
    throw invalid('Передайте основной раздел и теги без отдельного поля каталога');
  }
  const primaryCategoryId = selection.primaryCategoryId ?? null;
  const section = registry.sections.find(item => item.code === primaryCategoryId);
  if (primaryCategoryId !== null && !section && !legacyCategories.has(primaryCategoryId)) {
    throw invalid(`Unknown category: ${primaryCategoryId}`);
  }
  if (requireSection && !section) {
    throw invalid('Выберите один основной тематический раздел');
  }
  const tagIds = selection.tagIds === undefined ? [] : selection.tagIds;
  if (!Array.isArray(tagIds) || new Set(tagIds).size !== tagIds.length) {
    throw invalid('Теги должны быть списком без повторений');
  }
  const codedTags = new Set(registry.tags.map(item => item.code));
  for (const id of tagIds) {
    if (typeof id !== 'string' || (!legacyTags.has(id) && !codedTags.has(id))) {
      throw invalid(`Unknown tag: ${id}`);
    }
  }
  return { primaryCategoryId, tagIds: [...tagIds], catalogCode: section?.parentCode ?? null };
}
