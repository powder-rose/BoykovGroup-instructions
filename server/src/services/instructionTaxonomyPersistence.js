import { prepareInstructionTaxonomy } from './instructionTaxonomyService.js';

/**
 * Classify new and already-classified published instructions at write time.
 * Legacy records without taxonomy remain untouched until the reviewed migration.
 */
export function saveInstructionWithTaxonomy(repository, instruction) {
  const existing = repository.getById(instruction?.id);

  if (existing && !existing.taxonomyMeta && !instruction?.taxonomyMeta) {
    return repository.save(instruction);
  }

  return repository.save(prepareInstructionTaxonomy(instruction));
}
