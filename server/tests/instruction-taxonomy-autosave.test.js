import assert from 'node:assert/strict';
import test from 'node:test';

import { saveInstructionWithTaxonomy } from '../src/services/instructionTaxonomyPersistence.js';

function repository() {
  const stored = new Map();

  return {
    getById: id => stored.get(id) || null,
    save: instruction => {
      stored.set(instruction.id, structuredClone(instruction));
      return instruction;
    },
  };
}

test('new published instruction is classified without changing its document or URL', () => {
  const repo = repository();
  const input = {
    id: 'sl-elektrik',
    slug: 'sl-elektrik',
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
    sections: [{ heading: 'Общие требования', paragraphs: ['1.1. Проверить инструмент.'] }],
  };

  const saved = saveInstructionWithTaxonomy(repo, input);

  assert.equal(saved.primaryCategoryId, 'electrical');
  assert.ok(saved.tagIds.includes('slesar'));
  assert.ok(saved.tagIds.includes('elektrik'));
  assert.equal(saved.taxonomyMeta.categorySource, 'auto');
  assert.equal(saved.id, input.id);
  assert.equal(saved.slug, input.slug);
  assert.deepEqual(saved.sections, input.sections);
  assert.equal(input.taxonomyMeta, undefined);
  assert.deepEqual(repo.getById(input.id), saved);
});

test('new unknown profession remains publishable and is flagged for editorial review', () => {
  const repo = repository();
  const saved = saveInstructionWithTaxonomy(repo, {
    id: 'unknown',
    title: 'Инструкция по охране труда для неизвестной профессии',
  });

  assert.equal(saved.primaryCategoryId, null);
  assert.deepEqual(saved.tagIds, []);
  assert.equal(saved.taxonomyMeta.needsReview, true);
});

test('reimport of legacy unclassified record does not silently migrate it', () => {
  const repo = repository();
  const legacy = {
    id: 'legacy',
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
  };

  repo.save(legacy);
  const incoming = { ...legacy, version: '1.1' };
  const saved = saveInstructionWithTaxonomy(repo, incoming);

  assert.deepEqual(saved, incoming);
  assert.deepEqual(repo.getById(legacy.id), incoming);
});

test('manual classification survives later updates; automatic metadata can refresh', () => {
  const repo = repository();
  const original = saveInstructionWithTaxonomy(repo, {
    id: 'manual',
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
  });

  const manuallyEdited = {
    ...original,
    primaryCategoryId: 'office',
    tagIds: ['slesar'],
    taxonomyMeta: {
      ...original.taxonomyMeta,
      categorySource: 'manual',
      tagsSource: 'manual',
    },
  };
  repo.save(manuallyEdited);

  const saved = saveInstructionWithTaxonomy(repo, {
    ...manuallyEdited,
    title: 'Инструкция по охране труда для слесаря-сантехника',
    profession: 'слесаря-сантехника',
  });

  assert.equal(saved.primaryCategoryId, 'office');
  assert.deepEqual(saved.tagIds, ['slesar']);
  assert.equal(saved.taxonomyMeta.categorySource, 'manual');
  assert.equal(saved.taxonomyMeta.tagsSource, 'manual');

  const automatic = saveInstructionWithTaxonomy(repo, {
    ...saved,
    taxonomyMeta: { categorySource: 'auto', tagsSource: 'auto' },
  });
  assert.equal(automatic.primaryCategoryId, 'property');
  assert.ok(automatic.tagIds.includes('slesar'));
});

test('invalid manual taxonomy fails before writing any record', () => {
  const repo = repository();
  const prior = saveInstructionWithTaxonomy(repo, {
    id: 'safe',
    title: 'Инструкция по охране труда для электромонтёра',
    profession: 'электромонтёра',
  });

  assert.throws(
    () =>
      saveInstructionWithTaxonomy(repo, {
        ...prior,
        primaryCategoryId: 'not-a-category',
        taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual' },
      }),
    /Unknown category/u,
  );

  assert.deepEqual(repo.getById('safe'), prior);
});
