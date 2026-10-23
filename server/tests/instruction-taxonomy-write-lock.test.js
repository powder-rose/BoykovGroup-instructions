import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hasPendingInstructionDraft } from '../src/services/instructionDraftGuard.js';
import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import {
  rollbackInstruction,
  saveInstructionSnapshot,
} from '../src/services/instructionHistoryService.js';
import { saveInstructionWithTaxonomy } from '../src/services/instructionTaxonomyPersistence.js';
import { normalizeInstructionTaxonomyEntity } from '../src/services/instructionTaxonomyRegistryModel.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

function seedState() {
  const entity = (kind, code, slug, parentCode) =>
    normalizeInstructionTaxonomyEntity(kind, {
      code,
      name: code,
      slug,
      parentCode,
    });
  return {
    schemaVersion: 1,
    revision: 0,
    root: entity('root', 'ROOT', 'instrukcii-po-ohrane-truda', null),
    catalogs: [entity('catalog', 'H02', 'po-vidam-rabot', 'ROOT')],
    sections: [entity('section', 'W01', 'raboty-na-vysote', 'H02')],
    tags: [entity('tag', 'T01', 'vysota', 'ROOT'), entity('tag', 'T02', 'instrument', 'ROOT')],
    redirects: [],
    sourceIssues: [],
  };
}

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-write-lock-'));
  const registryFile = path.join(directory, 'registry', 'instruction-taxonomy.json');
  const registry = createInstructionTaxonomyRegistryRepository({
    filePath: registryFile,
    seed: seedState(),
  });
  // Nested contention tests must fail immediately while the same thread owns the lease.
  const noWaitRegistry = {
    ...registry,
    withLock: callback => registry.withLock(callback),
  };
  const repository = new InstructionsRepository(path.join(directory, 'instructions'));
  const draftsDirectory = path.join(directory, 'drafts');
  const historyRoot = path.join(directory, 'history');
  const editor = createInstructionEditorService({
    repository,
    draftsDirectory,
    taxonomyRepository: noWaitRegistry,
    saveSnapshot: instruction => saveInstructionSnapshot(instruction, { historyRoot }),
  });
  const registryService = createInstructionTaxonomyRegistryService({
    repository: registry,
    getInstructions: () => editor.getTaxonomyReferences(),
  });
  const draftFile = id =>
    path.join(draftsDirectory, `${Buffer.from(id, 'utf8').toString('base64url')}.json`);
  const rollback = id =>
    rollbackInstruction(id, {
      repository,
      historyRoot,
      draftsDirectory,
      taxonomyRepository: noWaitRegistry,
    });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return {
    directory,
    registryFile,
    registry,
    noWaitRegistry,
    repository,
    draftsDirectory,
    historyRoot,
    editor,
    registryService,
    draftFile,
    rollback,
  };
}

function input(overrides = {}) {
  return {
    title: 'Инструкция для работ на высоте',
    slug: 'raboty-na-vysote',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст инструкции.' }] }],
    },
    seoTitle: 'Работы на высоте — инструкция',
    seoDescription: 'Требования охраны труда при выполнении работ на высоте.',
    status: 'draft',
    taxonomyPatch: {
      category: { mode: 'manual', id: 'W01' },
      tags: { mode: 'manual', ids: ['T01'] },
      registryRevision: 0,
    },
    ...overrides,
  };
}

