import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createInstructionPagesRouter } from '../src/routes/instructionPages.js';
import { instructionsRouter } from '../src/routes/instructions.js';
import { createSeoRouter } from '../src/routes/seo.js';
import { getInstructionTaxonomyAssignmentCatalog } from '../src/services/instructionTaxonomyAssignmentCatalog.js';
import { getInstructionTaxonomyDisplay } from '../src/services/instructionTaxonomyDisplayService.js';
import {
  filterInstructionsByTaxonomy,
  getInstructionTaxonomyFilterOptions,
  validateInstructionTaxonomyFilters,
} from '../src/services/instructionTaxonomyFilterService.js';
import {
  createInstructionTaxonomyRegistryRepository,
  instructionTaxonomyRegistryRepository,
} from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { instructionsRepository } from '../src/services/instructionsRepository.js';

function instructions() {
  return [
    {
      id: 'coded-public-instruction',
      title: 'Инструкция по охране труда при работе на высоте',
      primaryCategoryId: 'W01',
      tagIds: ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'slesar', 'T01'],
      taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual' },
      instructionContent: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Сохранённый текст.' }] }],
      },
      createdAt: '2026-10-23T12:00:00Z',
    },
    {
      id: 'legacy-public-instruction',
      title: 'Инструкция по охране труда для слесаря',
      primaryCategoryId: 'electrical',
      tagIds: ['slesar', 'slesar'],
      createdAt: '2026-10-22T12:00:00Z',
    },
    {
      id: 'unassigned-public-instruction',
      title: 'Инструкция по охране труда при работе с газовыми баллонами',
      createdAt: '2026-10-21T12:00:00Z',
    },
  ];
}

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-registry-public-'));
  const filePath = path.join(directory, 'taxonomy.json');
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Before</title></head><body><div id="root"></div></body></html>',
  );
  const records = instructions();
  const registryRepository = createInstructionTaxonomyRegistryRepository({ filePath });
  const registryService = createInstructionTaxonomyRegistryService({
    repository: registryRepository,
    getInstructions: () => records,
  });
  let reads = 0;
  t.mock.method(instructionTaxonomyRegistryRepository, 'read', () => {
    reads += 1;
    return registryRepository.read();
  });
  const oldCache = instructionsRepository.cache;
  instructionsRepository.cache = new Map(records.map(item => [item.id, item]));
  const repository = {
    getAll: () => records,
    getBySlug: id => records.find(item => item.id === id) || null,
  };
  const app = express();
  app.use('/api/instructions', createInstructionPagesRouter({ repository }));
  app.use('/api/instructions', instructionsRouter);
  app.use(createSeoRouter({ repository, indexPath, relatedInstructions: () => [] }));
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) =>
    res.status(500).json({ error: error.message, code: error.code }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    instructionsRepository.cache = oldCache;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    records,
    filePath,
    registryRepository,
    registryService,
    reads: () => reads,
  };
}

test('safe catalog snapshots resolve all stored codes and legacy IDs without inference or a tag cap', t => {
  const state = getInstructionTaxonomyRegistrySeed();
  const catalog = getInstructionTaxonomyAssignmentCatalog(state);
  t.mock.method(instructionTaxonomyRegistryRepository, 'read', () => {
    throw new Error('An explicit snapshot must not read runtime storage');
  });
  const records = instructions();
  const before = structuredClone(records);
  const display = getInstructionTaxonomyDisplay(records[0], { catalog });
  assert.deepEqual(display.category, { id: 'W01', label: 'Работы на высоте' });
  assert.equal(display.tags.length, 8);
  assert.deepEqual(display.tags.at(-1), { id: 'slesar', label: 'Слесарь' });
  assert.ok(display.tags.every(tag => Object.keys(tag).sort().join(',') === 'id,label'));
  assert.equal(getInstructionTaxonomyDisplay(records[2], { catalog }), null);
  assert.deepEqual(
    getInstructionTaxonomyDisplay({ tagIds: ['sosudy-pod-davleniem'] }, { catalog }).tags.map(
      tag => tag.id,
    ),
    ['sosudy-pod-davleniem'],
  );
  assert.deepEqual(
    filterInstructionsByTaxonomy(records, { category: 'W01', tag: 'T01' }, { catalog }).map(
      item => item.id,
    ),
    ['coded-public-instruction'],
  );
  assert.deepEqual(filterInstructionsByTaxonomy(records, { tag: 'T47' }, { catalog }), []);
  for (const filter of [
    { category: 'H02' },
    { category: 'w01' },
    { tag: 'Газовые баллоны' },
    { tag: 't47' },
    { tag: ['T01', 'T02'] },
  ])
    assert.throws(() => validateInstructionTaxonomyFilters(filter, { catalog }), TypeError);

  const options = getInstructionTaxonomyFilterOptions(
    [
      ...records,
      { id: 'draft', status: 'draft', primaryCategoryId: 'W01', tagIds: ['T01'] },
      { id: 'seo-draft', seoStatus: 'draft', primaryCategoryId: 'W01', tagIds: ['T01'] },
    ],
    { catalog },
  );
  assert.equal(options.categories.find(item => item.id === 'W01').count, 1);
  assert.equal(options.tags.find(item => item.id === 'T01').count, 1);
  assert.equal(options.tags.find(item => item.id === 'slesar').count, 2);
  assert.equal(options.tags.find(item => item.id === 'T01').type, 'topic');
  assert.equal(
    options.tags.some(item => item.id === 'T47'),
    false,
  );
  assert.deepEqual(records, before);
});

