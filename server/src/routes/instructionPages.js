import { Router } from 'express';

import { instructionsRepository } from '../services/instructionsRepository.js';
import { getRelatedInstructions } from '../services/instructionEditorService.js';
import { toPublicInstruction } from '../services/instructionPublicView.js';
import { getInstructionTaxonomyDisplay } from '../services/instructionTaxonomyDisplayService.js';
import { createInstructionTaxonomyPublicService } from '../services/instructionTaxonomyPublicService.js';

export function createInstructionPagesRouter({
  repository = instructionsRepository,
  taxonomyService = createInstructionTaxonomyPublicService({ repository }),
} = {}) {
  const router = Router();

  router.get('/page/:slug', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const snapshot = taxonomyService.snapshot();
    const instruction = repository.getBySlug(req.params.slug);

    if (!isPublicInstruction(instruction)) {
      return res.status(404).json({ error: 'Инструкция не найдена' });
    }

    const taxonomyDisplay = getInstructionTaxonomyDisplay(instruction, {
      catalog: snapshot.assignmentCatalog,
    });

    return res.json({
      ...toPublicInstruction(instruction),
      ...(taxonomyDisplay ? { taxonomyDisplay } : {}),
      taxonomyNavigation: snapshot.instructionNavigation(instruction),
      slug: instruction.slug || instruction.id,
      relatedInstructions: getRelatedInstructions(instruction, {
        repository,
        catalog: snapshot.assignmentCatalog,
        records: snapshot.references(),
      }),
    });
  });

  router.get('/:id/related', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const snapshot = taxonomyService.snapshot();
    const instruction = repository.getById(req.params.id);

    if (!isPublicInstruction(instruction)) {
      return res.status(404).json({ error: 'Инструкция не найдена' });
    }

    return res.json({
      items: getRelatedInstructions(instruction, {
        repository,
        catalog: snapshot.assignmentCatalog,
        records: snapshot.references(),
      }),
    });
  });

  return router;
}

function isPublicInstruction(instruction) {
  return (
    instruction &&
    String(instruction.status || '').toLowerCase() !== 'draft' &&
    String(instruction.seoStatus || '').toLowerCase() !== 'draft'
  );
}

export const instructionPagesRouter = createInstructionPagesRouter();
