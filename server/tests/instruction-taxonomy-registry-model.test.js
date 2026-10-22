import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInstructionTaxonomyEntityPath,
  listInstructionTaxonomyEntities,
  normalizeInstructionTaxonomyEntity,
  validateInstructionTaxonomyRegistry,
} from '../src/services/instructionTaxonomyRegistryModel.js';

const entity = (kind, input) => normalizeInstructionTaxonomyEntity(kind, input);
const root = () =>
  entity('root', {
    code: 'ROOT',
    name: 'Инструкции по охране труда',
    slug: 'instrukcii-po-ohrane-truda',
  });
const catalog = (overrides = {}) =>
  entity('catalog', {
    code: 'H01',
    name: 'По профессиям и должностям',
    slug: 'po-professiyam',
    routeApproved: true,
    ...overrides,
  });
const section = (overrides = {}) =>
  entity('section', {
    code: 'P01',
    name: 'Руководители',
    slug: 'rukovoditeli',
    parentCode: 'H01',
    ...overrides,
  });
const tag = (overrides = {}) =>
  entity('tag', { code: 'T01', name: 'Аппаратчики', slug: 'apparatchiki', ...overrides });
const state = () => ({
  schemaVersion: 1,
  revision: 0,
  root: root(),
  catalogs: [catalog(), catalog({ code: 'H02', name: 'По видам работ', slug: 'po-vidam-rabot' })],
  sections: [section(), section({ code: 'W01', parentCode: 'H02' })],
  tags: [tag()],
  redirects: [],
  sourceIssues: [],
});
const invalid = callback =>
  assert.throws(
    callback,
    error => error.status === 400 && error.code === 'INVALID_TAXONOMY_REGISTRY',
  );

test('entity defaults keep draft, indexing and independent SEO fields without generated copy', () => {
  const initial = section();
  assert.equal(initial.status, 'draft');
  assert.equal(initial.indexingEnabled, false);
  assert.equal(initial.h1, '');
  assert.equal(initial.seoTitle, '');
  assert.equal(initial.seoDescription, '');
  assert.equal(initial.canonicalUrl, '');
  const edited = entity('section', {
    ...initial,
    name: 'Новое название',
    h1: 'Другой заголовок',
    seoTitle: 'Отдельный Title',
    seoDescription: 'Собственное описание',
  });
  const renamed = entity('section', { ...edited, name: 'Ещё одно название' });
  assert.equal(renamed.h1, edited.h1);
  assert.equal(renamed.seoTitle, edited.seoTitle);
  assert.equal(renamed.seoDescription, edited.seoDescription);
  assert.equal(renamed.code, initial.code);
  assert.equal(renamed.parentCode, 'H01');
});

test('rich introductory and SEO content reuse the existing safe rich-text boundary', () => {
  const document = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Подборка' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Ссылка',
            marks: [{ type: 'link', attrs: { href: '/instrukcii-po-ohrane-truda' } }],
          },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Первый пункт' }] }],
          },
        ],
      },
    ],
  };
  const result = section({ introContent: document, seoContent: document });
  assert.deepEqual(result.introContent, document);
  assert.deepEqual(result.seoContent, document);
  assert.notEqual(result.introContent, document);
  const unsafe = structuredClone(document);
  unsafe.content[1].content[0].marks[0].attrs.href = 'javascript:alert(1)';
  invalid(() => section({ seoContent: unsafe }));
});

test('entity input rejects unknown fields, invalid types and unsupported identifiers', () => {
  for (const patch of [
    { code: 'p01' },
    { code: '' },
    { slug: 'Uppercase' },
    { slug: 'double--hyphen' },
    { indexingEnabled: null },
    { indexingEnabled: 1 },
    { sortOrder: -1 },
    { sortOrder: 0.1 },
    { status: null },
    { status: 'archived' },
    { kind: 'tag' },
    { h1: null },
    { extra: 'untrusted' },
    { routeApproved: true },
  ])
    invalid(() => section(patch));
  invalid(() => entity('unknown', {}));
  invalid(() => catalog({ slug: 'temy' }));
  invalid(() => catalog({ routeApproved: null }));
});

