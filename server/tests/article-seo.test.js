import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

import { createArticleSeoRouter } from '../src/routes/articleSeo.js';

test('article HTML exposes full published content and metadata, hides drafts and returns real 404', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-article-seo-'));
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Old title</title><meta name="description" content="old"><meta name="robots" content="old"><link rel="canonical" href="old"><script type="application/ld+json">{"old":true}</script></head><body><div id="root"></div></body></html>',
  );
  const article = {
    id: 'article-1',
    slug: 'bezopasnaya-rabota',
    title: 'Работа <безопасно>',
    excerpt: 'Краткое описание',
    seoTitle: 'Ручной SEO title',
    seoDescription: 'Ручное SEO описание',
    status: 'published',
    publishedAt: '2026-10-14T12:00:00.000Z',
    updatedAt: '2026-10-14T13:00:00.000Z',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Перед инструкцией' }] },
        {
          type: 'instruction',
          attrs: {
            id: 'instruction-1',
            title: 'Полная инструкция',
            text: '1. Требования\n2. Действия\nПриложение <script>alert(1)</script>',
          },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'После инструкции' }] },
      ],
    },
  };
  const repository = {
    list: ({ publishedOnly }) => {
      assert.equal(publishedOnly, true);
      return [article];
    },
    getPublishedBySlug: slug => (slug === article.slug ? article : null),
  };
  const app = express();
  app.use(createArticleSeoRouter({ repository, indexPath }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/stati/${article.slug}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.indexOf('Перед инструкцией') < html.indexOf('Полная инструкция'));
  assert.ok(html.indexOf('Полная инструкция') < html.indexOf('После инструкции'));
  assert.ok(html.includes('Приложение &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal((html.match(/<title>/gu) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/gu) || []).length, 1);
  assert.equal((html.match(/application\/ld\+json/gu) || []).length, 1);
  assert.ok(html.includes('<title>Ручной SEO title</title>'));
  assert.ok(html.includes('"@type":"Article"'));
  assert.ok(html.includes('Работа &lt;безопасно&gt;'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const listing = await (await fetch(`${base}/stati`)).text();
  assert.ok(listing.includes(`/stati/${article.slug}`));
  const missing = await fetch(`${base}/stati/draft`);
  assert.equal(missing.status, 404);
  assert.ok((await missing.text()).includes('noindex, follow'));
  const redirected = await fetch(`${base}/stati/${article.slug}/?x=1`, { redirect: 'manual' });
  assert.equal(redirected.status, 301);
  assert.equal(redirected.headers.get('location'), `/stati/${article.slug}?x=1`);
});
