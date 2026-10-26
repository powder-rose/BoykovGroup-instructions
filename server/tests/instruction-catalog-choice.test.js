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
import { getInstructionTaxonomyAssignmentCatalog } from '../src/services/instructionTaxonomyAssignmentCatalog.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import {
  filterInstructionsByTaxonomy,
  getInstructionTaxonomyFilterOptions,
  validateInstructionTaxonomyFilters,
} from '../src/services/instructionTaxonomyFilterService.js';

function records() {
  return [
    {
      id: 'role-engineer',
      title: 'Инструкция для инженера',
      primaryCategoryId: 'P06',
      tagIds: ['T06'],
      createdAt: '2026-10-26',
    },
    {
      id: 'role-electrician',
      title: 'Инструкция для электрика',
      primaryCategoryId: 'P10',
      tagIds: ['T35'],
      createdAt: '2026-10-25',
    },
    {
      id: 'role-engineer-older',
      title: 'Инструкция для инженера цеха',
      primaryCategoryId: 'P06',
      tagIds: ['T06'],
      createdAt: '2026-10-24',
    },
    {
      id: 'work-electrical',
      title: 'Инструкция при электромонтажных работах',
      primaryCategoryId: 'W02',
      tagIds: ['T35'],
      createdAt: '2026-10-23',
    },
    {
      id: 'work-welding',
      title: 'Инструкция при сварочных работах',
      primaryCategoryId: 'W03',
      tagIds: ['T11'],
      createdAt: '2026-10-22',
    },
    {
      id: 'legacy-looks-like-work',
      title: 'Инструкция при электромонтажных работах',
      primaryCategoryId: 'electrical',
      tagIds: ['T35'],
      createdAt: '2026-10-21',
    },
    { id: 'held-looks-like-role', title: 'Инструкция для инженера', createdAt: '2026-10-20' },
  ];
}

test('catalog selection follows saved section parents and does not classify legacy or held records', () => {
  const input = records();
  const before = structuredClone(input);
  assert.deepEqual(
    filterInstructionsByTaxonomy(input, { catalogId: 'H01' }).map(x => x.id),
    ['role-engineer', 'role-electrician', 'role-engineer-older'],
  );
  assert.deepEqual(
    filterInstructionsByTaxonomy(input, { catalogId: 'H02', tag: 'T35' }).map(x => x.id),
    ['work-electrical'],
  );
  assert.deepEqual(filterInstructionsByTaxonomy(input, { catalogId: 'H02', category: 'P06' }), []);
  assert.deepEqual(filterInstructionsByTaxonomy(input, {}), input);

  const registry = getInstructionTaxonomyRegistrySeed();
  registry.sections.find(x => x.code === 'P06').parentCode = 'H02';
  const catalog = getInstructionTaxonomyAssignmentCatalog(registry);
  assert.deepEqual(
    filterInstructionsByTaxonomy(input, { catalogId: 'H02', category: 'P06' }, { catalog }).map(
      x => x.id,
    ),
    ['role-engineer', 'role-engineer-older'],
  );
  assert.deepEqual(input, before);
});

test('catalog counts include assigned published documents only and retain zero-count choices', () => {
  const input = [
    ...records(),
    { id: 'draft', primaryCategoryId: 'P06', status: 'draft' },
    { id: 'seo-draft', primaryCategoryId: 'W02', seoStatus: 'draft' },
  ];
  const options = getInstructionTaxonomyFilterOptions(input);
  assert.deepEqual(
    options.catalogs.map(x => [x.id, x.count]),
    [
      ['H01', 3],
      ['H02', 2],
    ],
  );
  assert.equal(options.categories.find(x => x.id === 'P06').catalogId, 'H01');
  assert.equal(options.categories.find(x => x.id === 'W02').catalogId, 'H02');
  assert.equal(
    Object.hasOwn(
      options.categories.find(x => x.id === 'electrical'),
      'catalogId',
    ),
    false,
  );
  assert.deepEqual(
    getInstructionTaxonomyFilterOptions([]).catalogs.map(x => x.count),
    [0, 0],
  );
});

test('only exact catalog IDs are accepted', () => {
  assert.deepEqual(validateInstructionTaxonomyFilters({ catalogId: 'H01' }), {
    category: '',
    tag: '',
    catalogId: 'H01',
  });
  for (const catalogId of [
    'h01',
    'P06',
    'H99',
    'По видам работ',
    '__proto__',
    ['H01', 'H02'],
    {},
  ]) {
    assert.throws(() => validateInstructionTaxonomyFilters({ catalogId }), TypeError);
  }
});

