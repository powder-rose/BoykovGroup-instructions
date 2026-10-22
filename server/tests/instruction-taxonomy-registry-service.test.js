import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { getLegacyInstructionTaxonomyCatalog } from '../src/services/instructionTaxonomySource.js';

function fixture(t, instructions = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-service-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'runtime', 'taxonomy.json');
  const repository = createInstructionTaxonomyRegistryRepository({ filePath });
  const service = createInstructionTaxonomyRegistryService({
    repository,
    getInstructions: () => instructions,
  });
  const update = (kind, code, patch) =>
    service.update(kind, code, patch, {
      expectedRevision: repository.read().revision,
    });
  return { directory, filePath, repository, service, update, instructions };
}

const richText = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Полезные сведения' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Раздел', marks: [{ type: 'link', attrs: { href: '/catalog/' } }] },
      ],
    },
  ],
};

test('service reads the full draft registry and unchanged legacy definitions without creating storage', t => {
  const f = fixture(t);
  const state = f.service.read();
  assert.equal(state.revision, 0);
  assert.equal(state.catalogs.length, 2);
  assert.equal(state.sections.length, 52);
  assert.equal(state.tags.length, 79);
  assert.deepEqual(state.legacyCatalog, getLegacyInstructionTaxonomyCatalog());
  assert.equal(state.legacyCatalog.categories.length, 10);
  assert.equal(state.legacyCatalog.tags.length, 371);
  assert.equal(fs.existsSync(path.dirname(f.filePath)), false);
  state.sections[0].name = 'Caller mutation';
  assert.notEqual(f.service.get('section', 'P01').name, 'Caller mutation');
});

test('name, H1, SEO, canonical and rich content are independent and persist through a new service', t => {
  const f = fixture(t);
  f.update('section', 'W01', {
    h1: 'Самостоятельный H1',
    seoTitle: 'Самостоятельный Title',
    seoDescription: 'Самостоятельное описание',
    canonicalUrl:
      'https://boykovdocs.ru/instrukcii-po-ohrane-truda/po-vidam-rabot/raboty-na-vysote/',
    introContent: richText,
    seoContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'SEO' }] }],
    },
    sortOrder: 12,
  });
  const previous = f.service.get('section', 'W01');
  f.update('section', 'W01', { name: 'Новое название' });
  const next = f.service.get('section', 'W01');
  assert.deepEqual(next, { ...previous, name: 'Новое название' });
  const restarted = createInstructionTaxonomyRegistryService({
    repository: createInstructionTaxonomyRegistryRepository({ filePath: f.filePath }),
    getInstructions: () => [],
  });
  assert.deepEqual(restarted.get('section', 'W01'), next);
  assert.deepEqual(next.introContent, richText);
});

test('stale revisions and attempts to edit stable codes or source provenance leave storage unchanged', t => {
  const f = fixture(t);
  f.update('tag', 'T01', { name: 'Новое имя темы' });
  const bytes = fs.readFileSync(f.filePath);
  assert.throws(() => f.service.update('tag', 'T01', { h1: 'Stale' }, { expectedRevision: 0 }), {
    code: 'TAXONOMY_REVISION_CONFLICT',
  });
  for (const patch of [
    { code: 'T99' },
    { kind: 'section' },
    { source: {} },
    { routeApproved: true },
  ]) {
    assert.throws(() => f.update('tag', 'T01', patch));
    assert.deepEqual(fs.readFileSync(f.filePath), bytes);
  }
});

test('unresolved profession routes block publication until the route is explicitly confirmed', t => {
  const f = fixture(t);
  assert.equal(f.service.get('catalog', 'H01').routeApproved, false);
  for (const [kind, code] of [
    ['catalog', 'H01'],
    ['section', 'P01'],
  ]) {
    assert.throws(() => f.update(kind, code, { status: 'published' }), /approval/iu);
  }
  assert.equal(fs.existsSync(f.filePath), false);
  f.service.confirmCatalogRoute('H01', 'po-professiyam', { expectedRevision: 0 });
  f.update('catalog', 'H01', { status: 'published' });
  f.update('section', 'P01', { status: 'published' });
  assert.equal(f.service.get('catalog', 'H01').slug, 'po-professiyam');
  assert.equal(f.service.get('section', 'P01').status, 'published');
});

