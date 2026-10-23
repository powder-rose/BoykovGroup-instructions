import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  getInstructionTaxonomyAssignmentCatalog,
  validateInstructionTaxonomyAssignment,
} from '../src/services/instructionTaxonomyAssignmentCatalog.js';
import { applyInstructionTaxonomyEditorPatch } from '../src/services/instructionTaxonomyEditor.js';
import { saveInstructionWithTaxonomy } from '../src/services/instructionTaxonomyPersistence.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { prepareInstructionTaxonomy } from '../src/services/instructionTaxonomyService.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';

const base = {
  id: 'manual-classification',
  slug: 'original-instruction',
  title: 'Инструкция по охране труда для слесаря-электрика',
  profession: 'слесаря-электрика',
  sections: [{ heading: 'Общие требования', paragraphs: ['1.1. Проверить инструмент.'] }],
};

test('assignment catalog exposes only safe current labels, membership and revision in deterministic order', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  registry.revision = 12;
  registry.tags[1].sortOrder = 0;
  registry.tags[0].sortOrder = 1000;
  registry.tags[1].name = 'Обновлённое название';
  const catalog = getInstructionTaxonomyAssignmentCatalog(registry);
  assert.deepEqual(Object.keys(catalog), [
    'revision',
    'catalogs',
    'sections',
    'tags',
    'legacyCategories',
    'legacyTags',
  ]);
  assert.equal(catalog.revision, 12);
  assert.equal(catalog.catalogs.length, 2);
  assert.equal(catalog.sections.length, 52);
  assert.equal(catalog.tags.length, 79);
  assert.equal(catalog.tags[0].id, 'T02');
  assert.equal(catalog.tags[0].label, 'Обновлённое название');
  assert.deepEqual(Object.keys(catalog.tags[0]), ['id', 'label', 'type']);
  assert.deepEqual(Object.keys(catalog.sections[0]), ['id', 'label', 'catalogId']);
  assert.deepEqual(Object.keys(catalog.catalogs[0]), ['id', 'label']);
  assert.equal(catalog.sections.find(item => item.id === 'W01').catalogId, 'H02');
  assert.equal(catalog.legacyCategories.length, 10);
  assert.equal(catalog.legacyTags.length, 371);
  assert.equal(
    catalog.legacyTags.some(item => Object.hasOwn(item, 'suggestionRule')),
    false,
  );
  catalog.tags[0].label = 'Caller mutation';
  assert.equal(registry.tags[1].name, 'Обновлённое название');
});

test('assignment validation derives a catalog and accepts unlimited explicit mixed tags without alias mapping', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  const selection = {
    primaryCategoryId: 'P02',
    tagIds: ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T47', 'T48', 'sosudy-pod-davleniem'],
  };
  const before = structuredClone(selection);
  assert.deepEqual(
    validateInstructionTaxonomyAssignment(selection, { registry, requireSection: true }),
    {
      ...selection,
      catalogCode: 'H01',
    },
  );
  assert.deepEqual(selection, before);
  assert.deepEqual(
    validateInstructionTaxonomyAssignment({ primaryCategoryId: 'W01', tagIds: [] }, { registry }),
    {
      primaryCategoryId: 'W01',
      tagIds: [],
      catalogCode: 'H02',
    },
  );
  assert.deepEqual(
    validateInstructionTaxonomyAssignment(
      { primaryCategoryId: 'office', tagIds: ['slesar'] },
      { registry },
    ),
    {
      primaryCategoryId: 'office',
      tagIds: ['slesar'],
      catalogCode: null,
    },
  );
  for (const invalid of [
    null,
    [],
    { catalogCode: 'H01' },
    { primaryCategoryId: ['P02'] },
    { primaryCategoryId: 'P99' },
    { tagIds: null },
    { tagIds: ['T01', 'T01'] },
    { tagIds: [false] },
    { tagIds: ['unknown'] },
  ])
    assert.throws(() => validateInstructionTaxonomyAssignment(invalid, { registry }), {
      code: 'INVALID_INSTRUCTION_TAXONOMY',
    });
  for (const primaryCategoryId of [null, 'office', 'H01']) {
    assert.throws(() =>
      validateInstructionTaxonomyAssignment(
        { primaryCategoryId },
        { registry, requireSection: true },
      ),
    );
  }
});

