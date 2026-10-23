import assert from 'node:assert/strict';
import test from 'node:test';

import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';

const origin = 'https://boykovdocs.ru';
const rootPath = '/instrukcii-po-ohrane-truda';
const catalogPath = `${rootPath}/po-vidam-rabot/`;
const sectionPath = `${catalogPath}raboty-na-vysote/`;
const tagPath = `${rootPath}/temy/gazovye-ballony/`;
const content = text => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function instruction(id, overrides = {}) {
  return {
    id,
    slug: `document-${id}-MiXeD`,
    title: `Инструкция ${id}`,
    primaryCategoryId: 'W01',
    tagIds: ['T47'],
    status: 'published',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function fixture() {
  const state = getInstructionTaxonomyRegistrySeed();
  const records = [];
  const entity = code =>
    [state.root, ...state.catalogs, ...state.sections, ...state.tags].find(
      item => item.code === code,
    );
  const publish = code =>
    Object.assign(entity(code), { status: 'published', indexingEnabled: true });
  const service = createInstructionTaxonomyPublicService({
    repository: { getAll: () => records },
    taxonomyRepository: { read: () => state },
  });
  return { state, records, entity, publish, service };
}

test('instruction links use the complete published hierarchy and independent section/topic paths', () => {
  const f = fixture();
  for (const code of ['ROOT', 'H02', 'W01', 'T47', 'T48']) f.publish(code);
  f.entity('ROOT').name = 'Общий каталог';
  const record = instruction('current', { tagIds: ['T47', 'T48', 'T47'] });
  f.records.push(record);
  const before = structuredClone(record);
  const navigation = f.service.snapshot().instructionNavigation(record);
  assert.deepEqual(navigation.breadcrumbs, [
    { name: 'Главная', path: '/' },
    { name: 'Общий каталог', path: rootPath },
    { name: 'По видам работ', path: catalogPath },
    { name: 'Работы на высоте', path: sectionPath },
    { name: record.title, path: null },
  ]);
  assert.deepEqual(navigation.category, {
    id: 'W01',
    label: 'Работы на высоте',
    path: sectionPath,
  });
  assert.deepEqual(
    navigation.tags.map(tag => tag.id),
    ['T47', 'T48'],
  );
  assert.equal(navigation.tags[0].path, tagPath);
  assert.notEqual(navigation.tags[1].path, tagPath);
  assert.deepEqual(record, before);
});

test('draft and unapproved hierarchy has no public paths while legacy labels retain their identity', () => {
  const f = fixture();
  f.publish('H02');
  f.publish('T47');
  let snapshot = f.service.snapshot();
  const draftChild = snapshot.instructionNavigation(instruction('draft-child'));
  assert.equal(draftChild.category.path, null);
  assert.deepEqual(
    draftChild.breadcrumbs.map(item => item.path),
    ['/', rootPath, catalogPath, null],
  );
  const profession = snapshot.instructionNavigation(
    instruction('profession', { primaryCategoryId: 'P01' }),
  );
  assert.equal(profession.category.id, 'P01');
  assert.equal(profession.category.path, null);
  assert.equal(profession.breadcrumbs.length, 3);
  assert.equal(JSON.stringify(profession).includes('po-professiyam'), false);
  f.entity('H02').status = 'draft';
  snapshot = f.service.snapshot();
  assert.equal(snapshot.instructionNavigation(instruction('hidden-parent')).breadcrumbs.length, 3);
  const legacy = snapshot.instructionNavigation(
    instruction('legacy', {
      primaryCategoryId: 'manufacturing',
      tagIds: ['sosudy-pod-davleniem', 'T47'],
    }),
  );
  assert.deepEqual(legacy.category, {
    id: 'manufacturing',
    label: 'Производство и станки',
    path: null,
  });
  assert.deepEqual(
    legacy.tags.map(tag => [tag.id, tag.path]),
    [
      ['sosudy-pod-davleniem', null],
      ['T47', tagPath],
    ],
  );
  assert.equal(
    snapshot.instructionNavigation(instruction('none', { primaryCategoryId: null, tagIds: [] }))
      .category,
    null,
  );
});

test('instruction navigation snapshots retain their links until a fresh registry read observes publication or rename', () => {
  const f = fixture();
  f.publish('H02');
  f.publish('W01');
  const record = instruction('current');
  const old = f.service.snapshot();
  const output = old.instructionNavigation(record);
  output.category.label = 'Локальная мутация';
  output.breadcrumbs.length = 0;
  f.entity('W01').slug = 'novyy-razdel';
  assert.equal(old.instructionNavigation(record).category.path, sectionPath);
  assert.equal(old.instructionNavigation(record).breadcrumbs.length, 5);
  assert.equal(
    f.service.snapshot().instructionNavigation(record).category.path,
    `${catalogPath}novyy-razdel/`,
  );
  f.entity('W01').status = 'draft';
  assert.equal(f.service.snapshot().instructionNavigation(record).category.path, null);
});

test('saved draft pages can be privately projected without publishing, exposing provenance or changing public visibility', () => {
  const f = fixture();
  const draft = f.entity('W01');
  Object.assign(draft, {
    h1: 'Сохранённый H1',
    seoTitle: 'Сохранённый Title',
    seoDescription: 'Сохранённое описание',
    introContent: content('Сохранённое вступление'),
    seoContent: content('Сохранённый SEO-текст'),
  });
  f.records.push(
    instruction('current', {
      editorialMeta: { author: 'PRIVATE_EDITOR' },
      taxonomyMeta: { note: 'PRIVATE_PROVENANCE' },
      instructionContent: content('PRIVATE_BODY'),
    }),
  );
  const before = structuredClone(f.state);
  const snapshot = f.service.snapshot();
  const result = snapshot.preview('section', 'W01', {}, origin);
  assert.equal(result.status, 200);
  const page = result.page;
  assert.equal(page.preview, true);
  assert.equal(page.entityStatus, 'draft');
  assert.equal(page.routeApproved, true);
  assert.equal(page.path, sectionPath);
  assert.equal(page.publicPath, null);
  assert.equal(page.h1, 'Сохранённый H1');
  assert.deepEqual(page.introContent, content('Сохранённое вступление'));
  assert.deepEqual(page.seoContent, content('Сохранённый SEO-текст'));
  assert.deepEqual(page.seo, {
    title: 'Сохранённый Title',
    description: 'Сохранённое описание',
    canonicalUrl: `${origin}${sectionPath}`,
    robots: 'noindex, nofollow',
    indexable: false,
  });
  assert.equal(page.breadcrumbs[2].path, null);
  assert.equal(page.total, 1);
  assert.equal(JSON.stringify(page).includes('PRIVATE_'), false);
  assert.deepEqual(snapshot.resolve(sectionPath, {}, origin), { status: 404 });
  assert.deepEqual(snapshot.navigation(origin).catalogs, []);
  assert.deepEqual(snapshot.sitemap(origin), [{ path: rootPath, loc: `${origin}${rootPath}` }]);
  assert.deepEqual(f.state, before);
});

test('profession preview never picks either unresolved catalog route or makes draft children navigable', () => {
  const f = fixture();
  f.records.push(instruction('profession', { primaryCategoryId: 'P01', tagIds: [] }));
  const snapshot = f.service.snapshot();
  for (const [kind, code] of [
    ['catalog', 'H01'],
    ['section', 'P01'],
  ]) {
    const page = snapshot.preview(kind, code, {}, origin).page;
    assert.equal(page.path, null);
    assert.equal(page.routeApproved, false);
    assert.equal(page.publicPath, null);
    assert.equal(page.seo.canonicalUrl, null);
    assert.equal(page.total, 1);
    assert.equal(page.seo.indexable, false);
    assert.ok(page.pagination.every(item => item.path === null));
    assert.equal(JSON.stringify(page).includes('po-professiyam'), false);
  }
  const catalog = snapshot.preview('catalog', 'H01', {}, origin).page;
  assert.equal(catalog.sections.length, 24);
  assert.ok(catalog.sections.every(section => section.path === null));
  assert.equal(catalog.sections.find(section => section.code === 'P01').count, 1);
});

test('preview reuses public list search, sorting, pagination and safe summaries without redirecting normalized form inputs', () => {
  const f = fixture();
  for (const code of ['H02', 'W01', 'T47']) f.publish(code);
  for (let index = 1; index <= 50; index += 1) {
    f.records.push(
      instruction(`row-${String(index).padStart(2, '0')}`, {
        title: `Работа ${String(index).padStart(2, '0')}`,
        publishedAt: `2026-01-${String(Math.min(index, 28)).padStart(2, '0')}`,
      }),
    );
  }
  const snapshot = f.service.snapshot();
  const query = { page: '2', sort: 'newest', q: 'рАБоТа' };
  const page = snapshot.preview('section', 'W01', query, origin).page;
  const live = snapshot.resolve(sectionPath, query, origin).page;
  assert.deepEqual(page.items, live.items);
  assert.equal(page.total, 50);
  assert.equal(page.page, 2);
  assert.equal(page.pageSize, 24);
  assert.equal(page.publicPath, sectionPath);
  assert.equal(page.seo.robots, 'noindex, nofollow');
  assert.deepEqual(page.pagination, [
    { page: 1, path: null },
    { page: 2, path: null },
    { page: 3, path: null },
  ]);
  assert.equal(page.previousPath, null);
  assert.equal(page.nextPath, null);
  assert.equal(
    snapshot.preview('section', 'W01', { page: '01', sort: 'title', q: ' ' }, origin).status,
    200,
  );
  assert.deepEqual(snapshot.preview('section', 'W01', { page: '4' }, origin), { status: 404 });
});

test('root and catalog previews count published assignments including noindex while keeping drafts private', () => {
  const f = fixture();
  f.publish('H02');
  f.publish('W01');
  f.records.push(
    instruction('visible'),
    instruction('noindex', { primaryCategoryId: 'W02', seoStatus: 'noindex' }),
    instruction('draft', { status: 'draft' }),
    instruction('seo-draft', { seoStatus: 'draft' }),
  );
  Object.assign(f.entity('ROOT'), {
    h1: 'Черновой ROOT',
    introContent: content('Черновое вступление'),
  });
  const snapshot = f.service.snapshot();
  const root = snapshot.preview('root', 'ROOT', {}, origin).page;
  assert.equal(root.h1, 'Черновой ROOT');
  assert.equal(root.total, 2);
  assert.equal(root.publicPath, rootPath);
  assert.deepEqual(root.breadcrumbs, [
    { name: 'Главная', path: '/' },
    { name: f.entity('ROOT').name, path: null },
  ]);
  assert.equal(snapshot.navigation(origin).root, null);
  const catalog = snapshot.preview('catalog', 'H02', {}, origin).page;
  assert.equal(catalog.total, 2);
  assert.equal(catalog.sections.length, 28);
  assert.equal(catalog.sections.find(section => section.code === 'W01').path, sectionPath);
  assert.equal(catalog.sections.find(section => section.code === 'W02').path, null);
  assert.equal(catalog.sections.find(section => section.code === 'W02').count, 1);
});

test('preview honors a saved alternate canonical but remains noindex and validates scalar query values', () => {
  const f = fixture();
  f.entity('T47').canonicalUrl = 'https://example.com/approved-canonical/';
  const snapshot = f.service.snapshot();
  const page = snapshot.preview('tag', 'T47', {}, origin).page;
  assert.equal(page.seo.canonicalUrl, 'https://example.com/approved-canonical/');
  assert.equal(page.seo.indexable, false);
  for (const query of [{ q: [] }, { page: '-1' }, { sort: 'popular' }, { path: '/other' }])
    assert.throws(() => snapshot.preview('tag', 'T47', query, origin), {
      code: 'INVALID_TAXONOMY_PUBLIC_QUERY',
    });
  assert.deepEqual(snapshot.preview('section', 'missing', {}, origin), { status: 404 });
  assert.deepEqual(snapshot.preview('unknown', 'W01', {}, origin), { status: 404 });
  assert.throws(() => snapshot.preview('tag', 'T47', {}, 'javascript:alert(1)'), {
    code: 'TAXONOMY_PUBLIC_ORIGIN_ERROR',
  });
});