test('public API and SSR query links use one fresh snapshot and retain all coded labels', async t => {
  const f = await fixture(t);
  const before = structuredClone(f.records);
  const oneRead = async url => {
    const reads = f.reads();
    const response = await fetch(`${f.base}${url}`);
    assert.equal(response.status, 200, url);
    assert.equal(f.reads() - reads, 1, `One registry snapshot for ${url}`);
    return response;
  };
  const optionsResponse = await oneRead('/api/instructions/taxonomy-filters');
  assert.equal(optionsResponse.headers.get('cache-control'), 'no-store');
  const options = await optionsResponse.json();
  assert.equal(options.categories.find(item => item.id === 'W01').count, 1);
  assert.equal(options.tags.find(item => item.id === 'T01').count, 1);
  assert.equal(options.tags.find(item => item.id === 'slesar').count, 2);

  const results = await (
    await oneRead('/api/instructions?category=W01&tag=T01&pageSize=20')
  ).json();
  assert.equal(results.total, 1);
  assert.equal(results.items[0].taxonomyDisplay.tags.length, 8);
  assert.equal(Object.hasOwn(results.items[0], 'taxonomyMeta'), false);
  const page = await (await oneRead('/api/instructions/page/coded-public-instruction')).json();
  assert.deepEqual(page.taxonomyDisplay, results.items[0].taxonomyDisplay);

  const html = await (await oneRead('/instrukcii-po-ohrane-truda?category=W01&tag=T01')).text();
  assert.ok(html.includes('/instrukciya-po-ohrane-truda/coded-public-instruction'));
  assert.ok(!html.includes('/instrukciya-po-ohrane-truda/legacy-public-instruction'));
  assert.ok(!html.includes('/instrukciya-po-ohrane-truda/unassigned-public-instruction'));
  assert.match(html, /name="robots"\s+content="noindex, follow"/u);
  assert.match(html, /rel="canonical"\s+href="[^"]+\/instrukcii-po-ohrane-truda"/u);
  for (const tag of page.taxonomyDisplay.tags) {
    assert.ok(html.includes(`?tag=${tag.id}`));
    assert.ok(html.includes(tag.label));
  }
  const article = await (
    await oneRead('/instrukciya-po-ohrane-truda/coded-public-instruction')
  ).text();
  assert.ok(article.includes('?category=W01">Раздел: Работы на высоте'));
  for (const tag of page.taxonomyDisplay.tags) assert.ok(article.includes(`?tag=${tag.id}`));
  assert.equal(article.includes('taxonomyMeta'), false);
  assert.equal(article.includes('originalUrl'), false);
  assert.deepEqual(f.records, before);
});

test('saved renames appear on the next request and removed unknown codes never become aliases', async t => {
  const f = await fixture(t);
  const update = (kind, code, patch) =>
    f.registryService.update(kind, code, patch, {
      expectedRevision: f.registryRepository.read().revision,
    });
  update('section', 'W01', { name: 'Обновлённый раздел' });
  update('tag', 'T01', { name: 'Обновлённая тема', h1: 'PRIVATE_SEO_H1' });
  const page = await (
    await fetch(`${f.base}/api/instructions/page/coded-public-instruction`)
  ).json();
  assert.deepEqual(page.taxonomyDisplay.category, { id: 'W01', label: 'Обновлённый раздел' });
  assert.deepEqual(page.taxonomyDisplay.tags[0], { id: 'T01', label: 'Обновлённая тема' });
  assert.equal(JSON.stringify(page.taxonomyDisplay).includes('PRIVATE_SEO_H1'), false);
  const filters = await (await fetch(`${f.base}/api/instructions/taxonomy-filters`)).json();
  assert.equal(filters.tags.find(item => item.id === 'T01').label, 'Обновлённая тема');
  const article = await (
    await fetch(`${f.base}/instrukciya-po-ohrane-truda/coded-public-instruction`)
  ).text();
  assert.ok(article.includes('Раздел: Обновлённый раздел'));
  assert.ok(article.includes('Обновлённая тема'));
  assert.equal(article.includes('PRIVATE_SEO_H1'), false);
  assert.equal((await fetch(`${f.base}/api/instructions?category=W01&tag=T01`)).status, 200);

  f.registryService.create(
    'tag',
    { code: 'T99', name: 'Временная тема', slug: 'vremennaya-tema' },
    { expectedRevision: f.registryRepository.read().revision },
  );
  assert.equal((await fetch(`${f.base}/api/instructions?tag=T99`)).status, 200);
  f.registryService.remove('tag', 'T99', {
    expectedRevision: f.registryRepository.read().revision,
  });
  assert.equal((await fetch(`${f.base}/api/instructions?tag=T99`)).status, 400);
  assert.equal((await fetch(`${f.base}/instrukcii-po-ohrane-truda?tag=T99`)).status, 400);
  const display = getInstructionTaxonomyDisplay({ tagIds: ['T99', 'Временная тема'] });
  assert.equal(display, null);
});

test('corrupt registry fails public taxonomy requests without falling back to legacy definitions', async t => {
  const f = await fixture(t);
  t.mock.method(console, 'error', () => {});
  fs.writeFileSync(f.filePath, '{broken');
  for (const url of [
    '/api/instructions/taxonomy-filters',
    '/api/instructions?tag=slesar',
    '/api/instructions/page/coded-public-instruction',
    '/instrukcii-po-ohrane-truda?tag=slesar',
    '/instrukciya-po-ohrane-truda/coded-public-instruction',
  ]) {
    const response = await fetch(`${f.base}${url}`);
    assert.equal(response.status, 500, url);
    const error = await response.json();
    assert.equal(error.code, 'TAXONOMY_STORAGE_ERROR');
    assert.equal(typeof error.error, 'string');
    assert.deepEqual(Object.keys(error).sort(), ['code', 'error']);
  }
});
