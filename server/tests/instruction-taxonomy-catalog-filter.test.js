import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { instructionsRouter } from '../src/routes/instructions.js';
import { createSeoRouter } from '../src/routes/seo.js';
import { instructionsRepository } from '../src/services/instructionsRepository.js';
import {
  filterInstructionsByTaxonomy,
  getInstructionTaxonomyFilterOptions,
  validateInstructionTaxonomyFilters,
} from '../src/services/instructionTaxonomyFilterService.js';

const records = [
  {
    id: 'slesar-elektrik-filter',
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
    primaryCategoryId: 'electrical',
    tagIds: ['slesar', 'elektrik'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual', needsReview: false },
    instructionContent: { type: 'doc', content: [] },
    createdAt: '2026-10-18T10:00:00Z',
  },
  {
    id: 'slesar-santekhnik-filter',
    title: 'Инструкция по охране труда для слесаря-сантехника',
    profession: 'слесаря-сантехника',
    primaryCategoryId: 'property',
    tagIds: ['slesar', 'slesar'],
    createdAt: '2026-10-17T10:00:00Z',
  },
  {
    id: 'elektrik-filter',
    title: 'Инструкция по охране труда для электрика',
    profession: 'электрика',
    primaryCategoryId: 'electrical',
    tagIds: ['elektrik'],
    createdAt: '2026-10-16T10:00:00Z',
  },
  {
    id: 'legacy-filter',
    title: 'Инструкция по охране труда для офисного работника',
    profession: 'офисного работника',
    createdAt: '2026-10-15T10:00:00Z',
  },
];

test('filter labels and counts come only from existing canonical assignments', () => {
  const before = structuredClone(records);
  const options = getInstructionTaxonomyFilterOptions(records);

  assert.deepEqual(
    options.categories.find(item => item.id === 'electrical'),
    { id: 'electrical', label: 'Электротехника и энергетика', count: 2 },
  );
  assert.equal(options.categories.find(item => item.id === 'property')?.count, 1);
  assert.equal(
    options.categories.some(item => item.id === 'office'),
    false,
  );
  assert.equal(options.tags.find(item => item.id === 'slesar')?.count, 2);
  assert.equal(options.tags.find(item => item.id === 'elektrik')?.count, 2);
  assert.equal(
    options.tags.some(item => item.id === 'not-a-tag'),
    false,
  );
  assert.ok(
    options.tags.every(item => Object.keys(item).sort().join(',') === 'count,id,label,type'),
  );
  assert.deepEqual(records, before);
});

test('category and tag are exact-match AND filters; legacy records are not guessed', () => {
  assert.deepEqual(validateInstructionTaxonomyFilters({}), { category: '', tag: '' });
  assert.deepEqual(
    filterInstructionsByTaxonomy(records, { tag: 'slesar' }).map(item => item.id),
    ['slesar-elektrik-filter', 'slesar-santekhnik-filter'],
  );
  assert.deepEqual(
    filterInstructionsByTaxonomy(records, { category: 'electrical', tag: 'slesar' }).map(
      item => item.id,
    ),
    ['slesar-elektrik-filter'],
  );
  assert.deepEqual(
    filterInstructionsByTaxonomy(records, { category: 'office' }).map(item => item.id),
    [],
  );
  assert.deepEqual(filterInstructionsByTaxonomy(records, {}), records);
  for (const filter of [
    { tag: 'unknown' },
    { category: 'UNKNOWN' },
    { tag: ['slesar', 'elektrik'] },
    { category: { id: 'electrical' } },
    { tag: '__proto__' },
  ]) {
    assert.throws(() => validateInstructionTaxonomyFilters(filter), TypeError);
  }
});

async function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-filter-'));
  const indexPath = path.join(folder, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Before</title></head><body><div id="root"></div></body></html>',
  );
  const oldCache = instructionsRepository.cache;
  instructionsRepository.cache = new Map(records.map(item => [item.id, item]));
  const repository = {
    getAll: () => records,
    getBySlug: slug => records.find(item => item.id === slug) || null,
  };
  const app = express();
  app.use('/api/instructions', instructionsRouter);
  app.use(createSeoRouter({ repository, indexPath, relatedInstructions: () => [] }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    instructionsRepository.cache = oldCache;
    fs.rmSync(folder, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('API filters before pagination and keeps existing search and sort behavior', async t => {
  const base = await fixture(t);
  const filtersResponse = await fetch(`${base}/api/instructions/taxonomy-filters`);
  assert.equal(filtersResponse.status, 200);
  assert.equal(filtersResponse.headers.get('cache-control'), 'no-store');
  const options = await filtersResponse.json();
  assert.equal(options.tags.find(item => item.id === 'slesar')?.count, 2);

  const filtered = await fetch(`${base}/api/instructions?tag=slesar&page=2&pageSize=1&sort=newest`);
  assert.equal(filtered.status, 200);
  const data = await filtered.json();
  assert.equal(data.total, 2);
  assert.equal(data.totalPages, 2);
  assert.equal(data.page, 2);
  assert.equal(data.items[0].id, 'slesar-santekhnik-filter');

  const both = await fetch(`${base}/api/instructions?category=electrical&tag=slesar&pageSize=20`);
  assert.equal(both.status, 200);
  const selected = await both.json();
  assert.equal(selected.total, 1);
  assert.equal(selected.items[0].id, 'slesar-elektrik-filter');

  const ordinary = await fetch(`${base}/api/instructions?pageSize=20`);
  assert.equal(ordinary.status, 200);
  assert.equal((await ordinary.json()).total, 4);

  const searched = await fetch(
    `${base}/api/instructions?category=electrical&tag=slesar&q=слесаря-электрика`,
  );
  assert.equal(searched.status, 200);
  assert.equal((await searched.json()).total, 1);

  for (const invalid of ['?tag=unknown', '?category=bad', '?tag=slesar&tag=elektrik']) {
    const response = await fetch(`${base}/api/instructions${invalid}`);
    assert.equal(response.status, 400, invalid);
  }
});

test('filtered catalog SSR matches the API and cannot create indexable tag pages', async t => {
  const base = await fixture(t);
  const filtered = await fetch(`${base}/instrukcii-po-ohrane-truda?tag=slesar`);
  assert.equal(filtered.status, 200);
  const html = await filtered.text();
  assert.ok(html.includes('/instrukciya-po-ohrane-truda/slesar-elektrik-filter'));
  assert.ok(html.includes('/instrukciya-po-ohrane-truda/slesar-santekhnik-filter'));
  assert.ok(!html.includes('/instrukciya-po-ohrane-truda/elektrik-filter'));
  assert.ok(!html.includes('/instrukciya-po-ohrane-truda/legacy-filter'));
  assert.match(html, /name="robots"\s+content="noindex, follow"/u);
  assert.match(html, /rel="canonical"\s+href="[^"]+\/instrukcii-po-ohrane-truda"/u);

  assert.match(
    html,
    /class="InstructionTaxonomy_tag" href="\/instrukcii-po-ohrane-truda\?tag=slesar">Слесарь<\/a>/u,
  );
  assert.match(
    html,
    /class="InstructionTaxonomy_tag" href="\/instrukcii-po-ohrane-truda\?tag=elektrik">Электрик<\/a>/u,
  );
  assert.match(html, /<style data-instruction-taxonomy>/u);

  const combined = await fetch(`${base}/instrukcii-po-ohrane-truda?tag=slesar&category=electrical`);
  const combinedHtml = await combined.text();
  assert.ok(combinedHtml.includes('/instrukciya-po-ohrane-truda/slesar-elektrik-filter'));
  assert.ok(!combinedHtml.includes('/instrukciya-po-ohrane-truda/slesar-santekhnik-filter'));

  const canonical = await fetch(`${base}/instrukcii-po-ohrane-truda`);
  assert.match(await canonical.text(), /name="robots"\s+content="index, follow/u);

  const bad = await fetch(`${base}/instrukcii-po-ohrane-truda?tag=nonexistent`);
  assert.equal(bad.status, 400);
});

test('catalog summaries expose saved canonical tags without editorial metadata or documents', async t => {
  const base = await fixture(t);
  const response = await fetch(`${base}/api/instructions?pageSize=20`);
  assert.equal(response.status, 200);
  const { items } = await response.json();
  const byId = new Map(items.map(item => [item.id, item]));

  assert.deepEqual(byId.get('slesar-elektrik-filter').taxonomyDisplay, {
    category: { id: 'electrical', label: 'Электротехника и энергетика' },
    tags: [
      { id: 'slesar', label: 'Слесарь' },
      { id: 'elektrik', label: 'Электрик' },
    ],
  });
  assert.deepEqual(byId.get('slesar-santekhnik-filter').taxonomyDisplay.tags, [
    { id: 'slesar', label: 'Слесарь' },
  ]);
  assert.equal(Object.hasOwn(byId.get('legacy-filter'), 'taxonomyDisplay'), false);
  for (const item of items) {
    assert.equal(Object.hasOwn(item, 'taxonomyMeta'), false);
    assert.equal(Object.hasOwn(item, 'instructionContent'), false);
    assert.equal(Object.hasOwn(item, 'tagIds'), false);
  }
});

test('catalog UI persists category and tag IDs in URL and maintains query/sorting', () => {
  const hook = fs.readFileSync(
    new URL(
      '../../client/src/components/InstructionCatalog/hooks/useInstructionsCatalog.js',
      import.meta.url,
    ),
    'utf8',
  );
  const catalog = fs.readFileSync(
    new URL(
      '../../client/src/components/InstructionCatalog/InstructionsCatalog.jsx',
      import.meta.url,
    ),
    'utf8',
  );
  const ui = fs.readFileSync(
    new URL(
      '../../client/src/components/InstructionCatalog/CatalogTaxonomyFilters.jsx',
      import.meta.url,
    ),
    'utf8',
  );
  const instruction = fs.readFileSync(
    new URL('../../client/src/components/InstructionPage/InstructionTaxonomy.jsx', import.meta.url),
    'utf8',
  );
  assert.match(hook, /searchParams\.get\('category'\)/u);
  assert.match(hook, /searchParams\.get\('tag'\)/u);
  assert.match(hook, /params\.set\('category', category\)/u);
  assert.match(hook, /params\.set\('tag', tag\)/u);
  assert.match(hook, /next\.delete\('page'\)/u);
  assert.match(catalog, /<CatalogTaxonomyFilters/u);
  assert.match(ui, /Сбросить фильтры/u);
  assert.match(instruction, /\?category=\$\{encodeURIComponent\(category\.id\)\}/u);
  assert.match(instruction, /\?tag=\$\{encodeURIComponent\(tag\.id\)\}/u);
});
