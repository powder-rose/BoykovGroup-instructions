import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';
import { instructionEditorService } from '../services/instructionEditorService.js';
import { getInstructionTaxonomyCatalog } from '../services/instructionTaxonomyService.js';
import { InstructionEditorError } from '../services/instructionEditorError.js';
import { getInstructionTaxonomyAssignmentCatalog } from '../services/instructionTaxonomyAssignmentCatalog.js';

export function createAdminInstructionsRouter({
  service = instructionEditorService,
  getAssignmentCatalog = getInstructionTaxonomyAssignmentCatalog,
} = {}) {
  const router = Router();

  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  }, requireAdmin);

  router.get('/taxonomy', (req, res) => {
    const catalog = getInstructionTaxonomyCatalog();
    res.json({
      version: catalog.version,
      categories: catalog.categories.map(({ id, label }) => ({ id, label })),
      tags: catalog.tags.map(({ id, label, type }) => ({ id, label, type })),
    });
  });
  router.get('/assignment-taxonomy', (req, res) => res.json(getAssignmentCatalog()));
  router.get('/', (req, res) => res.json({ items: service.list() }));
  router.get('/:id', (req, res) => res.json(service.get(req.params.id)));
  router.post('/', (req, res) => res.status(201).json(service.save(null, req.body)));
  router.put('/:id', (req, res) => res.json(service.save(req.params.id, req.body)));
  router.delete('/:id/draft', (req, res) => {
    service.discardDraft(req.params.id, { revision: req.body?.revision });
    res.status(204).end();
  });
  router.post('/:id/unpublish', (req, res) => {
    res.json(service.unpublish(req.params.id, { revision: req.body?.revision }));
  });
  router.delete('/:id', (req, res) => {
    service.remove(req.params.id, { revision: req.body?.revision });
    res.status(204).end();
  });

  router.use((error, req, res, next) => {
    if (!(error instanceof InstructionEditorError)) return next(error);
    if (error.status >= 500) console.error('[Instruction editor]', error);
    return res.status(error.status).json({ error: error.message, code: error.code });
  });

  return router;
}

export const adminInstructionsRouter = createAdminInstructionsRouter();
