import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import {
  getInstructionTaxonomyRegistrySeed,
  getLegacyInstructionTaxonomyCatalog,
} from '../src/services/instructionTaxonomySource.js';
import { getInstructionTaxonomyCatalog } from '../src/services/instructionTaxonomyService.js';
import { validateInstructionTaxonomyRegistry } from '../src/services/instructionTaxonomyRegistryModel.js';

const reference = JSON.parse(
  fs.readFileSync(
    new URL('../../docs/reclassification/source-catalog.json', import.meta.url),
    'utf8',
  ),
);
const LEGACY_CATALOG_SHA256 = '79e53f8b2f54479e073ed3b27efbc18f8029a20083bb4860ab468f0ce2f0a751';

test('the legacy dictionary retains every value from the reviewed main baseline', () => {
  const legacy = getLegacyInstructionTaxonomyCatalog();
  assert.equal(legacy.version, 2);
  assert.equal(legacy.categories.length, 10);
  assert.equal(legacy.tags.length, 371);
  assert.deepEqual(Object.keys(legacy), ['version', 'categories', 'tags']);
  assert.equal(
    createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),
    LEGACY_CATALOG_SHA256,
  );
});

test('the existing taxonomy API exposes the unchanged compatibility projection', () => {
  assert.deepEqual(getInstructionTaxonomyCatalog(), getLegacyInstructionTaxonomyCatalog());
});

test('the complete initial registry seed satisfies the shared runtime model', () => {
  assert.equal(validateInstructionTaxonomyRegistry(getInstructionTaxonomyRegistrySeed()), true);
});

test('every reference code, name, URL slug, H1 proposal and source coordinate is preserved', () => {
  const seed = getInstructionTaxonomyRegistrySeed();
  assert.equal(seed.catalogs.length, 2);
  assert.equal(seed.sections.length, 52);
  assert.equal(seed.tags.length, 79);

  for (const collection of ['catalogs', 'sections', 'tags']) {
    const byCode = new Map(seed[collection].map(entity => [entity.code, entity]));
    assert.deepEqual(
      [...byCode.keys()],
      reference[collection].map(entity => entity.code),
    );
    for (const source of reference[collection]) {
      const entity = byCode.get(source.code);
      assert.equal(entity.name, source.name, source.code);
      assert.equal(entity.slug, source.slug, source.code);
      assert.equal(entity.h1, source.h1Proposal, source.code);
      assert.deepEqual(entity.source, {
        file: reference.source,
        sheet: source.sourceSheet,
        row: source.sourceRow,
        originalUrl: source.sourceUrl,
      });
      assert.equal(entity.parentCode, collection === 'sections' ? source.catalogCode : 'ROOT');
    }
  }
});

test('initial pages are drafts with indexing disabled and no generated SEO copy', () => {
  const seed = getInstructionTaxonomyRegistrySeed();
  assert.equal(seed.schemaVersion, 1);
  assert.equal(seed.revision, 0);
  assert.equal(seed.root.code, 'ROOT');
  assert.equal(seed.root.slug, 'instrukcii-po-ohrane-truda');
  assert.equal(seed.root.parentCode, null);

  for (const entity of [seed.root, ...seed.catalogs, ...seed.sections, ...seed.tags]) {
    assert.equal(entity.status, 'draft', entity.code);
    assert.equal(entity.indexingEnabled, false, entity.code);
    assert.equal(entity.seoTitle, '', entity.code);
    assert.equal(entity.seoDescription, '', entity.code);
    assert.equal(entity.canonicalUrl, '', entity.code);
    assert.deepEqual(entity.introContent, { type: 'doc', content: [] });
    assert.deepEqual(entity.seoContent, { type: 'doc', content: [] });
    assert.ok(Number.isInteger(entity.sortOrder) && entity.sortOrder >= 0);
  }
  for (let number = 21; number <= 28; number++) {
    const entity = seed.sections.find(section => section.code === `W${number}`);
    assert.equal(entity.h1, '');
    assert.equal(entity.indexingEnabled, false);
  }
});

test('unresolved route evidence remains explicit and cannot approve the profession catalog', () => {
  const seed = getInstructionTaxonomyRegistrySeed();
  assert.equal(seed.catalogs.find(catalog => catalog.code === 'H01').routeApproved, false);
  assert.equal(seed.catalogs.find(catalog => catalog.code === 'H02').routeApproved, true);
  assert.deepEqual(seed.sourceIssues, reference.issues);
  const conflict = seed.sourceIssues.find(
    issue => issue.code === 'profession-catalog-url-conflict',
  );
  assert.ok(conflict.description.includes('/po-professiyam/'));
  assert.ok(conflict.description.includes('/po-professiyam-i-dolzhnostyam/'));
});

test('separate reference topics do not merge with a legacy tag that combines them', () => {
  const legacy = getLegacyInstructionTaxonomyCatalog();
  const seed = getInstructionTaxonomyRegistrySeed();
  assert.ok(legacy.tags.some(tag => tag.id === 'sosudy-pod-davleniem'));
  const gas = seed.tags.find(tag => tag.code === 'T47');
  const pressure = seed.tags.find(tag => tag.code === 'T48');
  assert.equal(gas.name, 'Газовые баллоны');
  assert.equal(pressure.name, 'Сосуды под давлением');
  assert.notEqual(gas.code, pressure.code);
  assert.notEqual(gas.slug, pressure.slug);
  assert.equal(gas.legacyId, undefined);
  assert.equal(pressure.legacyId, undefined);
  assert.equal(seed.assignments, undefined);
});

test('source accessors return independent snapshots without exposing shared mutable objects', () => {
  const legacy = getLegacyInstructionTaxonomyCatalog();
  const seed = getInstructionTaxonomyRegistrySeed();
  legacy.tags[0].aliases.push('Caller mutation');
  legacy.categories.splice(0, 1);
  seed.sections[0].name = 'Caller mutation';
  seed.sections[0].introContent.content.push({ type: 'paragraph', content: [] });
  seed.sourceIssues.length = 0;

  assert.equal(getLegacyInstructionTaxonomyCatalog().categories.length, 10);
  assert.equal(
    getLegacyInstructionTaxonomyCatalog().tags[0].aliases.includes('Caller mutation'),
    false,
  );
  const fresh = getInstructionTaxonomyRegistrySeed();
  assert.equal(fresh.sections[0].name, reference.sections[0].name);
  assert.deepEqual(fresh.sections[0].introContent, { type: 'doc', content: [] });
  assert.deepEqual(fresh.sourceIssues, reference.issues);
});
