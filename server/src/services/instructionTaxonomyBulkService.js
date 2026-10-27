import { createInstructionTaxonomyBindingStore } from './instructionTaxonomyBindingStore.js';
import { createInstructionTaxonomyBulkService as createCore } from './instructionTaxonomyBulkCore.js';

export function createInstructionTaxonomyBulkService({
  store = createInstructionTaxonomyBindingStore(),
  ...options
} = {}) {
  return createCore({ ...options, store });
}

export const instructionTaxonomyBulkService = createInstructionTaxonomyBulkService();
