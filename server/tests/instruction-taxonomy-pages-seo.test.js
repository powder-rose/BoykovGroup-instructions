import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createSeoRouter } from '../src/routes/seo.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyEntityPath } from '../src/services/instructionTaxonomyRegistryModel.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';

const rootPath = '/instrukcii-po-ohrane-truda';
const paragraph = text => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

async function fixture(t, { taxonomyOrigin } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-seo-'));
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>OLD_TITLE</title><meta name="description" content="OLD_DESCRIPTION"><meta name="robots" content="OLD_ROBOTS"><meta property="og:title" content="OLD_OG"><link rel="canonical" href="https://old.invalid/"><script type="application/ld+json">{"old":true}</script></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
  );
  const registry = getInstructionTaxonomyRegistrySeed();
  const records = [
    {
      id: 'stable-id',
      slug: 'Current-Case_123',
      title: 'Инструкция для проверки',
      revision: 1,
      status: 'published',
      primaryCategoryId: 'W01',
      tagIds: ['T47'],
      createdAt: '2026-09-14T12:00:00.000Z',
    },
  ];
  const calls = { registry: 0, fresh: 0 };
  const repository = {
    getAllFresh() {
      calls.fresh += 1;
      return records;
    },
    getAll: () => records,
    getBySlug: slug => records.find(record => [record.id, record.slug].includes(slug)),
  };
  const taxonomyService = createInstructionTaxonomyPublicService({
    repository,
    taxonomyRepository: {
      read() {
        calls.registry += 1;
        return registry;
      },
    },
  });
  const app = express();
  app.use(
    createSeoRouter({
      repository,
      taxonomyService,
      taxonomyOrigin,
      indexPath,
      relatedInstructions: () => [],
    }),
  );
  app.use((error, _req, res, _next) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function publish() {
    const catalog = registry.catalogs.find(item => item.code === 'H02');
    catalog.status = 'published';
    catalog.indexingEnabled = true;
    const section = registry.sections.find(item => item.code === 'W01');
    section.status = 'published';
    section.indexingEnabled = true;
    return section;
  }
  return {
    registry,
    records,
    calls,
    origin,
    publish,
    sectionPath: () => getInstructionTaxonomyEntityPath(registry, 'section', 'W01'),
    request: route => fetch(origin + route, { redirect: 'manual' }),
  };
}

test('taxonomy HTML escapes independent metadata and rich text while keeping one controlled schema', async t => {
  const f = await fixture(t, { taxonomyOrigin: 'https://canonical.example' });
  const section = f.publish();
  section.h1 = 'Заголовок </script><script>H1_ATTACK</script> $&';
  section.seoTitle = 'Отдельный title <tag> $&';
  section.seoDescription = 'Описание "кавычки" & значение';
  section.introContent = paragraph('Вводный текст <script>BODY_ATTACK</script>');
  section.seoContent = paragraph('Текст после списка $&');
  section.source.privateNote = 'PRIVATE_SOURCE_NOTE';
  const before = JSON.stringify({ registry: f.registry, records: f.records });
  const response = await f.request(f.sectionPath());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.ok(html.includes('<title>Отдельный title &lt;tag&gt; $&amp;</title>'));
  assert.ok(html.includes('content="Описание &quot;кавычки&quot; &amp; значение"'));
  assert.ok(html.includes('Вводный текст &lt;script&gt;BODY_ATTACK&lt;/script&gt;'));
  assert.ok(html.includes('Текст после списка $&amp;'));
  assert.equal(html.includes('<script>H1_ATTACK</script>'), false);
  assert.equal(html.includes('<script>BODY_ATTACK</script>'), false);
  assert.equal(html.includes('PRIVATE_SOURCE_NOTE'), false);
  assert.equal(html.includes('OLD_'), false);
  assert.equal((html.match(/<h1\b/gu) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/gu) || []).length, 1);
  const scripts = [...html.matchAll(/<script\b[^>]*data-taxonomy-seo[^>]*>([\s\S]*?)<\/script>/gu)];
  assert.equal(scripts.length, 1);
  assert.equal((html.match(/application\/ld\+json/gu) || []).length, 1);
  assert.ok(html.includes(`data-taxonomy-path="${f.sectionPath()}"`));
  const schema = JSON.parse(scripts[0][1]);
  assert.equal(schema['@graph'][1].name, section.h1);
  assert.equal(schema['@graph'][1].url, `https://canonical.example${f.sectionPath()}`);
  const breadcrumbs = schema['@graph'].find(item => item['@type'] === 'BreadcrumbList');
  assert.equal(
    breadcrumbs.itemListElement.at(-1).item,
    `https://canonical.example${f.sectionPath()}`,
  );
  assert.deepEqual(f.calls, { registry: 1, fresh: 1 });
  assert.equal(JSON.stringify({ registry: f.registry, records: f.records }), before);
});

