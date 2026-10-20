import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInstructionTaxonomyCatalog,
  prepareInstructionTaxonomy,
  suggestInstructionTaxonomy,
  validateInstructionTaxonomyCatalog,
  validateInstructionTaxonomySelection,
} from '../src/services/instructionTaxonomyService.js';

const catalog = getInstructionTaxonomyCatalog();

test('taxonomy contains ten categories and 371 canonical tags without alias collisions', () => {
  assert.equal(catalog.version, 2);
  assert.equal(catalog.categories.length, 10);
  assert.equal(catalog.tags.length, 371);
  assert.equal(validateInstructionTaxonomyCatalog(catalog), true);
  assert.equal(
    catalog.tags.every(tag => tag.indexPolicy === 'noindex'),
    true,
  );
});

test('rejects conflicting aliases, duplicates, unknown IDs and oversized selections', () => {
  const invalidCatalog = structuredClone(catalog);
  invalidCatalog.tags[1].aliases.push(invalidCatalog.tags[0].label);
  assert.throws(() => validateInstructionTaxonomyCatalog(invalidCatalog), /Conflicting tag alias/u);
  assert.throws(
    () => validateInstructionTaxonomySelection({ tagIds: ['not-a-real-tag'] }),
    /Unknown tag/u,
  );
  assert.throws(
    () => validateInstructionTaxonomySelection({ tagIds: ['slesar', 'slesar'] }),
    /Duplicate tag/u,
  );
  assert.throws(
    () => validateInstructionTaxonomySelection({ primaryCategoryId: 'made-up' }),
    /Unknown category/u,
  );
  assert.throws(
    () =>
      validateInstructionTaxonomySelection({ tagIds: Array.from({ length: 6 }, () => 'slesar') }),
    /at most 5/u,
  );
});

test('matches profession families with Cyrillic word boundaries', () => {
  const result = suggestInstructionTaxonomy({
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
  });
  assert.equal(result.primaryCategoryId, 'electrical');
  assert.ok(result.tagIds.includes('slesar'));
  assert.ok(result.tagIds.includes('elektrik'));
  assert.equal(result.tagIds.length <= 5, true);
});

test('recognizes narrow categories instead of generic profession tokens', () => {
  assert.equal(
    suggestInstructionTaxonomy({
      title: 'Инструкция для слесаря-сантехника',
      profession: 'слесаря-сантехника',
    }).primaryCategoryId,
    'property',
  );
  assert.equal(
    suggestInstructionTaxonomy({
      title: 'Инструкция для водителя погрузчика',
      profession: 'водителя погрузчика',
    }).primaryCategoryId,
    'warehouse',
  );
  assert.equal(
    suggestInstructionTaxonomy({
      title: 'Инструкция по охране труда для системного администратора',
      profession: 'системного администратора',
    }).primaryCategoryId,
    'office',
  );
});

test('does not attribute mentioned professions to work-scope instructions', () => {
  const result = suggestInstructionTaxonomy({
    title: 'Инструкция по охране труда при проведении предрейсовых медосмотров водителей',
    profession: 'при проведении предрейсовых медосмотров водителей',
  });
  assert.equal(result.tagIds.includes('voditel'), false);
});

test('specialization text does not add a different profession tag', () => {
  const sl = suggestInstructionTaxonomy({
    title: 'Инструкция по охране труда для слесаря по ремонту технологического оборудования',
    profession: 'слесаря по ремонту технологического оборудования',
  });
  assert.ok(sl.tagIds.includes('slesar'));
  assert.equal(sl.tagIds.includes('tehnolog'), false);

  const nurse = suggestInstructionTaxonomy({
    title: 'Инструкция для медицинской сестры врача-онколога',
    profession: 'медицинской сестры врача-онколога',
  });
  assert.equal(nurse.tagIds.includes('vrach'), false);
});

test('uncertain subject remains unassigned without blocking the instruction', () => {
  const result = suggestInstructionTaxonomy({
    title: 'Инструкция по охране труда для неизвестной профессии',
  });
  assert.equal(result.primaryCategoryId, null);
  assert.equal(result.needsReview, true);
});

test('manual category and tag choices survive changed titles and repeated proposals', () => {
  const before = {
    title: 'Инструкция по охране труда для врача',
    profession: 'врача',
    primaryCategoryId: 'office',
    tagIds: ['slesar'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual' },
  };
  const result = prepareInstructionTaxonomy(before);
  assert.equal(result.primaryCategoryId, 'office');
  assert.deepEqual(result.tagIds, ['slesar']);
  assert.equal(result.taxonomyMeta.categorySource, 'manual');
  assert.equal(result.taxonomyMeta.tagsSource, 'manual');
  assert.deepEqual(before.tagIds, ['slesar']);
  assert.deepEqual(prepareInstructionTaxonomy(result), result);
});

test('automatic suggestions add metadata without changing instruction document and URL', () => {
  const instruction = {
    id: 'example-instruction',
    slug: 'example-instruction',
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
    sections: [{ heading: 'Общие требования', paragraphs: ['1.1. Тест'] }],
  };
  const result = prepareInstructionTaxonomy(instruction);
  assert.equal(result.primaryCategoryId, 'electrical');
  assert.equal(result.taxonomyMeta.categorySource, 'auto');
  assert.equal(result.taxonomyMeta.tagsSource, 'auto');
  assert.equal(result.id, instruction.id);
  assert.equal(result.slug, instruction.slug);
  assert.deepEqual(result.sections, instruction.sections);
  assert.equal(instruction.tagIds, undefined);
});
