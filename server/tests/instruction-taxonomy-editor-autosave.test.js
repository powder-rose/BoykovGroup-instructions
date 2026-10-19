import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const document = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Полный текст инструкции.' }] }],
};

function editorInput(overrides = {}) {
  return {
    title: 'Инструкция по охране труда для слесаря-электрика',
    slug: 'slesar-elektrik-editor-taxonomy',
    seoTitle: 'Слесарь-электрик — инструкция по охране труда',
    seoDescription: 'Полный текст инструкции по охране труда для слесаря-электрика.',
    instructionContent: document,
    status: 'draft',
    ...overrides,
  };
}

test('editor writes automatic tags to a new draft and preserves them on publication', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-editor-'));
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const service = createInstructionEditorService({
    repository,
    draftsDirectory: path.join(directory, 'drafts'),
    saveSnapshot: () => {},
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const draft = service.save(null, editorInput()).instruction;
  assert.equal(draft.primaryCategoryId, 'electrical');
  assert.ok(draft.tagIds.includes('slesar'));
  assert.equal(draft.taxonomyMeta.categorySource, 'auto');
  assert.equal(repository.getById(draft.id), null);

  const published = service.save(
    draft.id,
    editorInput({ status: 'published', revision: draft.revision }),
  ).instruction;

  assert.equal(published.primaryCategoryId, 'electrical');
  assert.ok(published.tagIds.includes('slesar'));
  assert.equal(published.slug, draft.slug);
  assert.deepEqual(repository.getById(draft.id).tagIds, published.tagIds);

  repository.reload();
  assert.deepEqual(repository.getById(draft.id).tagIds, published.tagIds);

  // The upcoming admin controls may mark a choice manual. An unrelated save
  // must never silently replace that choice with new suggestions.
  const manuallyEdited = {
    ...repository.getById(draft.id),
    primaryCategoryId: 'office',
    tagIds: ['slesar'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual' },
  };
  repository.save(manuallyEdited);
  const edited = service.save(
    draft.id,
    editorInput({ revision: published.revision, title: 'Другое название', status: 'published' }),
  ).instruction;

  assert.equal(edited.primaryCategoryId, 'office');
  assert.deepEqual(edited.tagIds, ['slesar']);
  assert.equal(edited.taxonomyMeta.categorySource, 'manual');
  assert.equal(edited.taxonomyMeta.tagsSource, 'manual');
});
