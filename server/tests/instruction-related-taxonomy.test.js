import assert from 'node:assert/strict';
import test from 'node:test';

import { getRelatedInstructions } from '../src/services/instructionEditorService.js';

const catalog = {
  sections: [{ id: 'W01' }, { id: 'W02' }],
  tags: [{ id: 'T01' }, { id: 'T02' }],
  legacyCategories: [{ id: 'legacy-section' }],
  legacyTags: [{ id: 'legacy-topic' }],
};

function related(instruction, records, options = {}) {
  return getRelatedInstructions(instruction, { records, catalog, ...options });
}

function ids(items) {
  return items.map(item => item.id);
}

test('related instructions prefer the main section, then exact shared tags, then meaningful title matches', () => {
  const main = {
    id: 'main',
    title: 'Инструкция по охране труда для электромонтёра',
    primaryCategoryId: 'W01',
    tagIds: ['T01', 'T02'],
  };
  const records = [
    { id: 'lexical', title: 'Инструкция для электромонтёра оборудования' },
    { id: 'one-tag', title: 'Альфа', primaryCategoryId: 'W02', tagIds: ['T01', 'T01'] },
    { id: 'two-tags', title: 'Янтарь', primaryCategoryId: 'W02', tagIds: ['T02', 'T01'] },
    { id: 'section', title: 'Бета', primaryCategoryId: 'W01' },
    { id: 'section-tag', title: 'Ясень', primaryCategoryId: 'W01', tagIds: ['T01'] },
    { id: 'unrelated', title: 'Работа кассира', primaryCategoryId: 'W02' },
    main,
  ];

  assert.deepEqual(ids(related(main, records)), [
    'section-tag',
    'section',
    'two-tags',
    'one-tag',
    'lexical',
  ]);
});

test('related instructions use at most eight suitable documents and never fill a short list arbitrarily', () => {
  const main = { id: 'main', primaryCategoryId: 'W01' };
  const records = Array.from({ length: 11 }, (_, index) => ({
    id: `related-${index}`,
    title: `Документ ${String(index).padStart(2, '0')}`,
    primaryCategoryId: 'W01',
  }));

  assert.equal(related(main, records).length, 8);
  assert.equal(related(main, records, { limit: 12 }).length, 8);
  assert.deepEqual(ids(related(main, records, { limit: 2 })), ['related-0', 'related-1']);
  assert.deepEqual(related(main, records, { limit: 0 }), []);
  assert.equal(related(main, records.slice(0, 3)).length, 3);
  assert.deepEqual(related({ id: 'unassigned' }, records), []);
});

test('draft records and draft overlays are excluded while published noindex records stay eligible', () => {
  const main = { id: 'main', primaryCategoryId: 'W01' };
  const records = [
    { id: 'draft', title: 'Черновик', primaryCategoryId: 'W01', status: 'draft' },
    { id: 'overlay', title: 'Черновой SEO', primaryCategoryId: 'W01', seoStatus: 'draft' },
    { id: 'case-draft', title: 'Черновик', primaryCategoryId: 'W01', status: 'DRAFT' },
    { id: 'noindex', title: 'Закрытая индексация', primaryCategoryId: 'W01', seoStatus: 'noindex' },
    {
      id: 'published',
      title: 'Открытая инструкция',
      primaryCategoryId: 'W01',
      status: 'published',
    },
    { id: 'untitled', primaryCategoryId: 'W01' },
    { id: 'blank-title', title: '   ', primaryCategoryId: 'W01' },
  ];

  assert.deepEqual(ids(related(main, records)), ['noindex', 'published']);
});

test('related lists remove repeated IDs, duplicate canonical links and the current instruction aliases', () => {
  const main = { id: 'main', slug: 'current_Mixed', primaryCategoryId: 'W01' };
  const records = [
    { id: 'main', title: 'Текущая', primaryCategoryId: 'W01' },
    { id: 'alias', slug: 'current_Mixed', title: 'Алиас текущей', primaryCategoryId: 'W01' },
    { id: 'first', slug: 'related_Mixed', title: 'Альфа', primaryCategoryId: 'W01' },
    { id: 'first', slug: 'other', title: 'Бета', primaryCategoryId: 'W01' },
    { id: 'second', slug: 'related_Mixed', title: 'Гамма', primaryCategoryId: 'W01' },
    { id: 'third', title: 'Дельта', primaryCategoryId: 'W01' },
  ];

  const result = related(main, records);
  assert.deepEqual(ids(result), ['first', 'third']);
  assert.equal(result[0].slug, 'related_Mixed');
});

test('only recognized exact taxonomy IDs affect ranking without mapping legacy names to new topics', () => {
  const legacy = {
    id: 'main',
    primaryCategoryId: 'legacy-section',
    tagIds: ['legacy-topic'],
  };
  const records = [
    { id: 'legacy-section', title: 'Легаси-раздел', primaryCategoryId: 'legacy-section' },
    { id: 'legacy-tag', title: 'Легаси-тег', tagIds: ['legacy-topic'] },
    { id: 'canonical', title: 'Новый тег', primaryCategoryId: 'W01', tagIds: ['T01'] },
    { id: 'unknown', title: 'Произвольный ID', primaryCategoryId: 'fake', tagIds: ['invented'] },
  ];

  assert.deepEqual(ids(related(legacy, records)), ['legacy-section', 'legacy-tag']);
  assert.deepEqual(
    related({ id: 'main', primaryCategoryId: 'fake', tagIds: ['invented'] }, records),
    [],
  );
});

test('related records and their input order stay untouched and summaries omit bodies and editorial data', () => {
  const main = { id: 'main', primaryCategoryId: 'W01' };
  const record = {
    id: 'other',
    title: 'Другая инструкция',
    primaryCategoryId: 'W01',
    tagIds: ['T01'],
    instructionContent: { type: 'doc', content: [] },
    editorialMeta: { author: 'PRIVATE_AUTHOR' },
  };
  const records = [main, record];
  const before = structuredClone(records);
  const result = related(main, records);

  assert.deepEqual(records, before);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, record.id);
  assert.ok(!Object.hasOwn(result[0], 'instructionContent'));
  assert.ok(!Object.hasOwn(result[0], 'editorialMeta'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE_AUTHOR'));
});

test('related wrapper reads fresh published records or reuses an explicitly supplied snapshot', () => {
  const main = { id: 'main', primaryCategoryId: 'W01' };
  const record = { id: 'other', title: 'Другая инструкция', primaryCategoryId: 'W01' };
  let reads = 0;
  const repository = {
    getAllFresh() {
      reads += 1;
      return [main, record];
    },
    getAll() {
      throw new Error('Stale repository cache must not be used');
    },
  };

  assert.deepEqual(ids(getRelatedInstructions(main, { repository, catalog })), ['other']);
  assert.equal(reads, 1);
  assert.deepEqual(related(main, [], { repository }), []);
  assert.equal(reads, 1);
});