test('root case/slash aliases and deep default-query aliases redirect once without changing instruction URLs', async t => {
  const f = await fixture(t);
  f.publish();
  const root = await f.request('/INSTRUKCII-PO-OHRANE-TRUDA/?q=%D0%A2%D0%B5%D1%81%D1%82');
  assert.equal(root.status, 301);
  const location = new URL(root.headers.get('location'), f.origin);
  assert.equal(location.pathname, rootPath);
  assert.equal(location.searchParams.get('q'), 'Тест');
  assert.equal(root.headers.get('cache-control'), 'no-store');
  assert.deepEqual(f.calls, { registry: 0, fresh: 0 });
  const defaults = await f.request(`${f.sectionPath().toUpperCase()}?page=1&sort=title&q=%20`);
  assert.equal(defaults.status, 301);
  assert.equal(defaults.headers.get('location'), f.sectionPath());
  const missing = await f.request(`${rootPath}/unpublished-page/?preview=1`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('x-robots-tag'), 'noindex, nofollow');
  const malformed = await f.request(`${f.sectionPath()}?page=not-a-number`);
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get('x-robots-tag'), 'noindex, nofollow');
  const instruction = await f.request('/instrukciya-po-ohrane-truda/stable-id');
  assert.equal(instruction.status, 301);
  assert.equal(
    new URL(instruction.headers.get('location')).pathname,
    '/instrukciya-po-ohrane-truda/Current-Case_123',
  );
});

test('new taxonomy canonicals use the configured origin while the unpublished root retains legacy metadata', async t => {
  const f = await fixture(t, { taxonomyOrigin: 'https://configured.example' });
  f.publish();
  let response = await f.request(rootPath);
  let html = await response.text();
  const legacyOrigin = String(process.env.SITE_URL || f.origin).replace(/\/+$/u, '');
  assert.ok(html.includes(`href="${legacyOrigin}${rootPath}"`));
  assert.ok(html.includes('<title>Инструкции по охране труда | БОЙКОВГРУПП</title>'));
  assert.ok(html.includes(`data-taxonomy-path="${rootPath}"`));
  f.registry.root.status = 'published';
  f.registry.root.indexingEnabled = true;
  f.registry.root.h1 = 'Независимый root H1';
  f.registry.root.seoTitle = 'Независимый root title';
  f.registry.root.seoDescription = '';
  response = await f.request(rootPath);
  html = await response.text();
  assert.ok(html.includes('href="https://configured.example/instrukcii-po-ohrane-truda"'));
  assert.ok(html.includes('<title>Независимый root title</title>'));
  assert.ok(html.includes(`data-taxonomy-path="${rootPath}"`));
  assert.ok(html.includes('name="description"\n    content=""'));
  assert.equal(html.includes('База пополняется автоматически каждый день.'), false);
  const before = { ...f.calls };
  const sitemap = await f.request('/sitemap.xml');
  const xml = await sitemap.text();
  assert.ok(xml.includes(`<loc>https://configured.example${f.sectionPath()}</loc>`));
  assert.ok(xml.includes('<loc>https://configured.example/instrukcii-po-ohrane-truda</loc>'));
  assert.deepEqual(f.calls, { registry: before.registry + 1, fresh: before.fresh + 1 });
});
