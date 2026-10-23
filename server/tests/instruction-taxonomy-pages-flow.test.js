import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createInstructionTaxonomyRouter } from '../src/routes/instructionTaxonomy.js';
import { createSeoRouter } from '../src/routes/seo.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyEntityPath } from '../src/services/instructionTaxonomyRegistryModel.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';
import { getInstructionPublicPath } from '../src/shared/instructionDocument.js';

const rootPath = '/instrukcii-po-ohrane-truda';
const paragraph = text => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function instruction(id, overrides = {}) {
  return {
    id,
    slug: `Instruction-${id}-AbC123`,
    slugAliases: [`Old-${id}-XyZ987`],
    title: `Инструкция ${id}`,
    h1: `Исходный H1 ${id}`,
    seoTitle: `Исходный SEO ${id}`,
    seoDescription: `Исходное описание ${id}`,
    instructionContent: paragraph(`Сохранённый текст ${id}`),
    explanationContent: paragraph('Сохранённое пояснение'),
    contentHash: `stored-hash-${id}`,
    version: '3.5',
    versions: [{ version: '3.4', contentHash: 'previous' }],
    files: [{ name: 'instruction.pdf', path: `/files/${id}.pdf` }],
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    publishedAt: '2026-09-01T12:00:00.000Z',
    revision: 3,
    status: 'published',
    primaryCategoryId: 'W01',
    tagIds: ['T47'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual' },
    editorialMeta: { seoAuthor: 'PRIVATE_EDITOR', seoReady: true },
    ...overrides,
  };
}

async function fixture(t, records = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-pages-flow-'));
  const publishedDirectory = path.join(directory, 'instructions');
  const repository = new InstructionsRepository(publishedDirectory);
  records.forEach(record => repository.save(record));
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(directory, 'taxonomy.json'),
  });
  const taxonomyService = createInstructionTaxonomyPublicService({
    repository,
    taxonomyRepository,
  });
  const metadataService = createInstructionTaxonomyRegistryService({
    repository: taxonomyRepository,
    getInstructions: () => repository.getAllFresh(),
  });
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>OLD_HEAD_TITLE</title><meta name="description" content="OLD_DESCRIPTION"><meta name="robots" content="OLD_ROBOTS"><link rel="canonical" href="https://old.invalid/"><meta property="og:title" content="OLD_OG"><script type="application/ld+json">{"old":true}</script></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
  );
  const app = express();
  const taxonomyOrigin = 'https://taxonomy.fixture.boykovdocs.ru';
  app.use('/api/instruction-taxonomy', (req, res, next) =>
    createInstructionTaxonomyRouter({ service: taxonomyService, origin: taxonomyOrigin })(
      req,
      res,
      next,
    ),
  );
  app.use(
    createSeoRouter({
      repository,
      taxonomyService,
      taxonomyOrigin,
      indexPath,
      relatedInstructions: () => [],
    }),
  );
  app.use((error, _req, res, _next) => {
    res
      .status(error.status || 500)
      .json({ code: error.code || 'INTERNAL_ERROR', error: error.message });
  });
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

  const request = (route, options = {}) =>
    fetch(origin + route, { redirect: 'manual', ...options });
  async function json(route) {
    const response = await request(route);
    return { response, data: await response.json() };
  }
  async function html(route) {
    const response = await request(route);
    return { response, text: await response.text() };
  }
  function entityPath(kind, code) {
    return getInstructionTaxonomyEntityPath(taxonomyRepository.read(), kind, code);
  }
  function update(kind, code, patch) {
    return metadataService.update(kind, code, patch, {
      expectedRevision: taxonomyRepository.read().revision,
    });
  }
  function publish() {
    update('catalog', 'H02', { status: 'published', indexingEnabled: true });
    update('section', 'W01', {
      status: 'published',
      indexingEnabled: true,
      h1: 'Публичный заголовок раздела',
      seoTitle: 'Отдельный SEO Title раздела',
      seoDescription: 'Отдельное SEO-описание раздела',
      introContent: paragraph('Введение перед списком раздела'),
      seoContent: paragraph('Дополнительный текст после списка раздела'),
    });
    update('tag', 'T47', { status: 'published', indexingEnabled: true });
  }
  const bytes = () =>
    Object.fromEntries(
      fs
        .readdirSync(publishedDirectory)
        .map(file => [
          file,
          fs.readFileSync(path.join(publishedDirectory, file)).toString('base64'),
        ]),
    );
  return {
    origin,
    taxonomyOrigin,
    repository,
    taxonomyRepository,
    metadataService,
    request,
    json,
    html,
    entityPath,
    update,
    publish,
    bytes,
  };
}