test('filter menus contain only the selected catalog and category tags with scoped counts', () => {
  const input = [
    ...records(),
    { id: 'draft', primaryCategoryId: 'P06', tagIds: ['T11'], status: 'draft' },
  ];
  const before = structuredClone(input);
  const options = getInstructionTaxonomyFilterOptions(input, { catalogId: 'H01' });
  assert.deepEqual(
    options.categories.map(x => [x.id, x.count]),
    [
      ['P06', 2],
      ['P10', 1],
    ],
  );
  assert.deepEqual(
    options.tags.map(x => [x.id, x.count]),
    [
      ['T06', 2],
      ['T35', 1],
    ],
  );
  const section = getInstructionTaxonomyFilterOptions(input, { catalogId: 'H01', category: 'P06' });
  assert.deepEqual(section.categories, options.categories);
  assert.deepEqual(section.catalogs, options.catalogs);
  assert.deepEqual(
    section.tags.map(x => [x.id, x.count]),
    [['T06', 2]],
  );
  const work = getInstructionTaxonomyFilterOptions(input, { catalogId: 'H02' });
  assert.deepEqual(
    work.tags.map(x => [x.id, x.count]),
    [
      ['T11', 1],
      ['T35', 1],
    ],
  );
  assert.deepEqual(work.catalogs, options.catalogs);
  assert.deepEqual(
    getInstructionTaxonomyFilterOptions(input, { catalogId: 'H02', category: 'P06' }).tags,
    [],
  );
  assert.deepEqual(input, before);
});

async function fixture(t) {
  const input = records();
  t.mock.method(instructionsRepository, 'getAll', () => input);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-catalog-choice-'));
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html><head><title>Catalog</title></head><body><div id="root"></div></body></html>',
  );
  const app = express();
  app.use('/api/instructions', instructionsRouter);
  app.use(
    createSeoRouter({
      repository: { getAll: () => input },
      indexPath,
      relatedInstructions: () => [],
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
  return `http://127.0.0.1:${server.address().port}`;
}

test('filter metadata API validates context and narrows menus without changing global catalog counts', async t => {
  const base = await fixture(t);
  const response = await fetch(
    base + '/api/instructions/taxonomy-filters?catalog=H02&category=W02',
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const options = await response.json();
  assert.deepEqual(
    options.categories.map(x => x.id),
    ['W02', 'W03'],
  );
  assert.deepEqual(
    options.tags.map(x => [x.id, x.count]),
    [['T35', 1]],
  );
  assert.deepEqual(
    options.catalogs.map(x => [x.id, x.count]),
    [
      ['H01', 3],
      ['H02', 2],
    ],
  );
  for (const query of [
    'catalog=H99',
    'catalog=H01&catalog=H02',
    'category=missing',
    'category=P06&category=P10',
  ]) {
    assert.equal((await fetch(base + '/api/instructions/taxonomy-filters?' + query)).status, 400);
  }
  const legacy = await (
    await fetch(base + '/api/instructions/taxonomy-filters?category=electrical')
  ).json();
  assert.deepEqual(
    legacy.tags.map(x => [x.id, x.count]),
    [['T35', 1]],
  );
});

test('API catalog choice combines with search, tags, sort and pagination before slicing', async t => {
  const base = await fixture(t);
  const read = async query => {
    const response = await fetch(base + '/api/instructions' + query);
    assert.equal(response.status, 200);
    return response.json();
  };
  const options = await (await fetch(base + '/api/instructions/taxonomy-filters')).json();
  assert.deepEqual(
    options.catalogs.map(x => [x.id, x.count]),
    [
      ['H01', 3],
      ['H02', 2],
    ],
  );
  const second = await read('?catalog=H01&pageSize=1&page=2&sort=newest');
  assert.equal(second.total, 3);
  assert.equal(second.totalPages, 3);
  assert.equal(second.items[0].id, 'role-electrician');
  assert.deepEqual(
    (await read('?catalog=H02&tag=T35')).items.map(x => x.id),
    ['work-electrical'],
  );
  assert.equal((await read('?catalog=H01&category=P06&q=инженера')).total, 2);
  const empty = await read('?catalog=H02&category=P06&page=99');
  assert.deepEqual([empty.total, empty.page, empty.totalPages], [0, 1, 1]);
  assert.equal((await read('?pageSize=20')).total, 7);
  for (const query of [
    '?catalog=h01',
    '?catalog=P06',
    '?catalog=H99',
    '?catalog=H01&catalog=H02',
  ]) {
    assert.equal((await fetch(base + '/api/instructions' + query)).status, 400);
  }
});

test('catalog SSR filters the same scope and query variants stay non-indexable', async t => {
  const base = await fixture(t);
  const response = await fetch(base + '/instrukcii-po-ohrane-truda?catalog=H02&tag=T35');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  const html = await response.text();
  assert.match(html, /\/instrukciya-po-ohrane-truda\/work-electrical/u);
  for (const id of [
    'role-electrician',
    'work-welding',
    'legacy-looks-like-work',
    'held-looks-like-role',
  ]) {
    assert.ok(!html.includes('/instrukciya-po-ohrane-truda/' + id), id);
  }
  assert.match(html, /rel="canonical"\s+href="[^"]+\/instrukcii-po-ohrane-truda"/u);
  assert.equal((await fetch(base + '/instrukcii-po-ohrane-truda?catalog=P06')).status, 400);
});
