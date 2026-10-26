import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';

import { buildInstructionTaxonomyPublication } from '../src/services/instructionTaxonomyPublication.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { createInstructionTaxonomyRouter } from '../src/routes/instructionTaxonomy.js';
import { createSeoRouter } from '../src/routes/seo.js';
import { getInstructionTaxonomyAssignmentCatalog } from '../src/services/instructionTaxonomyAssignmentCatalog.js';
import { getInstructionTaxonomyFilterOptions } from '../src/services/instructionTaxonomyFilterService.js';

function fixtureData() {
  const state = buildInstructionTaxonomyPublication(getInstructionTaxonomyRegistrySeed()).after;
  const records = state.tags.map((tag, index) => ({
    id: 'instruction-' + index,
    slug: 'instruction-' + index,
    title: 'Инструкция ' + index,
    primaryCategoryId: state.sections[index % state.sections.length].code,
    tagIds: [tag.code],
  }));
  const repository = { getPublicReferencesFresh: () => records, getAll: () => records };
  const service = createInstructionTaxonomyPublicService({
    repository,
    taxonomyRepository: { read: () => state },
  });
  return { state, records, repository, service };
}

test('all 134 specification pages serve canonical HTML, with new sections and tags excluded from sitemap until enabled', async t => {
  const f = fixtureData();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-spec-public-'));
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html><head><title>Test</title></head><body><div id="root"></div></body></html>',
  );
  const app = express();
  app.use('/api/instruction-taxonomy', createInstructionTaxonomyRouter({ service: f.service }));
  app.use(
    createSeoRouter({
      repository: f.repository,
      taxonomyService: f.service,
      indexPath,
      relatedInstructions: () => [],
      taxonomyOrigin: 'https://boykovdocs.ru',
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const snapshot = f.service.snapshot();
  const navigation = snapshot.navigation('https://boykovdocs.ru');
  assert.equal(navigation.catalogs.length, 2);
  assert.equal(navigation.catalogs.flatMap(x => x.sections).length, 52);
  assert.equal(navigation.tags.length, 79);
  const paths = [
    '/instrukcii-po-ohrane-truda',
    ...navigation.catalogs.flatMap(x => [x.path, ...x.sections.map(y => y.path)]),
    ...navigation.tags.map(x => x.path),
  ];
  for (const pathname of paths) {
    const response = await fetch(base + pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.ok(html.includes('https://boykovdocs.ru' + pathname), pathname);
    if (pathname !== '/instrukcii-po-ohrane-truda')
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.match(html, /<a [^>]*href="\/instrukciya-po-ohrane-truda\//u);
  }
  const rootHtml = await (await fetch(base + '/instrukcii-po-ohrane-truda')).text();
  const directoryHtml = rootHtml.match(/<details\b[^>]*>[\s\S]*?<\/details>/u)?.[0];
  assert.ok(directoryHtml);
  assert.match(directoryHtml, /<summary>Все разделы и темы<\/summary>/u);
  assert.doesNotMatch(directoryHtml, /<details[^>]*\bopen\b/u);
  for (const pathname of paths.slice(1))
    assert.ok(directoryHtml.includes(`href="${pathname}"`), pathname);
  const sitemap = await (await fetch(base + '/sitemap.xml')).text();
  for (const pathname of paths.slice(1))
    assert.ok(!sitemap.includes('<loc>https://boykovdocs.ru' + pathname + '</loc>'), pathname);
  for (const query of ['?q=Инструкция', '?sort=newest', '?page=1', '?tag=T03']) {
    const response = await fetch(base + navigation.tags[0].path + query);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  }
  f.state.sections.find(x => x.code === 'W01').indexingEnabled = true;
  const work = f.service
    .snapshot()
    .navigation('https://boykovdocs.ru')
    .catalogs.find(x => x.code === 'H02')
    .sections.find(x => x.code === 'W01');
  assert.equal((await fetch(base + work.path)).headers.get('x-robots-tag'), 'index, follow');
  assert.ok(
    (await (await fetch(base + '/sitemap.xml')).text()).includes(
      '<loc>https://boykovdocs.ru' + work.path + '</loc>',
    ),
  );
  f.state.sections.find(x => x.code === 'W01').status = 'draft';
  assert.equal((await fetch(base + work.path)).status, 404);
});

test('public metadata exposes only published routes and menu scope preserves them', () => {
  const f = fixtureData();
  const catalog = getInstructionTaxonomyAssignmentCatalog(f.state);
  const options = getInstructionTaxonomyFilterOptions(f.records, { catalog, catalogId: 'H01' });
  assert.equal(
    options.catalogs.find(x => x.id === 'H01').path,
    '/instrukcii-po-ohrane-truda/po-professiyam/',
  );
  for (const category of options.categories)
    assert.ok(category.path.startsWith('/instrukcii-po-ohrane-truda/po-professiyam/'));
  for (const tag of options.tags)
    assert.ok(tag.path.startsWith('/instrukcii-po-ohrane-truda/temy/'));
  f.state.tags[0].status = 'draft';
  assert.equal(getInstructionTaxonomyAssignmentCatalog(f.state).tags[0].path, undefined);
});

test('large catalog pages use reference metadata and paginate without returning document bodies', () => {
  const f = fixtureData();
  const records = Array.from({ length: 5000 }, (_, index) => ({
    id: 'scale-' + index,
    title: 'Инструкция ' + index,
    primaryCategoryId: 'P02',
    tagIds: ['T02'],
  }));
  let reads = 0;
  const service = createInstructionTaxonomyPublicService({
    repository: {
      getPublicReferencesFresh: () => {
        reads++;
        return records;
      },
      getAll: () => {
        throw new Error('Full documents must not be loaded');
      },
    },
    taxonomyRepository: { read: () => f.state },
  });
  const snapshot = service.snapshot();
  const page = snapshot.resolve(
    '/instrukcii-po-ohrane-truda/po-professiyam/buhgalteriya-i-finansy/',
    { page: '2' },
    'https://boykovdocs.ru',
  ).page;
  assert.equal(reads, 1);
  assert.equal(page.total, 5000);
  assert.equal(page.items.length, 24);
  assert.equal(page.totalPages, 209);
  assert.ok(
    page.items.every(item => !Object.hasOwn(item, 'content') && !Object.hasOwn(item, 'document')),
  );
});
