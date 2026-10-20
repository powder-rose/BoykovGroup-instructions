import {
  getInstructionTaxonomyCatalog,
  suggestInstructionTaxonomy,
  validateInstructionTaxonomySelection,
} from './instructionTaxonomyService.js';

const catalog = getInstructionTaxonomyCatalog();
const professionIds = new Set(
  catalog.tags.filter(tag => tag.type === 'profession').map(tag => tag.id),
);

export function planInstructionProfessionTags(instruction) {
  const unchanged = (status, error) => ({
    status,
    instruction,
    addedTagIds: [],
    ...(error && { error }),
  });

  if (
    !instruction ||
    typeof instruction !== 'object' ||
    Array.isArray(instruction) ||
    typeof instruction.id !== 'string' ||
    !instruction.id.trim()
  ) {
    return unchanged('invalid', 'Instruction must be an object with a nonempty string ID');
  }

  const metadata = instruction.taxonomyMeta ?? {};
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return unchanged('invalid', 'Taxonomy metadata must be an object');
  }

  const tagIds = instruction.tagIds ?? [];
  try {
    validateInstructionTaxonomySelection({ tagIds });
  } catch (error) {
    return unchanged('invalid', error.message);
  }

  if (metadata.tagsSource === 'manual') return unchanged('manual');
  if (
    (tagIds.length && metadata.tagsSource !== 'auto') ||
    ![undefined, null, 'auto', 'unassigned'].includes(metadata.tagsSource)
  ) {
    return unchanged('unknown-source');
  }

  const addedTagIds = suggestInstructionTaxonomy(instruction).tagIds.filter(
    id => professionIds.has(id) && !tagIds.includes(id),
  );
  if (!addedTagIds.length) return unchanged('unchanged');

  const nextTagIds = [...tagIds, ...addedTagIds];
  try {
    validateInstructionTaxonomySelection({ tagIds: nextTagIds });
  } catch {
    return unchanged('limit');
  }

  return {
    status: 'change',
    addedTagIds,
    instruction: {
      ...instruction,
      tagIds: nextTagIds,
      taxonomyMeta: {
        ...metadata,
        tagsSource: 'auto',
        needsReview: !instruction.primaryCategoryId,
        schemaVersion: catalog.version,
      },
    },
  };
}
