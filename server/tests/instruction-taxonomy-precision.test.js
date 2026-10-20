import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getInstructionTaxonomyCatalog,
  prepareInstructionTaxonomy,
  suggestInstructionTaxonomy,
} from '../src/services/instructionTaxonomyService.js';

const regressionCases = JSON.parse(
  fs.readFileSync(
    new URL('./fixtures/instruction-taxonomy-precision-regressions.json', import.meta.url),
    'utf8',
  ),
).cases;

function classify(profession) {
  return suggestInstructionTaxonomy({
    title: `Инструкция по охране труда для ${profession}`,
    profession,
  });
}

test('100 reviewed dry-run cases no longer receive the identified false assignments', () => {
  assert.equal(regressionCases.length, 100);

  for (const item of regressionCases) {
    const actual = suggestInstructionTaxonomy(item);
    if (item.forbiddenCategory) {
      assert.notEqual(
        actual.primaryCategoryId,
        item.forbiddenCategory,
        `${item.id}: category ${item.forbiddenCategory}`,
      );
    }
    for (const tagId of item.forbiddenTags) {
      assert.equal(actual.tagIds.includes(tagId), false, `${item.id}: tag ${tagId}`);
    }
  }
});

test('driver category signals do not confuse transport with supervisor and work producer', () => {
  assert.notEqual(classify('руководителя отдела продаж').primaryCategoryId, 'transport');
  assert.notEqual(classify('производителя работ').primaryCategoryId, 'transport');
  assert.notEqual(classify('делопроизводителя').primaryCategoryId, 'transport');
  assert.equal(classify('водителя грузового автомобиля').primaryCategoryId, 'transport');
  assert.equal(classify('водителя автобуса').primaryCategoryId, 'transport');
});

test('profession tags match profession word forms, not adjectives and specialties', () => {
  const cases = [
    ['строителя', 'stroitel'],
    ['инженера-строителя', 'stroitel'],
    ['санитара', 'sanitar'],
    ['санитарки', 'sanitar'],
    ['технолога', 'tehnolog'],
    ['главного технолога', 'tehnolog'],
  ];

  for (const [profession, tagId] of cases) {
    assert.ok(classify(profession).tagIds.includes(tagId), `${profession}: ${tagId}`);
  }

  for (const profession of ['мастера строительных работ', 'продавца строительных материалов']) {
    assert.equal(classify(profession).tagIds.includes('stroitel'), false);
  }
  assert.equal(
    classify('наладчика технологического оборудования').tagIds.includes('tehnolog'),
    false,
  );
  assert.equal(
    classify('ангобировщика санитарно-строительных изделий').tagIds.includes('sanitar'),
    false,
  );
});

test('work tags require a distinct relevant concept, not a substring of another word', () => {
  const present = [
    ['специалиста по логистике и снабжению', 'logistika'],
    ['работника рудника', 'gornye-raboty'],
    ['при эксплуатации котельной', 'kotelnye'],
    ['при эксплуатации котла', 'kotelnye'],
    ['бухгалтера', 'buhgalterskij-uchet'],
    ['при газоопасных работах', 'gazovye-raboty'],
  ];

  for (const [profession, tagId] of present) {
    assert.ok(classify(profession).tagIds.includes(tagId), `${profession}: ${tagId}`);
  }

  const excluded = [
    ['монтажника водоснабжения', 'logistika'],
    ['офисного сотрудника', 'gornye-raboty'],
    ['при разработке котлованов', 'kotelnye'],
    ['специалиста по воинскому учету', 'buhgalterskij-uchet'],
    ['при воздействии сильнодействующих веществ', 'gazovye-raboty'],
  ];
  for (const [profession, tagId] of excluded) {
    assert.equal(classify(profession).tagIds.includes(tagId), false, `${profession}: ${tagId}`);
  }
});

test('construction describes the work rather than building-product vocabulary', () => {
  for (const profession of [
    'строителя',
    'мастера строительных и монтажных работ',
    'при монтаже строительных конструкций',
    'при строительстве зданий',
  ]) {
    assert.equal(classify(profession).primaryCategoryId, 'construction', profession);
  }
  assert.notEqual(
    classify('ангобировщика санитарно-строительных изделий').primaryCategoryId,
    'construction',
  );
  assert.notEqual(
    classify('при перевозке строительных материалов').primaryCategoryId,
    'construction',
  );
});

test('catalog IDs stay stable and explicit manual taxonomy remains authoritative', () => {
  const catalog = getInstructionTaxonomyCatalog();
  assert.equal(catalog.version, 2);
  assert.equal(catalog.categories.length, 10);
  assert.equal(catalog.tags.length, 371);
  const manual = {
    id: 'manual-regression',
    title: 'Инструкция по охране труда для водителя',
    profession: 'водителя',
    primaryCategoryId: 'office',
    tagIds: ['slesar'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual' },
  };
  const result = prepareInstructionTaxonomy(manual);
  assert.equal(result.primaryCategoryId, 'office');
  assert.deepEqual(result.tagIds, ['slesar']);
  assert.deepEqual(manual.tagIds, ['slesar']);
});
