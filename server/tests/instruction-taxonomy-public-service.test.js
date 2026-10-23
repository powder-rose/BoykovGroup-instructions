import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createInstructionTaxonomyPublicService,
  normalizeInstructionTaxonomyPublicOrigin,
} from '../src/services/instructionTaxonomyPublicService.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const origin = 'https://boykovdocs.ru';
const rootPath = '/instrukcii-po-ohrane-truda';
const catalogPath = `${rootPath}/po-vidam-rabot/`;
const sectionPath = `${catalogPath}raboty-na-vysote/`;
const tagPath = `${rootPath}/temy/gazovye-ballony/`;
const content = text => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function fixture() {
  const state = getInstructionTaxonomyRegistrySeed();
  const records = [];
  const reads = { registry: 0, instructions: 0 };
  const entity = code =>
    [state.root, ...state.catalogs, ...state.sections, ...state.tags].find(
      item => item.code === code,
    );
  Object.assign(entity('H02'), { status: 'published', routeApproved: true, indexingEnabled: true });
  Object.assign(entity('W01'), { status: 'published', indexingEnabled: true });
  Object.assign(entity('T47'), { status: 'published', indexingEnabled: true });
  const repository = {
    getAllFresh() {
      reads.instructions += 1;
      return records;
    },
  };
  const taxonomyRepository = {
    read() {
      reads.registry += 1;
      return state;
    },
  };
  const service = createInstructionTaxonomyPublicService({ repository, taxonomyRepository });
  return { state, records, reads, entity, repository, taxonomyRepository, service };
}

