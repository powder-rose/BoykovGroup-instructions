import { Router } from 'express';

import { instructionsRepository } from '../services/instructionsRepository.js';
import { getRelatedInstructions } from '../services/instructionEditorService.js';
import { toPublicInstruction } from '../services/instructionPublicView.js';

export function createInstructionPagesRouter({ repository = instructionsRepository } = {}) {
  const router = Router();

  router.get('/page/:slug', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const instruction = repository.getBySlug(req.params.slug);

    if (!instruction) return res.status(404).json({ error: 'Инструкция не найдена' });

    return res.json({
      ...toPublicInstruction(instruction),
      slug: instruction.slug || instruction.id,
      relatedInstructions: getRelatedInstructions(instruction, { repository }),
    });
  });

  router.get('/:id/related', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const instruction = repository.getById(req.params.id);

    if (!instruction) return res.status(404).json({ error: 'Инструкция не найдена' });

    return res.json({ items: getRelatedInstructions(instruction, { repository }) });
  });

  return router;
}

export const instructionPagesRouter = createInstructionPagesRouter();
