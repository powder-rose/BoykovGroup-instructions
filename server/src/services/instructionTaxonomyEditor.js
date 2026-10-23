import { InstructionEditorError } from './instructionEditorError.js';
import { prepareInstructionTaxonomy } from './instructionTaxonomyService.js';
import { validateInstructionTaxonomyAssignment } from './instructionTaxonomyAssignmentCatalog.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';

function invalid(message) {
  return new InstructionEditorError(message, {
    status: 400,
    code: 'INVALID_INSTRUCTION_TAXONOMY',
  });
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertFields(value, allowed, label) {
  if (!plainObject(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw invalid(`Некорректные параметры: ${label}`);
  }
}

/**
 * Only explicit user actions can lock category or tags to a manual value.
 * Missing fields mean "retain current auto/manual behaviour", never "manual".
 */
export function applyInstructionTaxonomyEditorPatch(
  instruction,
  patch,
  { registry = instructionTaxonomyRegistryRepository.read() } = {},
) {
  if (patch === undefined) return prepareInstructionTaxonomy(instruction, { registry });

  assertFields(patch, ['category', 'tags', 'registryRevision'], 'классификация');

  const sectionIds = new Set(registry.sections.map(item => item.code));
  const tagIds = new Set(registry.tags.map(item => item.code));
  const hadCodedSection = sectionIds.has(instruction.primaryCategoryId);
  const hadCodedTags = instruction.tagIds?.some(id => tagIds.has(id)) || false;
  let explicitCodedChoice = false;

  const next = {
    ...instruction,
    taxonomyMeta: { ...instruction.taxonomyMeta },
  };

  if (Object.hasOwn(patch, 'category')) {
    const selection = patch.category;
    assertFields(selection, ['mode', 'id'], 'категория');

    if (selection.mode === 'manual') {
      if (!Object.hasOwn(selection, 'id')) {
        throw invalid('Выберите категорию или явно укажите отсутствие категории');
      }
      if (selection.id !== null && typeof selection.id !== 'string') {
        throw invalid('Некорректный идентификатор категории');
      }
      if (hadCodedSection && !sectionIds.has(selection.id)) {
        throw invalid('Для инструкции с тематическим разделом выберите другой тематический раздел');
      }
      next.primaryCategoryId = selection.id;
      next.taxonomyMeta.categorySource = 'manual';
      if (sectionIds.has(selection.id)) {
        explicitCodedChoice = true;
        if (!Object.hasOwn(patch, 'tags')) {
          next.tagIds = [...(instruction.tagIds ?? [])];
          next.taxonomyMeta.tagsSource = 'manual';
        }
      }
    } else if (selection.mode === 'auto' && !Object.hasOwn(selection, 'id')) {
      if (hadCodedSection) {
        throw invalid('Автоматический подбор не заменяет выбранный тематический раздел');
      }
      next.taxonomyMeta.categorySource = 'auto';
    } else {
      throw invalid('Некорректный режим выбора категории');
    }
  }

  if (Object.hasOwn(patch, 'tags')) {
    const selection = patch.tags;
    assertFields(selection, ['mode', 'ids'], 'теги');

    if (selection.mode === 'manual') {
      if (!Array.isArray(selection.ids)) {
        throw invalid('Передайте список выбранных тегов');
      }
      next.tagIds = [...selection.ids];
      next.taxonomyMeta.tagsSource = 'manual';
      explicitCodedChoice ||= selection.ids.some(id => tagIds.has(id));
    } else if (selection.mode === 'auto' && !Object.hasOwn(selection, 'ids')) {
      if (hadCodedSection || hadCodedTags || sectionIds.has(next.primaryCategoryId)) {
        throw invalid(
          'Для тематической классификации выберите теги вручную или очистите их список',
        );
      }
      next.taxonomyMeta.tagsSource = 'auto';
    } else {
      throw invalid('Некорректный режим выбора тегов');
    }
  }

  try {
    validateInstructionTaxonomyAssignment(
      { primaryCategoryId: next.primaryCategoryId ?? null, tagIds: next.tagIds ?? [] },
      { registry },
    );
    if (explicitCodedChoice || Object.hasOwn(patch, 'registryRevision')) {
      if (!Number.isSafeInteger(patch.registryRevision) || patch.registryRevision < 0) {
        throw new InstructionEditorError(
          'Передайте версию справочника выбранных разделов и тегов',
          {
            code: 'INVALID_TAXONOMY_REVISION',
          },
        );
      }
      if (patch.registryRevision !== registry.revision) {
        throw new InstructionEditorError(
          'Справочник уже изменён. Проверьте выбранные раздел и теги.',
          {
            status: 409,
            code: 'TAXONOMY_REVISION_CONFLICT',
          },
        );
      }
    }
    return prepareInstructionTaxonomy(next, { registry });
  } catch (error) {
    if (error instanceof InstructionEditorError) throw error;
    throw invalid(error.message);
  }
}