function redirectedPath(response, origin) {
  const target = new URL(response.headers.get('location'), origin);
  return target.pathname + target.search;
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(match => match[1]);
}

test('initial taxonomy drafts preserve the legacy root and never expose deep pages or draft navigation', async t => {
  const f = await fixture(t, [instruction('legacy')]);
  const original = f.bytes();
  const navigation = await f.json('/api/instruction-taxonomy/navigation');
  assert.equal(navigation.response.status, 200);
  assert.equal(navigation.data.root, null);
  assert.deepEqual(navigation.data.catalogs, []);
  assert.deepEqual(navigation.data.tags, []);
  const root = await f.html(rootPath);
  assert.equal(root.response.status, 200);
  assert.ok(root.text.includes(getInstructionPublicPath(instruction('legacy'))));
  for (const route of [
    f.entityPath('catalog', 'H01'),
    f.entityPath('catalog', 'H02'),
    f.entityPath('section', 'W01'),
    f.entityPath('tag', 'T47'),
    `${rootPath}/po-professiyam/`,
  ]) {
    assert.equal((await f.request(route)).status, 404, route);
    assert.equal(root.text.includes(`href="${route}"`), false, route);
  }
  const sitemap = await f.html('/sitemap.xml');
  const locations = sitemapLocations(sitemap.text);
  assert.ok(locations.includes(`${f.origin}${rootPath}`));
  assert.equal(
    locations.some(url => url.includes('/temy/') || url.includes('/po-vidam-rabot/')),
    false,
  );
  assert.deepEqual(f.bytes(), original);
  assert.equal(
    fs.existsSync(path.join(f.taxonomyRepository.operationsDirectory, 'active.json')),
    false,
  );
});

