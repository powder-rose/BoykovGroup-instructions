import fs from 'node:fs';
import { Router } from 'express';

import { articlesRepository } from '../services/articlesRepository.js';
import { renderArticleContentToHtml } from '../services/articleContent.js';

function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>"']/gu,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026');
}

function siteUrl(req) {
  return String(process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(
    /\/+$/u,
    '',
  );
}

function pageHtml(indexPath, { title, description, canonical, body, schema, notFound = false }) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!/<div\b[^>]*\bid=["']root["'][^>]*>/iu.test(html) || !/<\/head>/iu.test(html)) {
    throw new Error('Article page requires the production client index.html');
  }
  html = html
    .replace(/<title>[\s\S]*?<\/title>/giu, '')
    .replace(/<meta\b[^>]*name=["'](?:description|robots|twitter:[^"']+)["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:[^"']+["'][^>]*>/giu, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/giu, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu, '');

  const head = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${notFound ? 'noindex, follow' : 'index, follow'}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="${schema?.['@type'] === 'Article' ? 'article' : 'website'}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    ${schema ? `<script type="application/ld+json" data-article-seo>${jsonForHtml(schema)}</script>` : ''}
  `;
  html = html.replace(/<\/head>/iu, `${head}</head>`);
  return html.replace(
    /<div\b[^>]*\bid=["']root["'][^>]*>[\s\S]*?<\/div>/iu,
    `<div id="root">${body}</div>`,
  );
}

export function createArticleSeoRouter({
  repository = articlesRepository,
  indexPath = new URL('../../../public_html/index.html', import.meta.url),
} = {}) {
  const router = Router();

  function normalizeUrl(req, res) {
    if (!req.path.endsWith('/')) return false;
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex < 0 ? '' : req.originalUrl.slice(queryIndex);
    res.redirect(301, req.path.replace(/\/+$/u, '') + query);
    return true;
  }

  router.get('/stati', (req, res, next) => {
    if (normalizeUrl(req, res)) return;
    try {
      const items = repository.list({ publishedOnly: true });
      const canonical = `${siteUrl(req)}/stati`;
      const title = 'Статьи и инструкции по охране труда | БОЙКОВГРУПП';
      const description = 'Статьи по охране труда с полными текстами инструкций и скачиванием PDF.';
      const body = `<main><nav aria-label="Хлебные крошки"><a href="/">Главная</a></nav>
        <h1>Статьи</h1><p>${description}</p>
        ${
          items.length
            ? `<ul>${items
                .map(
                  article => `<li><article>
          <h2><a href="/stati/${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></h2>
          <p>${escapeHtml(article.excerpt)}</p></article></li>`,
                )
                .join('')}</ul>`
            : '<p>Статьи скоро появятся.</p>'
        }
        </main>`;
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        url: canonical,
        name: title,
        description,
        inLanguage: 'ru-RU',
      };
      res
        .set('Cache-Control', 'no-store')
        .type('html')
        .send(pageHtml(indexPath, { title, description, canonical, body, schema }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/stati/:slug', (req, res, next) => {
    if (normalizeUrl(req, res)) return;
    try {
      const article = repository.getPublishedBySlug(req.params.slug);
      const canonical = `${siteUrl(req)}/stati/${encodeURIComponent(req.params.slug)}`;
      if (!article) {
        return res
          .status(404)
          .set('Cache-Control', 'no-store')
          .type('html')
          .send(
            pageHtml(indexPath, {
              title: 'Статья не найдена | БОЙКОВГРУПП',
              description: 'Статья не опубликована или её адрес изменился.',
              canonical,
              body: '<main><h1>Статья не найдена</h1><a href="/stati">Все статьи</a></main>',
              notFound: true,
            }),
          );
      }
      const body = `<main><nav aria-label="Хлебные крошки"><a href="/">Главная</a> / <a href="/stati">Статьи</a></nav>
        <article><h1>${escapeHtml(article.title)}</h1>
        <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(article.publishedAt.slice(0, 10))}</time>
        ${renderArticleContentToHtml(article.content)}</article></main>`;
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.seoDescription,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        mainEntityOfPage: canonical,
        url: canonical,
        inLanguage: 'ru-RU',
        publisher: { '@type': 'Organization', name: 'БОЙКОВГРУПП', url: siteUrl(req) },
      };
      res
        .set('Cache-Control', 'no-store')
        .type('html')
        .send(
          pageHtml(indexPath, {
            title: article.seoTitle,
            description: article.seoDescription,
            canonical,
            body,
            schema,
          }),
        );
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export default createArticleSeoRouter();
