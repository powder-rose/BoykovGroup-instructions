import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';
import { InstructionEditorError } from '../services/instructionEditorError.js';
import { instructionEditorService } from '../services/instructionEditorService.js';
import { instructionTaxonomyPublicService } from '../services/instructionTaxonomyPublicService.js';
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

function previewQuery(query) {
  if (
    Object.entries(query).some(
      ([key, value]) => !['q', 'sort', 'page'].includes(key) || typeof value !== 'string',
    )
  ) {
    throw new InstructionEditorError('Некорректные параметры страницы каталога', {
      code: 'INVALID_TAXONOMY_PUBLIC_QUERY',
    });
  }
  return query;
}

export function createAdminInstructionTaxonomyRouter({
  service = createInstructionTaxonomyRegistryService({
    getInstructions: () => instructionEditorService.getTaxonomyReferences(),
  }),
  previewService = instructionTaxonomyPublicService,
  origin = process.env.SITE_URL || 'https://boykovdocs.ru',
} = {}) {
  const router = Router();

  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
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
  router.get('/:kind/:code/preview', (req, res) => {
    try {
      const query = previewQuery(req.query);
      const result = previewService
        .snapshot()
        .preview(req.params.kind, req.params.code, query, origin);
      if (result.status === 200) return res.json({ page: result.page });
      if (result.status === 404) {
        return res.status(404).json({
          error: 'Элемент структуры не найден',
          code: 'TAXONOMY_ENTITY_NOT_FOUND',
        });
      }
      throw new Error('Unexpected taxonomy preview resolution');
    } catch (error) {
      if (error instanceof InstructionEditorError && error.status < 500) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      console.error('[Instruction taxonomy preview]', error);
      return res.status(500).json({
        error: 'Не удалось загрузить предпросмотр страницы',
        code: 'TAXONOMY_PREVIEW_ERROR',
      });
    }
  });
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
