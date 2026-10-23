import { prepareInstructionTaxonomy } from './instructionTaxonomyService.js';
import { validateInstructionTaxonomyAssignment } from './instructionTaxonomyAssignmentCatalog.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';

/**
 * Classify new and already-classified published instructions at write time.
 * Legacy records without taxonomy remain untouched until the reviewed migration.
 */
export function saveInstructionWithTaxonomy(
  repository,
  instruction,
  { taxonomyRepository = instructionTaxonomyRegistryRepository } = {},
) {
  return taxonomyRepository.withLock(
    (registry, assertHeld) => {
      const existing = repository.getByIdFresh
        ? repository.getByIdFresh(instruction?.id)
        : repository.getById(instruction?.id);
      for (const record of [existing, instruction].filter(Boolean)) {
        validateInstructionTaxonomyAssignment(
          { primaryCategoryId: record.primaryCategoryId ?? null, tagIds: record.tagIds ?? [] },
          { registry },
        );
      }
      const sectionIds = new Set(registry.sections.map(item => item.code));
      const tagIds = new Set(registry.tags.map(item => item.code));
      const coded = record =>
        sectionIds.has(record?.primaryCategoryId) ||
        (Array.isArray(record?.tagIds) && record.tagIds.some(id => tagIds.has(id)));
      const next = { ...instruction };
      const categoryManual =
        existing?.taxonomyMeta?.categorySource === 'manual' ||
        sectionIds.has(existing?.primaryCategoryId);
      const tagsManual = existing?.taxonomyMeta?.tagsSource === 'manual' || coded(existing);

      if (categoryManual || tagsManual) {
        next.taxonomyMeta = { ...instruction?.taxonomyMeta };
        if (categoryManual) {
          next.primaryCategoryId = existing.primaryCategoryId ?? null;
          next.taxonomyMeta.categorySource = 'manual';
        }
        if (tagsManual) {
          next.tagIds = structuredClone(existing.tagIds ?? []);
          next.taxonomyMeta.tagsSource = 'manual';
        }
      }

      validateInstructionTaxonomyAssignment(
        { primaryCategoryId: next.primaryCategoryId ?? null, tagIds: next.tagIds ?? [] },
        { registry },
      );
      const legacyUnclassified =
        existing &&
        !existing.taxonomyMeta &&
        !next.taxonomyMeta &&
        !coded(existing) &&
        !coded(next);
      const prepared = legacyUnclassified ? next : prepareInstructionTaxonomy(next, { registry });
      assertHeld();
      return repository.save(prepared, { assertHeld });
    },
    { waitMs: 5000 },
  );
}