test('selecting a canonical section freezes current optional tags without adding automatic suggestions', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  for (const tagIds of [undefined, [], ['slesar', 'elektrik']]) {
    const instruction = { ...base, ...(tagIds ? { tagIds } : {}) };
    const saved = applyInstructionTaxonomyEditorPatch(
      instruction,
      {
        category: { mode: 'manual', id: 'W01' },
        registryRevision: 0,
      },
      { registry },
    );
    assert.deepEqual(saved.tagIds, tagIds ?? []);
    assert.equal(saved.primaryCategoryId, 'W01');
    assert.equal(saved.taxonomyMeta.categorySource, 'manual');
    assert.equal(saved.taxonomyMeta.tagsSource, 'manual');
    assert.equal(saved.taxonomyMeta.needsReview, false);
    assert.equal(saved.slug, instruction.slug);
    assert.deepEqual(saved.sections, instruction.sections);
    assert.equal(instruction.taxonomyMeta, undefined);
  }
});

test('coded choices without manual metadata remain explicit through reclassification and can clear all tags', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  const selected = {
    ...base,
    primaryCategoryId: 'W01',
    tagIds: ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'slesar'],
  };
  const refreshed = prepareInstructionTaxonomy(
    { ...selected, title: 'Другой заголовок', profession: 'врач' },
    { registry },
  );
  assert.equal(refreshed.primaryCategoryId, selected.primaryCategoryId);
  assert.deepEqual(refreshed.tagIds, selected.tagIds);
  assert.equal(refreshed.taxonomyMeta.tagsSource, 'manual');
  const cleared = applyInstructionTaxonomyEditorPatch(
    refreshed,
    {
      tags: { mode: 'manual', ids: [] },
    },
    { registry },
  );
  assert.deepEqual(cleared.tagIds, []);
  assert.equal(cleared.taxonomyMeta.needsReview, false);
  assert.deepEqual(prepareInstructionTaxonomy(cleared, { registry }), cleared);
});

test('coded assignments reject automatic resets and legacy category downgrades while missing fields preserve them', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  const selected = { ...base, primaryCategoryId: 'W01', tagIds: ['T01'] };
  for (const patch of [
    { category: { mode: 'auto' } },
    { category: { mode: 'manual', id: null } },
    { category: { mode: 'manual', id: 'office' } },
    { tags: { mode: 'auto' } },
  ])
    assert.throws(() => applyInstructionTaxonomyEditorPatch(selected, patch, { registry }), {
      code: 'INVALID_INSTRUCTION_TAXONOMY',
    });
  const unchanged = applyInstructionTaxonomyEditorPatch(selected, {}, { registry });
  assert.equal(unchanged.primaryCategoryId, selected.primaryCategoryId);
  assert.deepEqual(unchanged.tagIds, selected.tagIds);
});

test('explicit coded decisions require the reviewed current revision and invalid selections cannot overwrite input', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  registry.revision = 4;
  const before = structuredClone(base);
  for (const choices of [
    { category: { mode: 'manual', id: 'W01' } },
    { tags: { mode: 'manual', ids: ['T01'] } },
  ]) {
    for (const registryRevision of [undefined, null, -1, '4']) {
      assert.throws(
        () =>
          applyInstructionTaxonomyEditorPatch(base, { ...choices, registryRevision }, { registry }),
        {
          status: 400,
          code: 'INVALID_TAXONOMY_REVISION',
        },
      );
    }
    assert.throws(
      () =>
        applyInstructionTaxonomyEditorPatch(
          base,
          { ...choices, registryRevision: 3 },
          { registry },
        ),
      {
        status: 409,
        code: 'TAXONOMY_REVISION_CONFLICT',
      },
    );
    assert.doesNotThrow(() =>
      applyInstructionTaxonomyEditorPatch(base, { ...choices, registryRevision: 4 }, { registry }),
    );
  }
  for (const patch of [
    { category: { mode: 'manual', id: 'P99' }, registryRevision: 4 },
    { tags: { mode: 'manual', ids: ['T01', 'T01'] }, registryRevision: 4 },
    { tags: { mode: 'manual', ids: ['T99'] }, registryRevision: 4 },
    { catalogCode: 'H02' },
  ])
    assert.throws(() => applyInstructionTaxonomyEditorPatch(base, patch, { registry }), {
      code: 'INVALID_INSTRUCTION_TAXONOMY',
    });
  assert.deepEqual(base, before);
});

