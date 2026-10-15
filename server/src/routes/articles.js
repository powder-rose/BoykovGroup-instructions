import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';
import { createRequirePdfAccess } from '../middleware/pdfAccess.js';
import { ArticleError } from '../services/articleErrors.js';
import { recordInstructionDownload } from '../services/downloadStatsService.js';
import { createArticleInstructionPdf, findInstructionBlock } from '../services/articleContent.js';
import { articlesRepository, toArticleSummary } from '../services/articlesRepository.js';

function sendArticleError(error, req, res, next) {
  if (!(error instanceof ArticleError)) {
    return next(error);
  }

  if (error.status >= 500) {
    console.error('[Articles]', error);
  }

  return res.status(error.status).json({ error: error.message, code: error.code });
}

function setNoStore(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  next();
}

export function createArticleRouters({
  repository = articlesRepository,
  pdfGenerator = createArticleInstructionPdf,
  userLookup,
  downloadRecorder = recordInstructionDownload,
} = {}) {
  const adminArticlesRouter = Router();
  const articlesRouter = Router();

  adminArticlesRouter.use(setNoStore, requireAdmin);

  adminArticlesRouter.get('/', (req, res) => {
    res.json({ items: repository.list().map(toArticleSummary) });
  });

  adminArticlesRouter.get('/:id', (req, res) => {
    const article = repository.getById(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    return res.json({ article });
  });

  adminArticlesRouter.post('/', (req, res) => {
    const article = repository.create(req.body);

    res.status(201).json({ article });
  });

  adminArticlesRouter.put('/:id', (req, res) => {
    const article = repository.update(req.params.id, req.body, { revision: req.body?.revision });

    res.json({ article });
  });

  adminArticlesRouter.delete('/:id', (req, res) => {
    repository.remove(req.params.id, { revision: req.body?.revision });
    res.status(204).end();
  });

  adminArticlesRouter.use(sendArticleError);

  articlesRouter.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ items: repository.list({ publishedOnly: true }).map(toArticleSummary) });
  });

  articlesRouter.get(
    '/:slug/instructions/:blockId/pdf',
    setNoStore,
    createRequirePdfAccess({ userLookup }),
    async (req, res, next) => {
      try {
        const article = repository.getPublishedBySlug(req.params.slug);
        const block = article ? findInstructionBlock(article.content, req.params.blockId) : null;

        if (!block) {
          return res.status(404).json({ error: 'Инструкция не найдена' });
        }

        const pdf = await pdfGenerator(block);

        if (
          !Buffer.isBuffer(pdf) ||
          pdf.length < 1000 ||
          pdf.subarray(0, 4).toString() !== '%PDF'
        ) {
          throw new Error('Article PDF generator returned an invalid PDF');
        }

        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', 'attachment; filename="instruction.pdf"');
        res.set('X-Content-Type-Options', 'nosniff');

        if (req.user.role === 'user') {
          res.once('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                downloadRecorder({
                  instructionId: `article:${article.id}:${block.attrs.id}`,
                  title: block.attrs.title,
                  userId: req.user.sub,
                });
              } catch (error) {
                console.error('[Articles] Failed to record PDF download:', error);
              }
            }
          });
        }

        return res.send(pdf);
      } catch (error) {
        return next(error);
      }
    },
  );

  articlesRouter.get('/:slug', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const article = repository.getPublishedBySlug(req.params.slug);

    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    return res.json({ article });
  });

  articlesRouter.use(sendArticleError);

  return { adminArticlesRouter, articlesRouter };
}

export const { adminArticlesRouter, articlesRouter } = createArticleRouters();