function currentRecord(overrides = {}) {
  return {
    id: 'current',
    title: 'Текущая инструкция',
    slug: 'current',
    revision: 3,
    primaryCategoryId: 'W01',
    tagIds: ['T02'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual' },
    ...overrides,
  };
}

function removeTag(f, code = 'T01') {
  return f.registryService.remove('tag', code, { expectedRevision: f.registry.read().revision });
}

test('assignment transactions share the registry lease without persisting or incrementing it', t => {
  const f = fixture(t);
  const result = f.registry.withLock((state, assertHeld) => {
    assert.equal(state.revision, 0);
    assertHeld();
    assert.throws(() => removeTag(f), { code: 'TAXONOMY_LOCKED', status: 409 });
    state.tags = [];
    return 'saved';
  });
  assert.equal(result, 'saved');
  assert.equal(f.registry.read().tags.length, 2);
  assert.equal(f.registry.read().revision, 0);
  assert.equal(fs.existsSync(f.registryFile), false);
  assert.equal(fs.existsSync(`${f.registryFile}.lock`), false);
});

test('transactions reject asynchronous work and propagate operation failures after releasing the lease', t => {
  const f = fixture(t);
  assert.throws(() => f.registry.withLock(async () => {}), /synchronous callback/u);
  assert.throws(() => f.registry.withLock(() => Promise.resolve()), {
    code: 'INVALID_TAXONOMY_UPDATE',
  });
  const failure = new Error('Instruction write failed');
  assert.throws(
    () =>
      f.registry.withLock(() => {
        throw failure;
      }),
    error => error === failure,
  );
  assert.equal(fs.existsSync(`${f.registryFile}.lock`), false);
  assert.equal(
    f.registry.withLock(() => 'released'),
    'released',
  );
});

test('published references are read from disk even when the original repository cache is stale', t => {
  const f = fixture(t);
  const other = new InstructionsRepository(f.repository.dir);
  other.save(currentRecord({ tagIds: ['T01'] }));
  assert.equal(f.repository.getAll().length, 0);
  assert.throws(() => removeTag(f), { code: 'TAXONOMY_ENTITY_IN_USE' });
  assert.equal(f.editor.getTaxonomyReferences()[0].tagIds[0], 'T01');
  assert.equal(f.registry.read().revision, 0);
});

test('incomplete or malformed published storage blocks registry deletion and editor mutation', t => {
  const f = fixture(t);
  f.repository.save(currentRecord());
  const original = fs.readFileSync(path.join(f.repository.dir, 'current.json'));
  const broken = path.join(f.repository.dir, 'broken.json');
  for (const bytes of [Buffer.from('{broken'), Buffer.from('{}'), Buffer.from([0xff])]) {
    fs.writeFileSync(broken, bytes);
    assert.throws(() => removeTag(f), { code: 'INSTRUCTION_STORAGE_ERROR', status: 500 });
    assert.throws(() => f.editor.save('current', { revision: 3 }), {
      code: 'INSTRUCTION_STORAGE_ERROR',
    });
    assert.deepEqual(fs.readFileSync(path.join(f.repository.dir, 'current.json')), original);
    assert.equal(f.registry.read().revision, 0);
    assert.equal(fs.existsSync(`${f.registryFile}.lock`), false);
  }
});

test('duplicate IDs and non-regular published entries cannot hide instruction references', t => {
  const f = fixture(t);
  f.repository.save(currentRecord());
  const duplicate = path.join(f.repository.dir, 'duplicate.json');
  fs.copyFileSync(path.join(f.repository.dir, 'current.json'), duplicate);
  assert.throws(() => f.repository.getTaxonomyReferences(), { code: 'INSTRUCTION_STORAGE_ERROR' });
  fs.rmSync(duplicate);
  fs.mkdirSync(duplicate);
  assert.throws(() => removeTag(f), { code: 'INSTRUCTION_STORAGE_ERROR' });
  assert.equal(f.registry.read().revision, 0);
});

test('malformed or mismatched draft records fail closed for references and rollback guards', t => {
  const f = fixture(t);
  fs.mkdirSync(f.draftsDirectory);
  const current = currentRecord();
  const valid = { id: current.id, revision: 4, status: 'draft' };
  for (const value of [
    {},
    { ...valid, id: 'another-instruction' },
    { ...valid, revision: '4' },
    { ...valid, status: 'published' },
  ]) {
    fs.writeFileSync(f.draftFile(current.id), JSON.stringify(value));
    assert.throws(() => f.editor.getTaxonomyReferences(), {
      code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
    });
    assert.throws(() => hasPendingInstructionDraft(current, { directory: f.draftsDirectory }), {
      code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
    });
    assert.throws(() => removeTag(f), { code: 'INSTRUCTION_DRAFT_STORAGE_ERROR' });
  }
  fs.writeFileSync(f.draftFile(current.id), Buffer.from([0xff]));
  assert.throws(() => hasPendingInstructionDraft(current, { directory: f.draftsDirectory }), {
    code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
  });
  fs.writeFileSync(f.draftFile(current.id), JSON.stringify(valid));
  assert.equal(hasPendingInstructionDraft(current, { directory: f.draftsDirectory }), true);
  fs.writeFileSync(f.draftFile(current.id), JSON.stringify({ ...valid, revision: 2 }));
  assert.equal(hasPendingInstructionDraft(current, { directory: f.draftsDirectory }), false);
});

test('draft and published assignments both prevent deletion throughout publication and removal', t => {
  const f = fixture(t);
  const draft = f.editor.save(null, input()).instruction;
  assert.throws(() => removeTag(f), { code: 'TAXONOMY_ENTITY_IN_USE' });
  assert.throws(() => f.registryService.remove('section', 'W01', { expectedRevision: 0 }), {
    code: 'TAXONOMY_ENTITY_IN_USE',
  });
  const published = f.editor.save(draft.id, {
    revision: draft.revision,
    status: 'published',
  }).instruction;
  assert.equal(fs.existsSync(f.draftFile(draft.id)), false);
  assert.throws(() => removeTag(f), { code: 'TAXONOMY_ENTITY_IN_USE' });
  f.editor.remove(published.id, { revision: published.revision });
  removeTag(f);
  assert.equal(
    f.registry.read().tags.some(item => item.code === 'T01'),
    false,
  );
});

test('shared registry ownership blocks every editor reference mutation and rollback', t => {
  const f = fixture(t);
  const draft = f.editor.save(null, input()).instruction;
  f.repository.save(currentRecord());
  saveInstructionSnapshot(currentRecord({ tagIds: ['T01'] }), { historyRoot: f.historyRoot });
  f.registry.withLock(() => {
    const operations = [
      () => f.editor.save(draft.id, { revision: draft.revision }),
      () => f.editor.remove(draft.id, { revision: draft.revision }),
      () => f.editor.discardDraft(draft.id, { revision: draft.revision }),
      () => f.editor.unpublish('current', { revision: 3 }),
      () => f.rollback('current'),
      () =>
        saveInstructionWithTaxonomy(f.repository, currentRecord(), {
          taxonomyRepository: f.noWaitRegistry,
        }),
    ];
    for (const operation of operations) {
      assert.throws(operation, { code: 'TAXONOMY_LOCKED', status: 409 });
    }
  });
  assert.equal(f.editor.get(draft.id).instruction.revision, draft.revision);
  assert.equal(f.repository.getById('current').revision, 3);
});

test('editor revision checks use the latest disk version across repository instances', t => {
  const f = fixture(t);
  f.repository.save(currentRecord());
  const other = new InstructionsRepository(f.repository.dir);
  other.save(currentRecord({ title: 'Сохранено другим редактором', revision: 4 }));
  assert.throws(() => f.editor.save('current', { revision: 3 }), {
    code: 'INSTRUCTION_REVISION_CONFLICT',
  });
  assert.equal(f.repository.getByIdFresh('current').title, 'Сохранено другим редактором');
});

test('losing the shared lease before a published rename preserves the last instruction', t => {
  const f = fixture(t);
  f.repository.save(currentRecord());
  const original = fs.readFileSync(path.join(f.repository.dir, 'current.json'));
  const write = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (file, ...args) => {
    const result = write(file, ...args);
    if (typeof file === 'string' && file.startsWith(f.repository.dir) && file.endsWith('.tmp')) {
      write(`${f.registryFile}.lock`, JSON.stringify({ owner: 'replacement-writer' }));
    }
    return result;
  });
  assert.throws(
    () =>
      f.editor.save(
        'current',
        input({
          status: 'published',
          revision: 3,
          slug: 'current',
        }),
      ),
    { code: 'TAXONOMY_LOCK_LOST' },
  );
  assert.deepEqual(fs.readFileSync(path.join(f.repository.dir, 'current.json')), original);
  assert.equal(f.repository.getById('current').revision, 3);
  assert.equal(JSON.parse(fs.readFileSync(`${f.registryFile}.lock`)).owner, 'replacement-writer');
  assert.deepEqual(fs.readdirSync(f.repository.dir), ['current.json']);
});

