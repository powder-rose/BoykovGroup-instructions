import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';
import { InstructionEditorError } from '../services/instructionEditorError.js';
import { instructionTaxonomyBulkService } from '../services/instructionTaxonomyBulkService.js';
import { instructionTaxonomyCsvExport } from '../services/instructionTaxonomyCsvExport.js';

function invalid() {
  return new InstructionEditorError('Некорректные параметры операции с привязками', {
    code: 'INVALID_TAXONOMY_BULK_REQUEST',
  });
}

function body(value, fields, { empty = false } = {}) {
  const input = value === undefined && empty ? {} : value;
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(key => !fields.includes(key)) ||
    fields.some(key => !Object.hasOwn(input, key))
  )
    throw invalid();
  return input;
}

function filters(query, fields) {
  if (Object.keys(query).some(key => !fields.includes(key))) throw invalid();
  const result = {};
  for (const key of fields) {
    if (query[key] === undefined) continue;
    if (typeof query[key] !== 'string') throw invalid();
    if (key === 'page' || key === 'pageSize') {
      if (!/^[1-9]\d*$/u.test(query[key]) || !Number.isSafeInteger(Number(query[key]))) {
        throw invalid();
      }
      result[key] = Number(query[key]);
    } else result[key] = query[key];
  }
  return result;
}

function actor(req) {
  return req.user.sub || req.user.login || 'admin';
}

export function createAdminInstructionTaxonomyOperationsRouter({
  service = instructionTaxonomyBulkService,
  exportProvider = instructionTaxonomyCsvExport,
} = {}) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  }, requireAdmin);

  router.get('/bindings', (req, res) =>
    res.json(service.list(filters(req.query, ['query', 'section', 'tag', 'page', 'pageSize']))),
  );
  router.get('/history', (req, res) =>
    res.json(service.history(filters(req.query, ['page', 'pageSize']))),
  );
  router.get('/status', (req, res) => {
    filters(req.query, []);
    res.json(service.status());
  });
  router.post('/preview', (req, res) => {
    const input = body(req.body, ['ids', 'registryRevision', 'includeDrafts', 'action']);
    res.json(service.preview(input, actor(req)));
  });
  router.post('/apply', (req, res) => {
    res.json(service.apply(body(req.body, ['previewId', 'confirmed']), actor(req)));
  });
  router.post('/history/:id/rollback-preview', (req, res) => {
    body(req.body, [], { empty: true });
    res.json(service.previewRollback(req.params.id, actor(req)));
  });
  router.post('/recover', (req, res) => {
    res.json(service.recover(body(req.body, ['operationId', 'confirmed']), actor(req)));
  });
  router.get('/export', (req, res) => {
    const csv = exportProvider(filters(req.query, ['query', 'section', 'tag']));
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="instruction-taxonomy-published.csv"')
      .set('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(csv, 'utf8'));
  });

  router.use((error, req, res, next) => {
    if (!(error instanceof InstructionEditorError)) return next(error);
    if (error.status >= 500) console.error('[Instruction taxonomy operations]', error);
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
  });
  return router;
}

export const adminInstructionTaxonomyOperationsRouter =
  createAdminInstructionTaxonomyOperationsRouter();