test('empty indexable publication is rejected and published noindex remains available', t => {
  const f = fixture(t);
  assert.throws(() => f.update('section', 'W01', { status: 'published', indexingEnabled: true }), {
    code: 'TAXONOMY_EMPTY_PAGE',
  });
  assert.equal(fs.existsSync(f.filePath), false);
  f.update('section', 'W01', { status: 'published', indexingEnabled: false });
  f.instructions.push({ id: 'draft-instruction', status: 'draft', primaryCategoryId: 'W01' });
  assert.throws(() => f.update('section', 'W01', { indexingEnabled: true }), {
    code: 'TAXONOMY_EMPTY_PAGE',
  });
  f.instructions.push({ id: 'published-instruction', primaryCategoryId: 'W01' });
  f.update('section', 'W01', { indexingEnabled: true });
  assert.deepEqual(f.service.getUsage('section', 'W01'), {
    references: 2,
    publishedInstructions: 1,
  });
  assert.deepEqual(f.service.getUsage('catalog', 'H02'), {
    references: 2,
    publishedInstructions: 1,
  });
});

test('removing a section or tag with published or draft references preserves the documents and registry', t => {
  const records = [
    {
      id: 'live',
      primaryCategoryId: 'W01',
      tagIds: ['T01'],
      title: 'Actual title',
      content: 'Actual text',
    },
    { id: 'draft', status: 'draft', primaryCategoryId: 'P01', tagIds: ['T02'] },
  ];
  const snapshot = structuredClone(records);
  const f = fixture(t, records);
  for (const [kind, code] of [
    ['section', 'W01'],
    ['section', 'P01'],
    ['tag', 'T01'],
    ['tag', 'T02'],
  ]) {
    assert.throws(
      () => f.service.remove(kind, code, { expectedRevision: 0 }),
      error => error.code === 'TAXONOMY_ENTITY_IN_USE' && error.details.references === 1,
    );
  }
  assert.throws(
    () => f.service.remove('catalog', 'H01', { expectedRevision: 0 }),
    error => error.code === 'TAXONOMY_ENTITY_IN_USE' && error.details.sections.length === 24,
  );
  assert.throws(() => f.service.remove('root', 'ROOT', { expectedRevision: 0 }));
  assert.deepEqual(records, snapshot);
  assert.equal(fs.existsSync(f.filePath), false);
});

test('new sections and tags extend the supplied counts and can be removed when unreferenced', t => {
  const f = fixture(t);
  f.service.create(
    'section',
    { code: 'W99', name: 'Новый раздел', slug: 'novyj-razdel', parentCode: 'H02' },
    { expectedRevision: 0 },
  );
  assert.equal(f.service.read().sections.length, 53);
  const section = f.service.get('section', 'W99');
  assert.equal(section.status, 'draft');
  assert.equal(section.indexingEnabled, false);
  f.service.create(
    'tag',
    { code: 'T99', name: 'Новая тема', slug: 'novaya-tema' },
    { expectedRevision: 1 },
  );
  assert.equal(f.service.read().tags.length, 80);
  assert.throws(
    () =>
      f.service.create(
        'tag',
        { code: 'W99', name: 'Duplicate', slug: 'duplicate' },
        { expectedRevision: 2 },
      ),
    { code: 'TAXONOMY_CODE_CONFLICT' },
  );
  f.service.remove('section', 'W99', { expectedRevision: 2 });
  f.service.remove('tag', 'T99', { expectedRevision: 3 });
  assert.equal(f.service.read().sections.length, 52);
  assert.equal(f.service.read().tags.length, 79);
});

