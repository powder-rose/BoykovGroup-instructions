import { InstructionEditorError } from './instructionEditorError.js';
import {
  prepareInstructionTaxonomy,
  validateInstructionTaxonomySelection,
} from './instructionTaxonomyService.js';

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
export function applyInstructionTaxonomyEditorPatch(instruction, patch) {
  if (patch === undefined) return prepareInstructionTaxonomy(instruction);

  assertFields(patch, ['category', 'tags'], 'классификация');

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
      next.primaryCategoryId = selection.id;
      next.taxonomyMeta.categorySource = 'manual';
    } else if (selection.mode === 'auto' && !Object.hasOwn(selection, 'id')) {
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
    } else if (selection.mode === 'auto' && !Object.hasOwn(selection, 'ids')) {
      next.taxonomyMeta.tagsSource = 'auto';
    } else {
      throw invalid('Некорректный режим выбора тегов');
    }
  }

  try {
    validateInstructionTaxonomySelection({
      primaryCategoryId: next.primaryCategoryId ?? null,
      tagIds: next.tagIds ?? [],
    });
    return prepareInstructionTaxonomy(next);
  } catch (error) {
    if (error instanceof InstructionEditorError) throw error;
    throw invalid(error.message);
  }
}