test('the existing root URL and structural parent rules are fixed', () => {
  invalid(() => entity('root', { ...root(), code: 'OTHER' }));
  invalid(() => entity('root', { ...root(), slug: 'another-catalog' }));
  invalid(() => entity('root', { ...root(), parentCode: 'H01' }));
  invalid(() => catalog({ parentCode: 'H02' }));
  invalid(() => section({ parentCode: null }));
  invalid(() => section({ parentCode: ['H01'] }));
  invalid(() => section({ parentCode: 1 }));
  invalid(() => section({ parentCode: 'ROOT' }));
  invalid(() => tag({ parentCode: 'H01' }));
});

test('canonical accepts an independent absolute HTTP URL and rejects technical duplicates', () => {
  assert.equal(tag({ canonicalUrl: '' }).canonicalUrl, '');
  const expected = 'https://boykovdocs.ru/instrukcii-po-ohrane-truda/temy/apparatchiki/';
  assert.equal(tag({ canonicalUrl: expected }).canonicalUrl, expected);
  for (const canonicalUrl of [
    '/relative/',
    'javascript:alert(1)',
    'https://user:pass@example.com/',
    'https://example.com/?sort=alpha',
    'https://example.com/#part',
    'https://example.com/?',
    'https://example.com/#',
    'https://exam\nple.com/',
    'https://example.com/nul\u0000',
  ]) {
    invalid(() => tag({ canonicalUrl }));
  }
});

test('normalization clones provenance and rejects non-JSON or cyclic source evidence', () => {
  const source = { file: 'source.xlsx', row: 10, alternatives: ['/first/', '/second/'] };
  const before = structuredClone(source);
  const result = tag({ source });
  result.source.alternatives.push('/third/');
  assert.deepEqual(source, before);
  invalid(() => tag({ source: { callback() {} } }));
  invalid(() => tag({ source: { time: new Date() } }));
  const cyclic = {};
  cyclic.self = cyclic;
  invalid(() => tag({ source: cyclic }));
});

test('registry rejects corrupt structure instead of silently normalizing stored state', () => {
  for (const patch of [
    { schemaVersion: 2 },
    { revision: -1 },
    { revision: 0.5 },
    { tags: {} },
    { catalogs: null },
    { sourceIssues: [null] },
    { unexpected: true },
  ])
    invalid(() => validateInstructionTaxonomyRegistry({ ...state(), ...patch }));
  const missing = state();
  delete missing.root;
  invalid(() => validateInstructionTaxonomyRegistry(missing));
  const incomplete = state();
  delete incomplete.tags[0].h1;
  invalid(() => validateInstructionTaxonomyRegistry(incomplete));
  const untrimmed = state();
  untrimmed.tags[0].name = ' Untrimmed ';
  invalid(() => validateInstructionTaxonomyRegistry(untrimmed));
});

test('codes are globally unique and every section has one existing catalog parent', () => {
  const duplicate = state();
  duplicate.tags.push(tag({ code: 'P01', slug: 'other-tag' }));
  invalid(() => validateInstructionTaxonomyRegistry(duplicate));
  const orphan = state();
  orphan.sections.push(section({ code: 'P99', slug: 'orphan', parentCode: 'H99' }));
  invalid(() => validateInstructionTaxonomyRegistry(orphan));
  assert.equal(validateInstructionTaxonomyRegistry(state()), true);
});

test('URL uniqueness respects catalog, section-parent and tag namespaces', () => {
  const allowed = state();
  assert.equal(allowed.sections[0].slug, allowed.sections[1].slug);
  assert.equal(validateInstructionTaxonomyRegistry(allowed), true);
  for (const collection of ['catalogs', 'sections', 'tags']) {
    const duplicate = state();
    duplicate[collection].push({ ...duplicate[collection][0], code: 'NEW_CODE' });
    invalid(() => validateInstructionTaxonomyRegistry(duplicate));
  }
});