function instruction(id, overrides = {}) {
  return {
    id,
    title: `Инструкция ${id}`,
    slug: `instruction-${id}-MiXeD`,
    status: 'published',
    primaryCategoryId: 'W01',
    tagIds: ['T47'],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('snapshot reads once, counts every published assignment and isolates its owned projections', () => {
  const f = fixture();
  f.records.push(
    instruction('first'),
    instruction('noindex', { seoStatus: 'noindex', tagIds: ['T47', 'T47'] }),
    instruction('draft-section', { primaryCategoryId: 'W02', tagIds: [] }),
    instruction('legacy', { primaryCategoryId: 'office', tagIds: [] }),
    instruction('draft', { status: 'draft' }),
    instruction('seo-draft', { seoStatus: 'draft' }),
  );
  Object.defineProperty(f.records[0], 'instructionContent', {
    get() {
      throw new Error('Public list must not read full document content');
    },
  });
  const snapshot = f.service.snapshot();
  assert.deepEqual(f.reads, { registry: 1, instructions: 1 });
  const nav = snapshot.navigation(origin);
  assert.equal(nav.root, null);
  assert.deepEqual(
    nav.catalogs.map(item => [item.code, item.count]),
    [['H02', 3]],
  );
  assert.deepEqual(
    nav.catalogs[0].sections.map(item => [item.code, item.count]),
    [['W01', 2]],
  );
  assert.deepEqual(
    nav.tags.map(item => [item.code, item.count]),
    [['T47', 2]],
  );
  f.entity('W01').name = 'Изменённое имя';
  f.records[0].tagIds.length = 0;
  nav.catalogs[0].name = 'Локальная мутация DTO';
  snapshot.assignmentCatalog.tags.length = 0;
  const page = snapshot.resolve(sectionPath, {}, origin).page;
  assert.equal(page.total, 2);
  assert.equal(page.name, 'Работы на высоте');
  assert.equal(page.items[0].taxonomyDisplay.tags.length, 1);
  assert.equal(snapshot.navigation(origin).catalogs[0].name, 'По видам работ');
  assert.deepEqual(f.reads, { registry: 1, instructions: 1 });
  assert.equal(
    f.service.snapshot().navigation(origin).catalogs[0].sections[0].name,
    'Изменённое имя',
  );
});

test('draft parents, draft pages and unapproved profession routes never disclose a redirect target', () => {
  const f = fixture();
  Object.assign(f.entity('H01'), { routeApproved: true });
  Object.assign(f.entity('P01'), { status: 'published' });
  const snapshot = f.service.snapshot();
  for (const pathname of [
    `${rootPath}/po-professiyam/`,
    `${rootPath}/po-professiyam-i-dolzhnostyam/`,
    `${rootPath}/PO-PROFESSIYAM-I-DOLZHNOSTYAM`,
    `${rootPath}/po-professiyam-i-dolzhnostyam/rukovoditeli-i-upravlencheskiy-personal/`,
    `${catalogPath}zemlyanye-raboty/`,
    `${rootPath}/temy/elektroinstrument/`,
  ])
    assert.deepEqual(snapshot.resolve(pathname, {}, origin), { status: 404 });
  assert.deepEqual(
    snapshot.navigation(origin).catalogs.map(item => item.code),
    ['H02'],
  );
});

test('stored editorial fields remain independent and instruction cards expose only safe summaries', () => {
  const f = fixture();
  Object.assign(f.entity('W01'), {
    name: 'Имя раздела',
    h1: 'Отдельный H1',
    seoTitle: 'Отдельный title',
    seoDescription: 'Отдельное описание',
    introContent: content('Введение'),
    seoContent: content('Дополнительный текст'),
  });
  f.records.push(
    instruction('first', {
      source: 'manual',
      editorialMeta: { seoAuthor: 'PRIVATE_NAME' },
      instructionContent: content('PRIVATE_BODY'),
      files: ['PRIVATE_FILE'],
      taxonomyMeta: { privateNote: 'PRIVATE_META' },
    }),
  );
  const result = f.service.snapshot().resolve(sectionPath, {}, origin);
  assert.equal(result.status, 200);
  assert.equal(result.page.h1, 'Отдельный H1');
  assert.deepEqual(result.page.introContent, content('Введение'));
  assert.deepEqual(result.page.seoContent, content('Дополнительный текст'));
  assert.deepEqual(result.page.seo, {
    title: 'Отдельный title',
    description: 'Отдельное описание',
    canonicalUrl: `${origin}${sectionPath}`,
    robots: 'index, follow',
    indexable: true,
  });
  assert.deepEqual(Object.keys(result.page.items[0]), [
    'id',
    'title',
    'slug',
    'source',
    'taxonomyDisplay',
  ]);
  assert.equal(JSON.stringify(result.page).includes('PRIVATE_'), false);
  assert.deepEqual(result.page.breadcrumbs, [
    { name: 'Главная', path: '/' },
    { name: 'Инструкции по охране труда', path: rootPath },
    { name: 'По видам работ', path: catalogPath },
    { name: 'Имя раздела', path: null },
  ]);
});

test('Cyrillic title search, alphabetic order and fixed-size pagination use ordinary stable paths', () => {
  const f = fixture();
  for (let index = 1; index <= 60; index += 1)
    f.records.push(
      instruction(`doc-${String(index).padStart(2, '0')}`, {
        title: `Работы ${String(index).padStart(2, '0')}`,
      }),
    );
  const snapshot = f.service.snapshot();
  const first = snapshot.resolve(sectionPath, {}, origin).page;
  assert.equal(first.pageSize, 24);
  assert.equal(first.total, 60);
  assert.equal(first.items.length, 24);
  assert.equal(first.items[0].title, 'Работы 01');
  assert.deepEqual(first.pagination, [
    { page: 1, path: sectionPath },
    { page: 2, path: `${sectionPath}?page=2` },
    { page: 3, path: `${sectionPath}?page=3` },
  ]);
  assert.equal(first.previousPath, null);
  assert.equal(first.nextPath, `${sectionPath}?page=2`);
  const second = snapshot.resolve(sectionPath, { page: '2' }, origin).page;
  assert.equal(second.items[0].title, 'Работы 25');
  assert.equal(second.seo.canonicalUrl, `${origin}${sectionPath}`);
  assert.equal(second.seo.robots, 'noindex, follow');
  assert.equal(second.previousPath, sectionPath);
  const search = snapshot.resolve(sectionPath, { q: 'рАБоТы 05' }, origin).page;
  assert.equal(search.total, 1);
  assert.equal(search.items[0].title, 'Работы 05');
  assert.equal(search.seo.indexable, false);
  assert.deepEqual(snapshot.resolve(sectionPath, { page: '4' }, origin), { status: 404 });
});

test('newest sorting uses publication or creation dates and does not reorder on later text edits', () => {
  const f = fixture();
  f.records.push(
    instruction('old', { title: 'Альфа', publishedAt: '2020-01-01', updatedAt: '2099-01-01' }),
    instruction('new', { title: 'Бета', publishedAt: '2026-01-01', updatedAt: '2020-01-01' }),
  );
  const page = f.service.snapshot().resolve(sectionPath, { sort: 'newest' }, origin).page;
  assert.deepEqual(
    page.items.map(item => item.id),
    ['new', 'old'],
  );
  assert.equal(page.seo.robots, 'noindex, follow');
});

test('ten thousand documents retain bounded pagination with first, current and last page links', () => {
  const f = fixture();
  for (let index = 1; index <= 10000; index += 1)
    f.records.push(instruction(`large-${String(index).padStart(5, '0')}`));
  const page = f.service.snapshot().resolve(sectionPath, { page: '200' }, origin).page;
  assert.equal(page.total, 10000);
  assert.equal(page.items.length, 24);
  assert.equal(page.totalPages, 417);
  assert.deepEqual(
    page.pagination.map(item => item.page),
    [1, 198, 199, 200, 201, 202, 417],
  );
  assert.ok(page.pagination.length <= 7);
  assert.ok(
    page.pagination.every(
      item => item.path === (item.page === 1 ? sectionPath : `${sectionPath}?page=${item.page}`),
    ),
  );
  assert.equal(page.previousPath, `${sectionPath}?page=199`);
  assert.equal(page.nextPath, `${sectionPath}?page=201`);
});

test('query aliases redirect to clean first-page URLs and scalar technical parameters remain noindex', () => {
  const f = fixture();
  f.records.push(instruction('one'));
  const snapshot = f.service.snapshot();
  assert.deepEqual(snapshot.resolve(sectionPath, { q: ' ', sort: 'title', page: '01' }, origin), {
    status: 301,
    location: sectionPath,
  });
  assert.deepEqual(snapshot.resolve(sectionPath, { q: ' Инструкция ' }, origin), {
    status: 301,
    location: `${sectionPath}?q=${encodeURIComponent('Инструкция')}`,
  });
  const page = snapshot.resolve(sectionPath, { utm_source: 'test' }, origin).page;
  assert.equal(page.seo.indexable, false);
  assert.equal(page.seo.canonicalUrl, `${origin}${sectionPath}`);
  for (const query of [
    { page: '0' },
    { page: '-1' },
    { page: 'abc' },
    { page: ['2'] },
    { q: {} },
    { sort: 'popular' },
    { extra: 1 },
    { path: '/another' },
  ])
    assert.throws(() => snapshot.resolve(sectionPath, query, origin), {
      code: 'INVALID_TAXONOMY_PUBLIC_QUERY',
      status: 400,
    });
});

test('known case, missing-slash and historical URLs redirect directly to the current published path', () => {
  const f = fixture();
  f.records.push(instruction('one'));
  f.entity('W01').slug = 'novye-raboty';
  f.state.redirects.push({ fromPath: sectionPath, kind: 'section', code: 'W01' });
  const current = `${catalogPath}novye-raboty/`;
  const snapshot = f.service.snapshot();
  assert.deepEqual(
    snapshot.resolve(sectionPath.toUpperCase().slice(0, -1), { q: 'Инструкция' }, origin),
    { status: 301, location: `${current}?q=${encodeURIComponent('Инструкция')}` },
  );
  assert.deepEqual(snapshot.resolve(current.slice(0, -1), {}, origin), {
    status: 301,
    location: current,
  });
  for (const pathname of [
    `${catalogPath}%2fnovye-raboty/`,
    `${catalogPath}%2e%2e/novye-raboty/`,
    `${current}?q=bad`,
    `${catalogPath}unknown/`,
    rootPath,
    `${rootPath}/`,
  ])
    assert.deepEqual(snapshot.resolve(pathname, {}, origin), { status: 404 });
  f.entity('W01').status = 'draft';
  assert.deepEqual(f.service.snapshot().resolve(sectionPath, {}, origin), { status: 404 });
});

test('dynamic empty pages and custom canonical targets are noindex and absent from sitemap', () => {
  const f = fixture();
  let snapshot = f.service.snapshot();
  assert.equal(snapshot.resolve(sectionPath, {}, origin).page.seo.indexable, false);
  assert.deepEqual(snapshot.sitemap(origin), [{ path: rootPath, loc: `${origin}${rootPath}` }]);
  f.records.push(instruction('one'));
  snapshot = f.service.snapshot();
  assert.deepEqual(
    snapshot.sitemap(origin).map(item => item.path),
    [rootPath, catalogPath, sectionPath, tagPath],
  );
  assert.ok(snapshot.sitemap(origin).every(item => Object.keys(item).join(',') === 'path,loc'));
  f.entity('W01').canonicalUrl = 'https://example.com/approved-canonical/';
  snapshot = f.service.snapshot();
  const page = snapshot.resolve(sectionPath, {}, origin).page;
  assert.equal(page.seo.canonicalUrl, 'https://example.com/approved-canonical/');
  assert.equal(page.siteUrl, origin);
  assert.equal(page.seo.indexable, false);
  assert.ok(!snapshot.sitemap(origin).some(item => item.path === sectionPath));
  f.records[0].primaryCategoryId = 'W02';
  f.records[0].tagIds = [];
  assert.equal(
    f.service.snapshot().resolve(tagPath, {}, origin).page.seo.robots,
    'noindex, follow',
  );
});

test('the published root is an independent editable overlay without gating descendant pages', () => {
  const f = fixture();
  f.records.push(instruction('one'));
  Object.assign(f.state.root, {
    status: 'published',
    name: 'Общее имя',
    h1: 'Главный H1',
    seoTitle: '',
    seoDescription: '',
    indexingEnabled: false,
    introContent: content('Root intro'),
  });
  const snapshot = f.service.snapshot();
  const nav = snapshot.navigation(origin);
  assert.equal(nav.root.siteUrl, origin);
  assert.equal(nav.root.h1, 'Главный H1');
  assert.equal(nav.root.seo.title, 'Главный H1');
  assert.equal(nav.root.seo.description, '');
  assert.deepEqual(nav.root.introContent, content('Root intro'));
  assert.equal(nav.root.seo.indexable, false);
  assert.ok(!snapshot.sitemap(origin).some(item => item.path === rootPath));
  assert.equal(snapshot.resolve(sectionPath, {}, origin).status, 200);
  assert.equal(snapshot.resolve(sectionPath, {}, origin).page.breadcrumbs[1].name, 'Общее имя');
});

test('legacy missing titles are omitted while malformed published references fail closed', () => {
  const f = fixture();
  f.records.push(
    instruction('untitled', { title: undefined }),
    instruction('empty', { title: '' }),
    instruction('one'),
  );
  assert.equal(f.service.snapshot().resolve(sectionPath, {}, origin).page.total, 1);
  for (const malformed of [
    instruction('bad', { title: {} }),
    instruction('bad', { slug: [] }),
    instruction('bad', { tagIds: [123] }),
  ]) {
    f.records.push(malformed);
    assert.throws(() => f.service.snapshot());
    f.records.pop();
  }
  f.records.push(instruction('one'));
  assert.throws(() => f.service.snapshot());
});

test('real repository snapshots are read-only, refresh stale cache, and reject corrupt files', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-public-taxonomy-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repo = new InstructionsRepository(path.join(directory, 'instructions'));
  const f = fixture();
  const registryFile = path.join(directory, 'taxonomy.json');
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: registryFile,
    seed: f.state,
  });
  const service = createInstructionTaxonomyPublicService({ repository: repo, taxonomyRepository });
  const file = path.join(repo.dir, 'late.json');
  const bytes = Buffer.from(JSON.stringify(instruction('late')));
  fs.writeFileSync(file, bytes);
  assert.equal(repo.getAll().length, 0);
  assert.equal(service.snapshot().resolve(sectionPath, {}, origin).page.total, 1);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(fs.existsSync(registryFile), false);
  assert.equal(fs.existsSync(taxonomyRepository.operationsDirectory), false);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => service.snapshot(), { code: 'INSTRUCTION_STORAGE_ERROR', status: 500 });
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

test('origin normalization rejects unsafe configuration and supports explicit test origins', () => {
  assert.equal(normalizeInstructionTaxonomyPublicOrigin('https://boykovdocs.ru/'), origin);
  assert.equal(
    normalizeInstructionTaxonomyPublicOrigin('http://localhost:4173'),
    'http://localhost:4173',
  );
  for (const value of [
    'javascript:alert(1)',
    'https://user:password@example.com',
    'https://example.com/path',
    'https://example.com/?q=1',
    'https://example.com/#fragment',
    ' https://example.com',
    'https://example.com\u0000',
  ])
    assert.throws(() => normalizeInstructionTaxonomyPublicOrigin(value), {
      code: 'TAXONOMY_PUBLIC_ORIGIN_ERROR',
      status: 500,
    });
});
