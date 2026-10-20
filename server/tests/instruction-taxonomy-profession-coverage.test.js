import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getInstructionTaxonomyCatalog,
  prepareInstructionTaxonomy,
  suggestInstructionTaxonomy,
  validateInstructionTaxonomyCatalog,
} from '../src/services/instructionTaxonomyService.js';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL('./fixtures/instruction-taxonomy-profession-coverage.json', import.meta.url),
    'utf8',
  ),
);
const catalog = getInstructionTaxonomyCatalog();
const tagsById = new Map(catalog.tags.map(tag => [tag.id, tag]));
const retainedIds = new Set(fixture.retainedTagIds);
const addedTags = catalog.tags.filter(tag => !retainedIds.has(tag.id));

function classify(profession) {
  return suggestInstructionTaxonomy({
    title: `Инструкция по охране труда для ${profession}`,
    profession,
  });
}

function professionTags(profession) {
  return classify(profession).tagIds.filter(id => tagsById.get(id).type === 'profession');
}

test('profession expansion retains every deployed tag ID and keeps new pages noindex', () => {
  assert.equal(retainedIds.size, 176);
  for (const id of retainedIds) assert.ok(tagsById.has(id), id);
  assert.equal(addedTags.length, 195);
  for (const tag of addedTags) {
    assert.equal(tag.type, 'profession', tag.id);
    assert.equal(tag.indexPolicy, 'noindex', tag.id);
  }
  assert.equal(validateInstructionTaxonomyCatalog(catalog), true);
});

test('reviewed public profession names receive their precise role tags', () => {
  assert.equal(fixture.cases.length, 211);
  for (const { profession, expectedTagIds } of fixture.cases) {
    const actual = classify(profession);
    for (const id of expectedTagIds) {
      assert.ok(actual.tagIds.includes(id), `${profession}: missing ${id}`);
    }
    assert.ok(actual.tagIds.length <= 5, profession);
  }
});

test('canonical names of the added professions are themselves recognized', () => {
  for (const tag of addedTags) {
    assert.ok(professionTags(tag.label).includes(tag.id), `${tag.label}: ${tag.id}`);
  }
});

test('profession scopes accept opt-in phrases and reject unknown or non-profession scopes', () => {
  const scopedCatalog = structuredClone(catalog);
  const profession = scopedCatalog.tags.find(tag => tag.type === 'profession');
  for (const scope of ['core', 'phrase']) {
    profession.suggestionRule.scope = scope;
    assert.equal(validateInstructionTaxonomyCatalog(scopedCatalog), true);
  }
  profession.suggestionRule.scope = 'everywhere';
  assert.throws(
    () => validateInstructionTaxonomyCatalog(scopedCatalog),
    /Invalid profession suggestion scope/u,
  );

  const workCatalog = structuredClone(catalog);
  workCatalog.tags.find(tag => tag.type === 'work').suggestionRule.scope = 'phrase';
  assert.throws(
    () => validateInstructionTaxonomyCatalog(workCatalog),
    /Invalid profession suggestion scope/u,
  );
  assert.ok(professionTags('слесаря по ремонту автомобилей').includes('avtoslesar'));
});

