import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';
import { InstructionEditorError } from '../services/instructionEditorError.js';
import { instructionEditorService } from '../services/instructionEditorService.js';
import { createInstructionTaxonomyRegistryService } from '../services/instructionTaxonomyRegistryService.js';

const KINDS = new Set(['root', 'catalog', 'section', 'tag']);

function registryState(state) {
  const { legacyCatalog: _legacyCatalog, ...registry } = state;
  return registry;
}

function mutationBody(body, field) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some(key => key !== 'expectedRevision' && key !== field)
  ) {
    throw new InstructionEditorError('Некорректный запрос изменения справочника', {
      code: 'INVALID_TAXONOMY_REQUEST',
    });
  }
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw new InstructionEditorError('Передайте номер сохранённой версии справочника', {
      code: 'INVALID_TAXONOMY_REVISION',
    });
  }
  return { expectedRevision: body.expectedRevision };
}

export function createAdminInstructionTaxonomyRouter({
  service = createInstructionTaxonomyRegistryService({
    getInstructions: () => instructionEditorService.getTaxonomyReferences(),
  }),
} = {}) {
  const router = Router();

  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  }, requireAdmin);

  router.param('kind', (req, _res, next, kind) => {
    if (!KINDS.has(kind)) {
      return next(
        new InstructionEditorError('Элемент структуры не найден', {
          status: 404,
          code: 'TAXONOMY_ENTITY_NOT_FOUND',
        }),
      );
    }
    next();
  });

  router.get('/', (req, res) => res.json({ registry: registryState(service.read()) }));
  router.get('/:kind/:code/usage', (req, res) => {
    res.json({ usage: service.getUsage(req.params.kind, req.params.code) });
  });
  router.post('/:kind', (req, res) => {
    const options = mutationBody(req.body, 'entity');
    const registry = service.create(req.params.kind, req.body.entity, options);
    res.status(201).json({ registry: registryState(registry) });
  });
  router.put('/:kind/:code', (req, res) => {
    const options = mutationBody(req.body, 'patch');
    const registry = service.update(req.params.kind, req.params.code, req.body.patch, options);
    res.json({ registry: registryState(registry) });
  });
  router.delete('/:kind/:code', (req, res) => {
    const options = mutationBody(req.body);
    const registry = service.remove(req.params.kind, req.params.code, options);
    res.json({ registry: registryState(registry) });
  });

  router.use((error, req, res, next) => {
    if (!(error instanceof InstructionEditorError)) return next(error);
    if (error.status >= 500) console.error('[Instruction taxonomy]', error);
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
  });

  return router;
}

export const adminInstructionTaxonomyRouter = createAdminInstructionTaxonomyRouter();