test('published URL changes retain direct entity redirects through parent renames and return to the original slug', t => {
  const f = fixture(t);
  f.update('catalog', 'H02', { status: 'published' });
  f.update('section', 'W01', { status: 'published' });
  const originalCatalogSlug = f.service.get('catalog', 'H02').slug;
  const originalSectionSlug = f.service.get('section', 'W01').slug;
  const originalPath = `/instrukcii-po-ohrane-truda/${originalCatalogSlug}/${originalSectionSlug}/`;
  f.update('section', 'W01', { slug: 'novaya-vysota' });
  f.update('catalog', 'H02', { slug: 'novye-raboty' });
  let state = f.service.read();
  assert.deepEqual(
    state.redirects.find(item => item.fromPath === originalPath),
    { fromPath: originalPath, kind: 'section', code: 'W01' },
  );
  assert.ok(
    state.redirects.some(
      item => item.fromPath === `/instrukcii-po-ohrane-truda/${originalCatalogSlug}/novaya-vysota/`,
    ),
  );
  f.update('section', 'W01', { slug: originalSectionSlug });
  f.update('catalog', 'H02', { slug: originalCatalogSlug });
  state = f.service.read();
  assert.equal(
    state.redirects.some(item => item.fromPath === originalPath),
    false,
  );
  assert.ok(
    state.redirects.some(
      item => item.fromPath === '/instrukcii-po-ohrane-truda/novye-raboty/novaya-vysota/',
    ),
  );
  assert.ok(state.redirects.every(item => !Object.hasOwn(item, 'toPath')));
});

test('a historical URL cannot be claimed by another entity', t => {
  const f = fixture(t);
  const oldSlug = f.service.get('tag', 'T01').slug;
  f.update('tag', 'T01', { status: 'published' });
  f.update('tag', 'T01', { slug: 'new-topic-slug' });
  const before = fs.readFileSync(f.filePath);
  assert.throws(() => f.update('tag', 'T02', { slug: oldSlug }));
  assert.deepEqual(fs.readFileSync(f.filePath), before);
});

test('legacy IDs are preserved and distinct source gas-cylinder and pressure-vessel tags are never inferred', t => {
  const f = fixture(t);
  const oldInstruction = {
    id: 'legacy',
    primaryCategoryId: 'manufacturing',
    tagIds: ['sosudy-pod-davleniem'],
  };
  const before = structuredClone(oldInstruction);
  const result = f.service.inspectInstruction(oldInstruction);
  assert.equal(result.catalog, null);
  assert.equal(result.section, null);
  assert.equal(result.legacyCategory.id, 'manufacturing');
  assert.deepEqual(
    result.tags.map(tag => tag.id),
    ['sosudy-pod-davleniem'],
  );
  assert.deepEqual(oldInstruction, before);
  assert.notEqual(f.service.get('tag', 'T47').name, f.service.get('tag', 'T48').name);
  const newInstruction = {
    primaryCategoryId: 'W16',
    tagIds: ['T47', 'T48', 'sosudy-pod-davleniem'],
  };
  const coded = f.service.inspectInstruction(newInstruction);
  assert.equal(coded.catalog.code, 'H02');
  assert.equal(coded.section.code, 'W16');
  assert.equal(coded.tags.length, 3);
});

test('assignment validation derives the catalog and preserves more than five explicit legacy and coded tags', t => {
  const f = fixture(t);
  const input = {
    primaryCategoryId: 'P02',
    tagIds: ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'apparatchik'],
  };
  const before = structuredClone(input);
  assert.deepEqual(f.service.validateAssignment(input, { requireSection: true }), {
    ...input,
    catalogCode: 'H01',
  });
  assert.deepEqual(input, before);
  assert.deepEqual(
    f.service.validateAssignment({ primaryCategoryId: 'manufacturing', tagIds: [] }),
    { primaryCategoryId: 'manufacturing', tagIds: [], catalogCode: null },
  );
  for (const selection of [
    { primaryCategoryId: 'P02', catalogCode: 'H02', tagIds: [] },
    { primaryCategoryId: 'P02', tagIds: ['T01', 'T01'] },
    { primaryCategoryId: 'P99', tagIds: [] },
    { primaryCategoryId: 'P02', tagIds: ['unknown'] },
  ])
    assert.throws(() => f.service.validateAssignment(selection, { requireSection: true }));
  assert.throws(() =>
    f.service.validateAssignment({ primaryCategoryId: 'manufacturing' }, { requireSection: true }),
  );
  assert.equal(fs.existsSync(f.filePath), false);
});