test('pending profession-route approval blocks publication of the catalog and its sections', () => {
  const pending = state();
  pending.catalogs[0].routeApproved = false;
  assert.equal(validateInstructionTaxonomyRegistry(pending), true);
  pending.sections[0].status = 'published';
  invalid(() => validateInstructionTaxonomyRegistry(pending));
  pending.sections[0].status = 'draft';
  pending.catalogs[0].status = 'published';
  invalid(() => validateInstructionTaxonomyRegistry(pending));
  pending.catalogs[0].routeApproved = true;
  pending.sections[0].status = 'published';
  assert.equal(validateInstructionTaxonomyRegistry(pending), true);
});

test('publication and indexing remain separate and registry size is extensible', () => {
  const current = state();
  current.tags[0].indexingEnabled = true;
  assert.equal(current.tags[0].status, 'draft');
  current.tags.push(
    ...Array.from({ length: 80 }, (_, index) =>
      tag({ code: `NEW_${index}`, slug: `new-${index}` }),
    ),
  );
  current.catalogs.push(catalog({ code: 'H03', slug: 'new-catalog' }));
  current.sections.push(section({ code: 'P99', parentCode: 'H03', slug: 'new-section' }));
  assert.equal(validateInstructionTaxonomyRegistry(current), true);
});

test('paths and flat entity listings are pure and preserve the existing root slash policy', () => {
  const current = state();
  const before = structuredClone(current);
  assert.equal(
    getInstructionTaxonomyEntityPath(current, 'root', 'ROOT'),
    '/instrukcii-po-ohrane-truda',
  );
  assert.equal(
    getInstructionTaxonomyEntityPath(current, 'catalog', 'H01'),
    '/instrukcii-po-ohrane-truda/po-professiyam/',
  );
  assert.equal(
    getInstructionTaxonomyEntityPath(current, 'section', 'P01'),
    '/instrukcii-po-ohrane-truda/po-professiyam/rukovoditeli/',
  );
  assert.equal(
    getInstructionTaxonomyEntityPath(current, 'tag', 'T01'),
    '/instrukcii-po-ohrane-truda/temy/apparatchiki/',
  );
  assert.equal(getInstructionTaxonomyEntityPath(current, 'tag', 'UNKNOWN'), null);
  assert.equal(listInstructionTaxonomyEntities(current).length, 6);
  assert.deepEqual(current, before);
});

test('redirects resolve a stable entity code directly after repeated URL changes', () => {
  const current = state();
  current.tags[0].slug = 'current';
  current.redirects = [
    { fromPath: '/instrukcii-po-ohrane-truda/temy/first/', kind: 'tag', code: 'T01' },
    { fromPath: '/instrukcii-po-ohrane-truda/temy/second/', kind: 'tag', code: 'T01' },
  ];
  assert.equal(validateInstructionTaxonomyRegistry(current), true);
  current.tags[0].slug = 'third';
  assert.equal(validateInstructionTaxonomyRegistry(current), true);
  assert.equal(
    getInstructionTaxonomyEntityPath(current, current.redirects[0].kind, current.redirects[0].code),
    '/instrukcii-po-ohrane-truda/temy/third/',
  );
});

test('redirects reject self-links, collisions, missing targets and noncanonical source paths', () => {
  const valid = { fromPath: '/instrukcii-po-ohrane-truda/temy/old/', kind: 'tag', code: 'T01' };
  for (const patch of [
    { fromPath: '/instrukcii-po-ohrane-truda/temy/apparatchiki/' },
    { fromPath: '/instrukcii-po-ohrane-truda/po-professiyam/' },
    { fromPath: 'https://example.com/old/' },
    { fromPath: '//example.com/old/' },
    { fromPath: '/instrukcii-po-ohrane-truda/temy/old' },
    { fromPath: '/instrukcii-po-ohrane-truda/temy/OLD/' },
    { fromPath: '/instrukcii-po-ohrane-truda/temy/%6fld/' },
    { fromPath: '/instrukcii-po-ohrane-truda/temy/old/?page=2' },
    { code: 'UNKNOWN' },
    { toPath: '/redirect-chain/' },
  ]) {
    const current = state();
    current.redirects = [{ ...valid, ...patch }];
    invalid(() => validateInstructionTaxonomyRegistry(current));
  }
  const duplicate = state();
  duplicate.redirects = [valid, { ...valid }];
  invalid(() => validateInstructionTaxonomyRegistry(duplicate));
});