test('unknown stored identifiers fail closed even if metadata marks them automatic', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  for (const invalid of [
    { primaryCategoryId: 'W99' },
    { tagIds: ['T99'] },
    { primaryCategoryId: 'deleted-legacy' },
  ]) {
    assert.throws(
      () =>
        prepareInstructionTaxonomy(
          {
            ...base,
            ...invalid,
            taxonomyMeta: { categorySource: 'auto', tagsSource: 'auto' },
          },
          { registry },
        ),
      { code: 'INVALID_INSTRUCTION_TAXONOMY' },
    );
  }
});

test('generation persistence reads current manual choices under the shared lock before merging stale input', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-assignment-persistence-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(directory, 'taxonomy.json'),
  });
  const current = { ...base, primaryCategoryId: 'W01', tagIds: [], title: 'Сохранённая версия' };
  let saved;
  let readFresh = false;
  const repository = {
    getById() {
      throw new Error('Cached record must not decide classification');
    },
    getByIdFresh(id) {
      assert.equal(id, current.id);
      readFresh = true;
      return structuredClone(current);
    },
    save(value) {
      saved = value;
      return value;
    },
  };
  const incoming = {
    ...base,
    primaryCategoryId: 'electrical',
    tagIds: ['elektrik'],
    taxonomyMeta: { categorySource: 'auto', tagsSource: 'auto' },
  };
  const result = saveInstructionWithTaxonomy(repository, incoming, { taxonomyRepository });
  assert.equal(readFresh, true);
  assert.equal(saved.primaryCategoryId, 'W01');
  assert.deepEqual(saved.tagIds, []);
  assert.equal(saved.title, incoming.title);
  assert.equal(saved.slug, incoming.slug);
  assert.deepEqual(saved.sections, incoming.sections);
  assert.equal(result.taxonomyMeta.needsReview, false);
  assert.deepEqual(incoming.tagIds, ['elektrik']);
});

test('generation persistence validates identifiers and retained lock ownership before saving', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  let writes = 0;
  const repository = {
    getById: () => null,
    save: () => {
      writes += 1;
    },
  };
  const options = { taxonomyRepository: { withLock: callback => callback(registry, () => {}) } };
  assert.throws(() =>
    saveInstructionWithTaxonomy(repository, { ...base, tagIds: ['T99'] }, options),
  );
  assert.equal(writes, 0);
  const lost = {
    taxonomyRepository: {
      withLock: callback =>
        callback(registry, () => {
          throw new Error('Lock lost');
        }),
    },
  };
  assert.throws(
    () =>
      saveInstructionWithTaxonomy(
        repository,
        { ...base, primaryCategoryId: 'W01', tagIds: [] },
        lost,
      ),
    /Lock lost/u,
  );
  assert.equal(writes, 0);
});

test('stale generation cannot erase unknown stored identifiers or hide unknown incoming identifiers', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  const options = { taxonomyRepository: { withLock: callback => callback(registry, () => {}) } };
  let writes = 0;
  for (const unknown of [{ primaryCategoryId: 'W99' }, { tagIds: ['T99'] }]) {
    const repository = {
      getByIdFresh: () => ({ ...base, ...unknown }),
      save: () => {
        writes += 1;
      },
    };
    assert.throws(() => saveInstructionWithTaxonomy(repository, base, options), {
      code: 'INVALID_INSTRUCTION_TAXONOMY',
    });
  }
  const repository = {
    getByIdFresh: () => ({ ...base, primaryCategoryId: 'W01', tagIds: [] }),
    save: () => {
      writes += 1;
    },
  };
  assert.throws(
    () => saveInstructionWithTaxonomy(repository, { ...base, tagIds: ['T99'] }, options),
    {
      code: 'INVALID_INSTRUCTION_TAXONOMY',
    },
  );
  assert.equal(writes, 0);
});