test('malformed instruction providers block deletion and indexed publication without changing stored state', t => {
  const f = fixture(t);
  f.update('section', 'W01', { name: 'Saved section' });
  const bytes = fs.readFileSync(f.filePath);
  const before = f.repository.read();
  let supplied = [];
  const service = createInstructionTaxonomyRegistryService({
    repository: f.repository,
    getInstructions: () => supplied,
  });
  const invalidProviders = [
    null,
    {},
    'not-an-array',
    [null],
    [[]],
    [{}],
    [{ id: '' }],
    [{ id: 'invalid-tags', tagIds: 'T01' }],
    [{ id: 'invalid-tag-type', tagIds: [23] }],
    [{ id: 'invalid-category', primaryCategoryId: ['W01'] }],
  ];
  for (const provider of invalidProviders) {
    supplied = provider;
    assert.throws(() => service.getUsage('section', 'W01'), TypeError);
    assert.throws(() => service.remove('section', 'W01', { expectedRevision: before.revision }));
    assert.throws(() =>
      service.update(
        'section',
        'W01',
        {
          status: 'published',
          indexingEnabled: true,
        },
        { expectedRevision: before.revision },
      ),
    );
    assert.deepEqual(fs.readFileSync(f.filePath), bytes);
    assert.deepEqual(f.repository.read(), before);
  }
});

test('unknown entity kinds produce explicit domain errors instead of resolving inherited properties', t => {
  const f = fixture(t);
  const before = f.repository.read();
  for (const kind of ['constructor', '__proto__', 'toString']) {
    assert.throws(() => f.service.get(kind, 'W01'), {
      code: 'TAXONOMY_ENTITY_NOT_FOUND',
      status: 404,
    });
    assert.throws(
      () => f.service.update(kind, 'W01', { name: 'Invalid' }, { expectedRevision: 0 }),
      {
        code: 'TAXONOMY_ENTITY_NOT_FOUND',
        status: 404,
      },
    );
    for (const action of [
      () =>
        f.service.create(
          kind,
          { code: 'X01', name: 'Invalid', slug: 'invalid' },
          { expectedRevision: 0 },
        ),
      () => f.service.remove(kind, 'W01', { expectedRevision: 0 }),
    ]) {
      assert.throws(
        action,
        error =>
          !(error instanceof TypeError) && error.code === 'INVALID_INSTRUCTION_TAXONOMY_REGISTRY',
      );
    }
  }
  assert.deepEqual(f.repository.read(), before);
  assert.equal(fs.existsSync(f.filePath), false);
});

test('published and draft versions count once per document and retain references to both assigned sections', t => {
  const records = [
    { id: 'same-document', status: 'published', primaryCategoryId: 'W01', tagIds: ['T01'] },
    { id: 'same-document', status: 'draft', primaryCategoryId: 'W01', tagIds: ['T01'] },
  ];
  const f = fixture(t, records);
  assert.deepEqual(f.service.getUsage('section', 'W01'), {
    references: 1,
    publishedInstructions: 1,
  });
  assert.deepEqual(f.service.getUsage('tag', 'T01'), {
    references: 1,
    publishedInstructions: 1,
  });
  records[1].primaryCategoryId = 'W02';
  assert.deepEqual(f.service.getUsage('catalog', 'H02'), {
    references: 1,
    publishedInstructions: 1,
  });
  assert.deepEqual(f.service.getUsage('section', 'W01'), {
    references: 1,
    publishedInstructions: 1,
  });
  assert.deepEqual(f.service.getUsage('section', 'W02'), {
    references: 1,
    publishedInstructions: 0,
  });
  for (const code of ['W01', 'W02']) {
    assert.throws(
      () => f.service.remove('section', code, { expectedRevision: 0 }),
      error => error.code === 'TAXONOMY_ENTITY_IN_USE' && error.details.references === 1,
    );
  }
  assert.equal(fs.existsSync(f.filePath), false);
});
