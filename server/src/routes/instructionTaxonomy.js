import { Router } from 'express';

import { InstructionEditorError } from '../services/instructionEditorError.js';
import { instructionTaxonomyPublicService } from '../services/instructionTaxonomyPublicService.js';

function invalid() {
  return new InstructionEditorError('Некорректные параметры страницы каталога', {
    code: 'INVALID_TAXONOMY_PUBLIC_QUERY',
  });
}

function pageQuery(input) {
  if (Object.values(input).some(value => typeof value !== 'string')) throw invalid();
  const { path: pathname, ...query } = input;
  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.length > 2048 ||
    /[\\?#]/u.test(pathname) ||
    [...pathname].some(
      character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
    )
  )
    throw invalid();
  return { pathname, query };
}

export function instructionTaxonomyApiHeaders(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
}

export function createInstructionTaxonomyRouter({
  service = instructionTaxonomyPublicService,
  origin = process.env.SITE_URL || 'https://boykovdocs.ru',
} = {}) {
  const router = Router();
  router.use(instructionTaxonomyApiHeaders);

  router.get('/navigation', (req, res) => {
    if (Object.keys(req.query).length) throw invalid();
    res.json(service.snapshot().navigation(origin));
  });

  router.get('/page', (req, res) => {
    const { pathname, query } = pageQuery(req.query);
    const result = service.snapshot().resolve(pathname, query, origin);
    if (result.status === 200) return res.json(result.page);
    if (result.status === 301) return res.json({ redirect: result.location });
    if (result.status === 404) {
      return res
        .status(404)
        .json({ error: 'Страница не найдена', code: 'TAXONOMY_PAGE_NOT_FOUND' });
    }
    throw new Error('Unexpected taxonomy page resolution');
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof InstructionEditorError && error.status < 500) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[Instruction taxonomy pages]', error);
    return res.status(500).json({
      error: 'Не удалось загрузить структуру каталога',
      code: 'TAXONOMY_PUBLIC_ERROR',
    });
  });
  return router;
}

export const instructionTaxonomyRouter = createInstructionTaxonomyRouter();
