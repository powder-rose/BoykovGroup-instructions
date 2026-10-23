import assert from 'node:assert/strict';
import test from 'node:test';

import { getRelatedInstructions } from '../src/services/instructionEditorService.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';

function fixture() {
  const registry = getInstructionTaxonomyRegistrySeed();
  Object.assign(
    registry.catalogs.find(item => item.code === 'H02'),
    {
      status: 'published',
      routeApproved: true,
    },
  );
  const records = [
    {
      id: 'first',
      slug: 'first_Mixed',
      title: 'Инструкция по охране труда для электрика',
      profession: 'Электрик',
      primaryCategoryId: 'W01',
      tagIds: ['T01'],
      revision: 3,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
    {
      id: 'second',
      title: 'Инструкция для электрика оборудования',
      profession: 'Электрик оборудования',
      primaryCategoryId: 'W01',
      tagIds: ['T01'],
      revision: 2,
      seoStatus: 'noindex',
    },
    { id: 'draft', title: 'Черновик', status: 'draft', primaryCategoryId: 'W01' },
  ];
  for (const record of records) {
    Object.defineProperty(record, 'instructionContent', {
      get() {
        throw new Error('The public reference projection must not touch document bodies');
      },
    });
    Object.defineProperty(record, 'editorialMeta', {
      get() {
        throw new Error('The public reference projection must not touch editorial metadata');
      },
    });
  }
  let reads = 0;
  const repository = {
    getPublicReferencesFresh() {
      reads += 1;
      return records;
    },
    getAllFresh() {
      throw new Error('A public request must use the reference index');
    },
    getAll() {
      throw new Error('A public request must not copy the full repository cache');
    },
  };
  const service = createInstructionTaxonomyPublicService({
    repository,
    taxonomyRepository: { read: () => registry },
  });
  return {
    service,
    repository,
    records,
    get reads() {
      return reads;
    },
  };
}

test('public snapshots prefer indexed references and retain private summary fields without touching bodies', () => {
  const f = fixture();
  const snapshot = f.service.snapshot();
  assert.equal(f.reads, 1);
  const records = snapshot.references();
  assert.deepEqual(
    records.map(item => item.id),
    ['first', 'second'],
  );
  assert.equal(records[0].profession, 'Электрик');
  assert.equal(records[0].revision, 3);
  assert.equal(records[0].modifiedAt, '2026-01-01T00:00:00Z');
  assert.equal(records[0].updatedAt, '2026-02-01T00:00:00Z');
  assert.equal(Object.hasOwn(records[0], 'instructionContent'), false);
  assert.equal(Object.hasOwn(records[0], 'editorialMeta'), false);

  records[0].tagIds.length = 0;
  records[0].profession = 'Локальная мутация';
  records.length = 0;
  const again = snapshot.references();
  assert.equal(again.length, 2);
  assert.deepEqual(again[0].tagIds, ['T01']);
  assert.equal(again[0].profession, 'Электрик');

  const page = snapshot.resolve('/instrukcii-po-ohrane-truda/po-vidam-rabot/').page;
  assert.equal(page.total, 2);
  assert.ok(page.items.every(item => !Object.hasOwn(item, 'profession')));
  assert.ok(page.items.every(item => !Object.hasOwn(item, 'revision')));
  assert.equal(f.reads, 1);
});

test('related selection prefers the indexed provider and reuses a captured thin snapshot without another read', () => {
  const f = fixture();
  const snapshot = f.service.snapshot();
  const main = f.records[0];
  const catalog = snapshot.assignmentCatalog;
  const related = getRelatedInstructions(main, {
    repository: f.repository,
    catalog,
    records: snapshot.references(),
  });
  assert.deepEqual(
    related.map(item => item.id),
    ['second'],
  );
  assert.equal(related[0].revision, 2);
  assert.equal(f.reads, 1);

  assert.deepEqual(
    getRelatedInstructions(main, { repository: f.repository, catalog }).map(item => item.id),
    ['second'],
  );
  assert.equal(f.reads, 2);
});
