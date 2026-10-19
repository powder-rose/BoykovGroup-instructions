import assert from 'node:assert/strict';
import test from 'node:test';

import { applyInstructionTaxonomyEditorPatch } from '../src/services/instructionTaxonomyEditor.js';

const base = {
  id: 'sl-elektrik',
  slug: 'sl-elektrik',
  title: 'Инструкция по охране труда для слесаря-электрика',
  profession: 'слесаря-электрика',
  sections: [{ heading: 'Общие требования', paragraphs: ['1.1. Инструмент.'] }],
};

test('omitted taxonomy patch keeps automatic classification and original document', () => {
  const saved = applyInstructionTaxonomyEditorPatch(base);
  assert.equal(saved.primaryCategoryId, 'electrical');
  assert.ok(saved.tagIds.includes('slesar'));
  assert.equal(saved.taxonomyMeta.categorySource, 'auto');
  assert.equal(saved.id, base.id);
  assert.equal(saved.slug, base.slug);
  assert.deepEqual(saved.sections, base.sections);
  assert.equal(base.taxonomyMeta, undefined);
});

test('manual category and tag edits are independent and survive future saves', () => {
  const automatic = applyInstructionTaxonomyEditorPatch(base);
  const selected = applyInstructionTaxonomyEditorPatch(automatic, {
    category: { mode: 'manual', id: 'office' },
    tags: { mode: 'manual', ids: ['slesar'] },
  });
  assert.equal(selected.primaryCategoryId, 'office');
  assert.deepEqual(selected.tagIds, ['slesar']);
  assert.equal(selected.taxonomyMeta.categorySource, 'manual');
  assert.equal(selected.taxonomyMeta.tagsSource, 'manual');
  const refreshed = applyInstructionTaxonomyEditorPatch({ ...selected, title: 'Другой заголовок' });
  assert.equal(refreshed.primaryCategoryId, 'office');
  assert.deepEqual(refreshed.tagIds, ['slesar']);
  assert.deepEqual(selected.tagIds, ['slesar']);
});

test('reset only the category to auto while keeping manually selected tags', () => {
  const manual = applyInstructionTaxonomyEditorPatch(base, {
    category: { mode: 'manual', id: 'office' },
    tags: { mode: 'manual', ids: ['slesar'] },
  });
  const result = applyInstructionTaxonomyEditorPatch(manual, {
    category: { mode: 'auto' },
  });
  assert.equal(result.primaryCategoryId, 'electrical');
  assert.deepEqual(result.tagIds, ['slesar']);
  assert.equal(result.taxonomyMeta.categorySource, 'auto');
  assert.equal(result.taxonomyMeta.tagsSource, 'manual');
});

test('empty manual classification is intentionally permitted and survives auto updates', () => {
  const empty = applyInstructionTaxonomyEditorPatch(base, {
    category: { mode: 'manual', id: null },
    tags: { mode: 'manual', ids: [] },
  });
  assert.equal(empty.primaryCategoryId, null);
  assert.deepEqual(empty.tagIds, []);
  assert.equal(empty.taxonomyMeta.needsReview, true);
  assert.deepEqual(applyInstructionTaxonomyEditorPatch(empty).tagIds, []);
});

test('invalid taxonomy payloads are rejected with status 400 and do not mutate input', () => {
  const previous = structuredClone(base);
  for (const patch of [
    null,
    [],
    { category: { mode: 'manual', id: 'unknown' } },
    { tags: { mode: 'manual', ids: ['slesar', 'slesar'] } },
    { tags: { mode: 'manual', ids: Array(6).fill('slesar') } },
    { category: { mode: 'manual' } },
    { category: { mode: 'auto', id: 'office' } },
    { tags: { mode: 'manual', ids: null } },
    { tags: { mode: 'auto', ids: [] } },
    { extra: { mode: 'manual' } },
  ]) {
    assert.throws(
      () => applyInstructionTaxonomyEditorPatch(base, patch),
      error => {
        assert.equal(error.status, 400);
        assert.equal(error.code, 'INVALID_INSTRUCTION_TAXONOMY');
        return true;
      },
    );
  }
  assert.deepEqual(base, previous);
});

test('attempted client metadata injection cannot change taxonomy mode', () => {
  const withManual = applyInstructionTaxonomyEditorPatch(base, {
    category: { mode: 'manual', id: 'office' },
  });
  const untouched = applyInstructionTaxonomyEditorPatch(withManual, {});
  assert.equal(untouched.primaryCategoryId, 'office');
  assert.equal(untouched.taxonomyMeta.categorySource, 'manual');
});