test('published pages share API and crawlable SSR lists, including noindex instructions but excluding drafts', async t => {
  const records = Array.from({ length: 27 }, (_, index) =>
    instruction(`item-${String(index).padStart(2, '0')}`, {
      title:
        index === 0
          ? 'Альфа: опубликованная noindex инструкция'
          : `Работы ${String(index).padStart(2, '0')}`,
      publishedAt: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      ...(index === 0 ? { seoStatus: 'noindex' } : {}),
    }),
  );
  records.push(instruction('draft-only', { title: 'PRIVATE_DRAFT_TITLE', status: 'draft' }));
  records.push(instruction('seo-draft', { title: 'PRIVATE_SEO_DRAFT_TITLE', seoStatus: 'draft' }));
  const f = await fixture(t, records);
  f.publish();
  const original = f.bytes();
  const sectionPath = f.entityPath('section', 'W01');
  const navigation = await f.json('/api/instruction-taxonomy/navigation');
  assert.equal(navigation.data.catalogs.find(item => item.code === 'H02').count, 27);
  assert.equal(
    navigation.data.catalogs
      .find(item => item.code === 'H02')
      .sections.find(item => item.code === 'W01').count,
    27,
  );
  assert.equal(navigation.data.tags.find(item => item.code === 'T47').count, 27);
  const api = await f.json(
    `/api/instruction-taxonomy/page?path=${encodeURIComponent(sectionPath)}`,
  );
  assert.equal(api.response.status, 200);
  assert.equal(api.data.total, 27);
  assert.equal(api.data.items.length, 24);
  assert.equal(api.data.totalPages, 2);
  assert.equal(api.data.seo.canonicalUrl, f.taxonomyOrigin + sectionPath);
  assert.ok(api.data.items.some(item => item.id === 'item-00'));
  assert.equal(JSON.stringify(api.data).includes('PRIVATE_EDITOR'), false);
  const page = await f.html(sectionPath);
  assert.equal(page.response.status, 200);
  assert.equal(page.response.headers.get('cache-control'), 'no-store');
  for (const item of api.data.items)
    assert.ok(page.text.includes(`href="${getInstructionPublicPath(item)}"`), item.id);
  for (const item of records.filter(
    item => !api.data.items.some(visible => visible.id === item.id),
  )) {
    assert.equal(page.text.includes(`href="${getInstructionPublicPath(item)}"`), false, item.id);
  }
  assert.ok(page.text.includes('Введение перед списком раздела'));
  assert.ok(page.text.includes('Дополнительный текст после списка раздела'));
  const visibleBody = page.text.slice(page.text.indexOf('<body'));
  assert.ok(
    visibleBody.indexOf('Введение перед списком раздела') <
      visibleBody.indexOf(getInstructionPublicPath(api.data.items[0])),
  );
  assert.ok(page.text.includes('<title>Отдельный SEO Title раздела</title>'));
  assert.ok(page.text.includes('Отдельное SEO-описание раздела'));
  assert.equal((page.text.match(/<h1\b/gu) || []).length, 1);
  assert.equal((page.text.match(/rel="canonical"/gu) || []).length, 1);
  assert.equal(page.text.includes('PRIVATE_DRAFT_TITLE'), false);
  assert.equal(page.text.includes('PRIVATE_SEO_DRAFT_TITLE'), false);
  assert.match(page.text, /"@type"\s*:\s*"BreadcrumbList"/u);
  assert.ok(page.text.includes(`href="${f.entityPath('catalog', 'H02')}"`));
  assert.ok(page.text.includes(`href="${api.data.nextPath.replaceAll('&', '&amp;')}"`));
  const secondApi = await f.json(
    `/api/instruction-taxonomy/page?path=${encodeURIComponent(sectionPath)}&page=2`,
  );
  const secondHtml = await f.html(`${sectionPath}?page=2`);
  assert.equal(secondApi.data.items.length, 3);
  for (const item of secondApi.data.items)
    assert.ok(secondHtml.text.includes(`href="${getInstructionPublicPath(item)}"`));
  assert.match(secondHtml.text, /name="robots"[^>]*content="noindex, follow"/u);
  assert.ok(secondHtml.text.includes(`href="${f.taxonomyOrigin}${sectionPath}"`));
  const otherHost = await f.request(sectionPath, { headers: { host: 'untrusted-host.invalid' } });
  assert.equal(otherHost.status, 200);
  const otherHostHtml = await otherHost.text();
  assert.ok(otherHostHtml.includes(`href="${f.taxonomyOrigin}${sectionPath}"`));
  assert.equal(otherHostHtml.includes('untrusted-host.invalid'), false);
  const query = await f.json(
    `/api/instruction-taxonomy/page?path=${encodeURIComponent(sectionPath)}&q=${encodeURIComponent('АЛЬФА')}`,
  );
  assert.equal(query.data.total, 1);
  assert.equal(query.data.items[0].id, 'item-00');
  const newest = await f.json(
    `/api/instruction-taxonomy/page?path=${encodeURIComponent(sectionPath)}&sort=newest`,
  );
  assert.equal(newest.data.items[0].id, 'item-26');
  for (const route of [
    sectionPath.toUpperCase(),
    sectionPath.slice(0, -1),
    `${sectionPath}?page=1`,
  ]) {
    const response = await f.request(route);
    assert.equal(response.status, 301, route);
    assert.equal(redirectedPath(response, f.origin), sectionPath);
  }
  const sitemap = await f.html('/sitemap.xml');
  const locations = sitemapLocations(sitemap.text);
  assert.ok(locations.includes(`${f.taxonomyOrigin}${sectionPath}`));
  assert.equal(locations.includes(`${f.origin}${getInstructionPublicPath(records[0])}`), false);
  assert.equal(
    locations.some(url => /[?]/u.test(url)),
    false,
  );
  assert.deepEqual(f.bytes(), original);
});

test('renamed published routes resolve directly to current pages and disappear when unpublished', async t => {
  const f = await fixture(t, [instruction('stable')]);
  f.publish();
  const before = f.bytes();
  const firstPath = f.entityPath('section', 'W01');
  f.update('section', 'W01', { slug: 'renamed-work-section' });
  const secondPath = f.entityPath('section', 'W01');
  f.update('section', 'W01', { slug: 'latest-work-section' });
  const currentPath = f.entityPath('section', 'W01');
  for (const oldPath of [firstPath, secondPath]) {
    const response = await f.request(oldPath);
    assert.equal(response.status, 301);
    assert.equal(redirectedPath(response, f.origin), currentPath);
    const api = await f.json(`/api/instruction-taxonomy/page?path=${encodeURIComponent(oldPath)}`);
    assert.equal(api.response.status, 200);
    assert.equal(api.data.redirect, currentPath);
  }
  const root = await f.html(rootPath);
  assert.ok(root.text.includes(`href="${currentPath}"`));
  assert.equal(root.text.includes(`href="${firstPath}"`), false);
  assert.equal(root.text.includes(`href="${secondPath}"`), false);
  f.update('catalog', 'H02', { status: 'draft' });
  for (const route of [firstPath, secondPath, currentPath])
    assert.equal((await f.request(route)).status, 404);
  const navigation = await f.json('/api/instruction-taxonomy/navigation');
  assert.deepEqual(navigation.data.catalogs, []);
  assert.deepEqual(f.bytes(), before);
});

