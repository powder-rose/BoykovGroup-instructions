import {
  instructionsRepository,
  DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
} from './instructionsRepository.js';
import { createInstructionTaxonomyBindingStore as createCore } from './instructionTaxonomyBindingStoreCore.js';

export function createInstructionTaxonomyBindingStore({
  repository = instructionsRepository,
  draftsDirectory = DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
} = {}) {
  return createCore({ repository, draftsDirectory });
}

export const instructionTaxonomyBindingStore = createInstructionTaxonomyBindingStore();