test('rollback refuses deleted coded references and retains the historical snapshot', t => {
  const f = fixture(t);
  const current = currentRecord();
  f.repository.save(current);
  const snapshot = saveInstructionSnapshot(
    { ...current, tagIds: ['T01'] },
    {
      historyRoot: f.historyRoot,
    },
  );
  removeTag(f);
  assert.throws(() => f.rollback(current.id), { code: 'INVALID_INSTRUCTION_TAXONOMY' });
  assert.equal(fs.existsSync(snapshot), true);
  assert.deepEqual(f.repository.getByIdFresh(current.id), current);
});

test('rollback rereads current revision and rejects malformed drafts before restoring history', t => {
  const f = fixture(t);
  const current = currentRecord();
  f.repository.save(current);
  const snapshot = saveInstructionSnapshot(
    { ...current, title: 'Предыдущая инструкция' },
    {
      historyRoot: f.historyRoot,
    },
  );
  const other = new InstructionsRepository(f.repository.dir);
  other.save({ ...current, revision: 8 });
  fs.mkdirSync(f.draftsDirectory);
  fs.writeFileSync(f.draftFile(current.id), '{}');
  assert.throws(() => f.rollback(current.id), { code: 'INSTRUCTION_DRAFT_STORAGE_ERROR' });
  assert.equal(fs.existsSync(snapshot), true);
  assert.equal(f.repository.getByIdFresh(current.id).revision, 8);
  fs.rmSync(f.draftFile(current.id));
  const restored = f.rollback(current.id);
  assert.equal(restored.revision, 9);
  assert.equal(restored.title, 'Предыдущая инструкция');
  assert.equal(fs.existsSync(snapshot), false);
});

test('automatic persistence preserves the latest manual coded assignments from disk', t => {
  const f = fixture(t);
  const stale = currentRecord({
    primaryCategoryId: 'electrical',
    tagIds: [],
    taxonomyMeta: undefined,
  });
  const other = new InstructionsRepository(f.repository.dir);
  other.save(currentRecord({ tagIds: ['T01', 'T02'] }));
  const saved = saveInstructionWithTaxonomy(f.repository, stale, {
    taxonomyRepository: f.noWaitRegistry,
  });
  assert.equal(saved.primaryCategoryId, 'W01');
  assert.deepEqual(saved.tagIds, ['T01', 'T02']);
  assert.equal(saved.taxonomyMeta.categorySource, 'manual');
  assert.equal(saved.taxonomyMeta.tagsSource, 'manual');
  assert.throws(() => removeTag(f), { code: 'TAXONOMY_ENTITY_IN_USE' });
});