test('sitemap follows live emptiness, indexing and canonical settings without inventing taxonomy dates', async t => {
  const f = await fixture(t, [instruction('only')]);
  f.publish();
  const sectionPath = f.entityPath('section', 'W01');
  const tagPath = f.entityPath('tag', 'T47');
  let sitemap = await f.html('/sitemap.xml');
  let locations = sitemapLocations(sitemap.text);
  for (const taxonomyPath of [f.entityPath('catalog', 'H02'), sectionPath, tagPath]) {
    assert.ok(locations.includes(f.taxonomyOrigin + taxonomyPath));
    const entry = sitemap.text.match(
      new RegExp(
        `<url>\\s*<loc>${(f.taxonomyOrigin + taxonomyPath).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}<\\/loc>([\\s\\S]*?)<\\/url>`,
        'u',
      ),
    );
    assert.ok(entry);
    assert.equal(entry[1].includes('<lastmod>'), false);
  }
  f.update('tag', 'T47', { canonicalUrl: 'https://example.com/reviewed-topic/' });
  let tag = await f.html(tagPath);
  assert.equal(tag.response.status, 200);
  assert.ok(tag.text.includes('href="https://example.com/reviewed-topic/"'));
  assert.match(tag.text, /name="robots"[^>]*content="noindex, follow"/u);
  sitemap = await f.html('/sitemap.xml');
  locations = sitemapLocations(sitemap.text);
  assert.equal(locations.includes(f.taxonomyOrigin + tagPath), false);
  f.repository.save({ ...f.repository.getById('only'), primaryCategoryId: 'W02', tagIds: [] });
  const empty = await f.html(sectionPath);
  assert.equal(empty.response.status, 200);
  assert.match(empty.text, /name="robots"[^>]*content="noindex, follow"/u);
  assert.equal(
    f.taxonomyRepository.read().sections.find(item => item.code === 'W01').indexingEnabled,
    true,
  );
  sitemap = await f.html('/sitemap.xml');
  assert.equal(sitemapLocations(sitemap.text).includes(f.taxonomyOrigin + sectionPath), false);
});

test('published root metadata is independent, safe and read-only while invalid query inputs fail without leaking drafts', async t => {
  const original = instruction('root-content');
  const f = await fixture(t, [original]);
  f.publish();
  const before = f.bytes();
  f.update('root', 'ROOT', {
    status: 'published',
    indexingEnabled: false,
    name: 'Редактируемое название каталога',
    h1: 'Отдельный H1 общего каталога',
    seoTitle: 'Отдельный root SEO <безопасно>',
    seoDescription: 'Описание root "с кавычками"',
    introContent: paragraph('Публичное введение <script>не код</script>'),
    seoContent: paragraph('Дополнительный root-текст'),
  });
  const root = await f.html(rootPath);
  assert.equal(root.response.status, 200);
  assert.equal((root.text.match(/<h1\b/gu) || []).length, 1);
  assert.ok(root.text.includes('Отдельный H1 общего каталога'));
  assert.ok(root.text.includes('<title>Отдельный root SEO &lt;безопасно&gt;</title>'));
  assert.ok(root.text.includes('Публичное введение &lt;script&gt;не код&lt;/script&gt;'));
  assert.ok(root.text.includes('Дополнительный root-текст'));
  assert.ok(root.text.includes(`href="${f.taxonomyOrigin}${rootPath}"`));
  assert.equal(root.text.includes('<script>не код</script>'), false);
  assert.match(root.text, /name="robots"[^>]*content="noindex, follow"/u);
  assert.equal(
    sitemapLocations((await f.html('/sitemap.xml')).text).includes(f.origin + rootPath),
    false,
  );
  assert.equal(
    sitemapLocations((await f.html('/sitemap.xml')).text).includes(f.taxonomyOrigin + rootPath),
    false,
  );
  const instructionPage = await f.html(getInstructionPublicPath(original));
  assert.equal(instructionPage.response.status, 200);
  assert.ok(instructionPage.text.includes(`<title>${original.seoTitle}</title>`));
  for (const suffix of ['?q=x&q=y', '?sort=unknown', '?page=0']) {
    const response = await f.request(f.entityPath('section', 'W01') + suffix);
    assert.equal(response.status, 400, suffix);
  }
  const missing = await f.json(
    `/api/instruction-taxonomy/page?path=${encodeURIComponent(f.entityPath('section', 'P01'))}`,
  );
  assert.equal(missing.response.status, 404);
  assert.equal(JSON.stringify(missing.data).includes('sourceIssues'), false);
  assert.deepEqual(f.bytes(), before);
});