test('assistants, department heads and secondary duties do not borrow the principal profession', () => {
  const cases = [
    ['ассистента врача-стоматолога', ['assistent-vracha']],
    ['старшего ассистента врача-стоматолога', ['assistent-vracha']],
    ['помощника врача-эпидемиолога', ['pomoshchnik-vracha']],
    ['помощника эмбриолога', ['pomoshchnik-embriologa']],
    ['помощника нотариуса', ['pomoshchnik-notariusa']],
    ['помощника специалиста по продажам', ['pomoshchnik-po-prodazham']],
    ['помощника мастера смены', ['pomoshchnik-mastera-smeny']],
    ['помощника сменного мастера', ['pomoshchnik-mastera-smeny']],
    ['мастера смены', ['smennyj-master']],
    ['сменного мастера', ['smennyj-master']],
    ['заведующего эмбриологической лабораторией отделения врт', ['zaveduyushchij']],
    ['начальника отдела кадров', ['nachalnik']],
    ['начальника коммерческого отдела', ['nachalnik']],
    ['заместителя начальника отдела кадров', ['zamestitel-rukovoditelya']],
    ['управляющего клиникой', ['upravlyayushchij']],
    ['старшей медицинской сестры врача-хирурга', ['medsestra']],
    [
      'специалиста по кадровому делопроизводству с функциями менеджера отдела продаж',
      ['specialist-po-kadram'],
    ],
    ['диспетчера с обязанностями делопроизводителя', ['dispetcher']],
    ['производителя работ', ['prorab']],
    ['специалиста по обучению уборщиков', []],
    ['помощника специалиста по охране труда', []],
    ['помощника специалиста по возвратам', []],
    ['специалиста по покраске', ['specialist-po-pokraske']],
    ['ведущего специалиста отдела запасных частей', ['specialist-otdela-zapasnyh-chastej']],
  ];

  for (const [profession, expected] of cases) {
    assert.deepEqual(professionTags(profession).sort(), [...expected].sort(), profession);
  }
});

test('general work and staff descriptions do not become invented professions', () => {
  const cases = [
    'при проведении предрейсовых медосмотров водителей',
    'электромонтажные работы на высоте',
    'работы на высоте (мойка окон, замена лампочек на потолке)',
    'погрузочно-разгрузочных работ без участия погрузчика',
    'административно-управленческого персонала',
    'электротехнического персонала при эксплуатации электроустановок',
    'офисного сотрудника (работа за компьютером)',
    'работника офиса',
    'рабочего склада',
    'рабочего цеха хлебопечения',
    'рабочего',
    'мастера',
    'старшего мастера',
    'главного специалиста',
    'специалиста офиса',
    'работника при работе с ЛЕС (ФГИС ЛК)',
    'стажера',
    'индивидуального предпринимателя',
    'эмбриологической лаборатории',
    'административного отдела',
    'электрослесарных работ',
  ];
  for (const profession of cases) {
    assert.deepEqual(professionTags(profession), [], profession);
  }
});

test('new profession tags keep priority within the existing five-tag limit', () => {
  const actual = suggestInstructionTaxonomy({
    profession: 'монтажника кабельных линий',
    title:
      'Инструкция для монтажника кабельных линий при работе на высоте, ' +
      'с электроинструментом, погрузчиком, компьютером и при ремонте оборудования',
  });
  assert.equal(actual.tagIds.length, 5);
  assert.equal(actual.tagIds[0], 'montazhnik');
});

test('expanded suggestions preserve manual choices, including an explicit empty selection', () => {
  for (const tagIds of [[], ['slesar', 'stolyar', 'montazhnik', 'tekhnik', 'prorab']]) {
    const before = {
      id: 'manual-profession-choice',
      slug: 'manual-profession-choice',
      title: 'Инструкция по охране труда для специалиста по охране труда',
      profession: 'специалиста по охране труда',
      sections: [{ title: 'Общие требования', text: 'Содержание инструкции.' }],
      primaryCategoryId: 'office',
      tagIds,
      taxonomyMeta: {
        categorySource: 'manual',
        tagsSource: 'manual',
        reviewedAt: '2026-10-20T00:00:00Z',
      },
    };
    const original = structuredClone(before);
    const result = prepareInstructionTaxonomy(before);
    assert.deepEqual(before, original);
    assert.equal(result.primaryCategoryId, before.primaryCategoryId);
    assert.deepEqual(result.tagIds, tagIds);
    assert.equal(result.taxonomyMeta.categorySource, 'manual');
    assert.equal(result.taxonomyMeta.tagsSource, 'manual');
    assert.equal(result.taxonomyMeta.reviewedAt, before.taxonomyMeta.reviewedAt);
    assert.equal(result.taxonomyMeta.schemaVersion, 2);
    assert.equal(result.slug, before.slug);
    assert.deepEqual(result.sections, before.sections);
    assert.deepEqual(prepareInstructionTaxonomy(result), result);
  }
});
