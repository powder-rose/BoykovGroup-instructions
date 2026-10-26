import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createInstructionTaxonomyBindingStore } from '../src/services/instructionTaxonomyBindingStore.js';
import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import { rollbackInstruction } from '../src/services/instructionHistoryService.js';
import { createInstructionTaxonomyBulkJournal } from '../src/services/instructionTaxonomyBulkJournal.js';
import { saveInstructionWithTaxonomy } from '../src/services/instructionTaxonomyPersistence.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import {
  InstructionsRepository,
  instructionVersionFilename,
} from '../src/services/instructionsRepository.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-binding-store-'));
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const draftsDirectory = path.join(directory, 'drafts');
  const store = createInstructionTaxonomyBindingStore({ repository, draftsDirectory });
  const draftFile = id => path.join(draftsDirectory, instructionVersionFilename(id, 'draft'));
  const writeDraft = record => {
    fs.mkdirSync(draftsDirectory, { recursive: true });
    fs.writeFileSync(draftFile(record.id), `${JSON.stringify(record, null, 2)}\n`);
  };
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, repository, draftsDirectory, store, draftFile, writeDraft };
}

function record(overrides = {}) {
  return {
    id: 'instruction-X7',
    title: 'Исходный заголовок',
    slug: 'original-url',
    revision: 4,
    version: '1.2',
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-02-01T00:00:00.000Z',
    publishedAt: '2020-01-02T00:00:00.000Z',
    primaryCategoryId: 'W01',
    tagIds: ['T01'],
    instructionContent: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
    editorialMeta: { seoReady: true, seoAuthor: 'Автор', seoUpdatedAt: '2020-03-01' },
    ...overrides,
  };
}

test('reads exact published bytes and every saved draft, including an obsolete overlay', t => {
  const f = fixture(t);
  const published = record();
  const oldDraft = record({ revision: 2, status: 'draft', title: 'Старый черновик' });
  const draftOnly = record({ id: 'draft-only', revision: 1, status: 'draft' });
  const bytes = Buffer.from(`\uFEFF${JSON.stringify(published)}`);
  fs.writeFileSync(path.join(f.repository.dir, `${published.id}.json`), bytes);
  f.writeDraft(oldDraft);
  f.writeDraft(draftOnly);
  const snapshots = f.store.read();
  assert.deepEqual(snapshots.map(item => [item.id, item.version]).sort(), [
    ['draft-only', 'draft'],
    ['instruction-X7', 'draft'],
    ['instruction-X7', 'published'],
  ]);
  const saved = snapshots.find(item => item.version === 'published');
  assert.deepEqual(saved.bytes, bytes);
  assert.deepEqual(saved.record, published);
  assert.equal(saved.fingerprint, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(Object.keys(saved), ['id', 'version', 'record', 'bytes', 'fingerprint']);
  saved.record.title = 'Нельзя изменять кэш через снимок';
  assert.equal(f.repository.getById(published.id).title, published.title);
});

test('strict published reads retain missing and zero revisions, Unicode and historic IDs', t => {
  const f = fixture(t);
  const records = [
    record({ id: 'инструкция-токарь-Ё7', revision: 0 }),
    record({ id: 'instruktsiya-po-ohrane-truda-dlya-sistemnogo-administratora-CfhwZb' }),
    record({ id: 'legacy.manual_X7' }),
  ];
  delete records[1].revision;
  for (const current of records) {
    current.slug = current.id;
    f.repository.save(current);
  }
  const snapshots = f.store.read();
  assert.equal(snapshots.length, 3);
  for (const current of records) {
    assert.deepEqual(snapshots.find(item => item.id === current.id).record, current);
  }
});

test('read does not create a draft directory or write instruction files', t => {
  const f = fixture(t);
  f.repository.save(record());
  for (const method of ['writeFileSync', 'renameSync', 'mkdirSync']) {
    t.mock.method(fs, method, () => {
      throw new Error(`Unexpected ${method}`);
    });
  }
  assert.equal(f.store.read().length, 1);
  assert.equal(fs.existsSync(f.draftsDirectory), false);
});

test('serialization follows existing formats and preserves all supplied document fields', t => {
  const f = fixture(t);
  f.repository.save(record());
  f.writeDraft(record({ revision: 5, status: 'draft' }));
  for (const snapshot of f.store.read()) {
    const next = {
      ...snapshot.record,
      tagIds: ['T01', 'T02'],
      revision: snapshot.record.revision + 1,
    };
    const bytes = f.store.serialize(snapshot, next);
    assert.equal(
      bytes.toString('utf8'),
      `${JSON.stringify(next, null, 2)}${snapshot.version === 'draft' ? '\n' : ''}`,
    );
    const { primaryCategoryId: _category, tagIds: _tags, revision: _revision, ...rest } = next;
    const {
      primaryCategoryId: _oldCategory,
      tagIds: _oldTags,
      revision: _oldRevision,
      ...oldRest
    } = snapshot.record;
    assert.deepEqual(rest, oldRest);
  }
});

test('metadata reads retain no document bodies or byte buffers and leave the public cache unchanged', t => {
  const f = fixture(t);
  const published = record({ intro: 'Full document '.repeat(10_000) });
  const bytes = Buffer.from(`\uFEFF${JSON.stringify(published)}`);
  f.repository.save(published);
  fs.writeFileSync(path.join(f.repository.dir, `${published.id}.json`), bytes);
  f.writeDraft(record({ revision: 5, status: 'draft', intro: published.intro }));
  t.mock.method(f.repository, 'getAllFreshSnapshots', () => {
    throw new Error('Metadata reads must not materialize the full version inventory');
  });
  let leaseChecks = 0;
  const snapshots = f.store.read({
    metadataOnly: true,
    assertHeld() {
      leaseChecks += 1;
    },
  });
  assert.equal(snapshots.length, 2);
  assert.ok(leaseChecks >= 2);
  for (const snapshot of snapshots) {
    assert.equal(Object.hasOwn(snapshot, 'bytes'), false);
    assert.equal(Object.hasOwn(snapshot.record, 'instructionContent'), false);
    assert.equal(Object.hasOwn(snapshot.record, 'intro'), false);
    assert.equal(Object.hasOwn(snapshot.record, 'taxonomyMeta'), false);
    assert.equal(snapshot.fingerprint.length, 64);
  }
  const saved = snapshots.find(snapshot => snapshot.version === 'published');
  assert.deepEqual(f.store.readBytes(saved), bytes);
  saved.record.title = 'Changed projection';
  assert.equal(f.repository.getById(saved.id).title, published.title);
});

test('metadata serialization preserves full content and deletes absent projected fields', t => {
  const f = fixture(t);
  const published = record({
    taxonomyMeta: { note: 'Remove on rollback' },
    custom: { keep: true },
  });
  f.repository.save(published);
  const before = fs.readFileSync(path.join(f.repository.dir, `${published.id}.json`));
  const snapshot = f.store.read({ metadataOnly: true })[0];
  const next = { ...snapshot.record, primaryCategoryId: 'W02', tagIds: ['T02'], revision: 5 };
  delete next.taxonomyMeta;
  const serialized = JSON.parse(f.store.serialize(snapshot, next).toString('utf8'));
  const expected = { ...published, primaryCategoryId: 'W02', tagIds: ['T02'], revision: 5 };
  delete expected.taxonomyMeta;
  assert.deepEqual(serialized, expected);
  assert.deepEqual(fs.readFileSync(path.join(f.repository.dir, `${published.id}.json`)), before);
});

test('metadata snapshots reject concurrent edits and oversized bodies before allocating their contents', t => {
  const f = fixture(t);
  const published = record();
  f.repository.save(published);
  const file = path.join(f.repository.dir, `${published.id}.json`);
  const snapshot = f.store.read({ metadataOnly: true })[0];
  fs.writeFileSync(file, JSON.stringify({ ...published, title: 'Concurrent edit' }));
  for (const read of [
    () => f.store.readBytes(snapshot),
    () => f.store.serialize(snapshot, { ...snapshot.record, revision: 5 }),
  ]) {
    assert.throws(read, { code: 'TAXONOMY_BULK_PREVIEW_CONFLICT', status: 409 });
  }
  fs.truncateSync(file, 8 * 1024 * 1024 + 1);
  const reading = t.mock.method(fs, 'readSync', () => {
    throw new Error('Oversized body must be rejected before reading');
  });
  assert.throws(
    () => f.store.read({ metadataOnly: true }),
    error => {
      assert.equal(error.code, 'TAXONOMY_BINDING_STORAGE_ERROR');
      assert.match(error.cause.message, /at most 8 MiB/u);
      return true;
    },
  );
  assert.equal(reading.mock.callCount(), 0);
});

test('metadata source re-reads reject nonregular paths before opening them', t => {
  const f = fixture(t);
  f.repository.save(record());
  const snapshot = f.store.read({ metadataOnly: true })[0];
  const file = path.join(f.repository.dir, `${snapshot.id}.json`);
  fs.rmSync(file);
  fs.mkdirSync(file);
  const opening = t.mock.method(fs, 'openSync', () => {
    throw new Error('Nonregular source must not be opened');
  });
  assert.throws(
    () => f.store.readBytes(snapshot),
    error => {
      assert.equal(error.code, 'TAXONOMY_BINDING_STORAGE_ERROR');
      assert.match(error.cause.message, /regular file/u);
      return true;
    },
  );
  assert.equal(opening.mock.callCount(), 0);
});

test('writes exact bytes atomically and refreshes the published cache only when requested', t => {
  const f = fixture(t);
  f.repository.save(record());
  const snapshot = f.store.read()[0];
  const changed = { ...snapshot.record, tagIds: ['T02'], revision: 5 };
  const bytes = f.store.serialize(snapshot, changed);
  let checks = 0;
  f.store.writeBytes(snapshot, bytes, {
    assertHeld: () => {
      checks += 1;
    },
  });
  assert.ok(checks >= 2);
  assert.deepEqual(fs.readFileSync(path.join(f.repository.dir, `${snapshot.id}.json`)), bytes);
  assert.deepEqual(f.repository.getById(snapshot.id).tagIds, ['T01']);
  f.store.refresh();
  assert.deepEqual(f.repository.getById(snapshot.id), changed);
});

test('rejects forged snapshots, changed IDs, invalid bytes and missing lease ownership', t => {
  const f = fixture(t);
  f.repository.save(record());
  const snapshot = f.store.read()[0];
  const original = Buffer.from(snapshot.bytes);
  const held = { assertHeld() {} };
  assert.throws(() => f.store.serialize({ ...snapshot }, snapshot.record));
  assert.throws(() => f.store.serialize(snapshot, { ...snapshot.record, id: 'another' }));
  assert.throws(() => f.store.writeBytes(snapshot, original));
  for (const bytes of [
    Buffer.from('{}'),
    Buffer.from([0xff]),
    Buffer.from('{broken'),
    Buffer.from(JSON.stringify({ ...snapshot.record, id: '../escape' })),
  ]) {
    assert.throws(() => f.store.writeBytes(snapshot, bytes, held));
  }
  snapshot.id = 'another';
  assert.throws(() => f.store.writeBytes(snapshot, original, held));
  assert.deepEqual(fs.readFileSync(path.join(f.repository.dir, 'instruction-X7.json')), original);
  assert.deepEqual(fs.readdirSync(f.repository.dir), ['instruction-X7.json']);
});

test('draft writes cannot change their status or recreate a missing version', t => {
  const f = fixture(t);
  f.writeDraft(record({ revision: 5, status: 'draft' }));
  const snapshot = f.store.read()[0];
  assert.throws(() => f.store.serialize(snapshot, { ...snapshot.record, status: 'published' }));
  fs.rmSync(f.draftFile(snapshot.id));
  assert.throws(() => f.store.writeBytes(snapshot, snapshot.bytes, { assertHeld() {} }), {
    code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
  });
  assert.equal(fs.existsSync(f.draftFile(snapshot.id)), false);
});

test('a failed regular-file flush or rename retains the original bytes and removes temporary files', t => {
  const f = fixture(t);
  f.repository.save(record());
  const snapshot = f.store.read()[0];
  const bytes = f.store.serialize(snapshot, { ...snapshot.record, tagIds: ['T02'] });
  for (const method of ['fsyncSync', 'renameSync']) {
    const mock = t.mock.method(fs, method, () => {
      throw new Error(`Simulated ${method} failure`);
    });
    assert.throws(() => f.store.writeBytes(snapshot, bytes, { assertHeld() {} }), {
      code: 'TAXONOMY_BINDING_STORAGE_ERROR',
    });
    assert.deepEqual(
      fs.readFileSync(path.join(f.repository.dir, `${snapshot.id}.json`)),
      snapshot.bytes,
    );
    assert.deepEqual(fs.readdirSync(f.repository.dir), ['instruction-X7.json']);
    mock.mock.restore();
  }
});

test(
  'a parent-directory flush failure reports the committed rename and permits exact compensation',
  { skip: process.platform === 'win32' },
  t => {
    const f = fixture(t);
    f.repository.save(record());
    const before = f.store.read()[0];
    const bytes = f.store.serialize(before, { ...before.record, tagIds: ['T02'] });
    const sync = fs.fsyncSync;
    const failure = new Error('Simulated directory flush failure');
    const mock = t.mock.method(fs, 'fsyncSync', descriptor => {
      if (fs.fstatSync(descriptor).isDirectory()) throw failure;
      return sync(descriptor);
    });

    assert.throws(
      () => f.store.writeBytes(before, bytes, { assertHeld() {} }),
      error => error.code === 'TAXONOMY_BINDING_STORAGE_ERROR' && error.cause === failure,
    );
    const file = path.join(f.repository.dir, `${before.id}.json`);
    assert.deepEqual(fs.readFileSync(file), bytes);
    assert.deepEqual(f.repository.getById(before.id), before.record);
    assert.deepEqual(fs.readdirSync(f.repository.dir), ['instruction-X7.json']);

    mock.mock.restore();
    const current = f.store.read()[0];
    f.store.writeBytes(current, before.bytes, { assertHeld() {} });
    f.store.refresh();
    assert.deepEqual(fs.readFileSync(file), before.bytes);
    assert.deepEqual(f.repository.getById(before.id), before.record);
  },
);

test('a lost lease immediately before rename prevents committing changed assignments', t => {
  const f = fixture(t);
  f.repository.save(record());
  const snapshot = f.store.read()[0];
  const bytes = f.store.serialize(snapshot, { ...snapshot.record, tagIds: ['T02'] });
  let checks = 0;
  assert.throws(
    () =>
      f.store.writeBytes(snapshot, bytes, {
        assertHeld() {
          checks += 1;
          if (checks === 2) throw new Error('Lease lost');
        },
      }),
    /назначения инструкций/u,
  );
  assert.equal(checks, 2);
  assert.deepEqual(
    fs.readFileSync(path.join(f.repository.dir, `${snapshot.id}.json`)),
    snapshot.bytes,
  );
  assert.deepEqual(fs.readdirSync(f.repository.dir), ['instruction-X7.json']);
});

test('unsafe IDs, mismatched filenames and malformed draft records fail strict reads', t => {
  const f = fixture(t);
  const file = path.join(f.repository.dir, 'instruction-X7.json');
  for (const value of [
    record({ id: '../escape' }),
    record({ id: 'another' }),
    record({ revision: '4' }),
  ]) {
    fs.writeFileSync(file, JSON.stringify(value));
    assert.throws(() => f.store.read(), { code: 'INSTRUCTION_STORAGE_ERROR' });
  }
  fs.rmSync(file);
  fs.mkdirSync(f.draftsDirectory);
  for (const value of [
    record({ status: 'draft', revision: 0 }),
    record({ status: 'published', revision: 5 }),
    {},
  ]) {
    fs.writeFileSync(f.draftFile('instruction-X7'), JSON.stringify(value));
    assert.throws(() => f.store.read(), { code: 'INSTRUCTION_DRAFT_STORAGE_ERROR' });
  }
});

test('non-regular instruction entries cannot enter the version set', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.repository.dir, 'unexpected.json'));
  assert.throws(() => f.store.read(), { code: 'INSTRUCTION_STORAGE_ERROR' });
});

test(
  'symlink directories cannot enter the version set',
  { skip: process.platform === 'win32' },
  t => {
    const f = fixture(t);
    fs.symlinkSync(f.repository.dir, f.draftsDirectory, 'dir');
    assert.throws(() => f.store.read(), { code: 'INSTRUCTION_DRAFT_STORAGE_ERROR' });
  },
);

test('an incomplete journal blocks all shared-lease writers and permits explicit recovery only', t => {
  const f = fixture(t);
  const current = record();
  f.repository.save(current);
  const registry = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(f.directory, 'registry', 'instruction-taxonomy.json'),
  });
  const editor = createInstructionEditorService({
    repository: f.repository,
    draftsDirectory: f.draftsDirectory,
    taxonomyRepository: registry,
  });
  const journal = createInstructionTaxonomyBulkJournal({ directory: registry.operationsDirectory });
  const snapshot = f.store.read()[0];
  const createdAt = new Date().toISOString();
  const plan = journal.savePreview({
    kind: 'apply',
    actor: 'admin',
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 60_000).toISOString(),
    registryRevision: 0,
    action: { type: 'set-section', sectionId: 'W01' },
    ids: [snapshot.id],
    counts: { documents: 1, changed: 0 },
    rows: [],
    inventory: [{ id: snapshot.id, version: snapshot.version, fingerprint: snapshot.fingerprint }],
    slots: [],
  });
  journal.begin(plan.id);
  const options = { repository: f.repository, taxonomyRepository: registry };
  const operations = [
    () => registry.withLock(() => assert.fail('Pending callback ran')),
    () => registry.update(state => state, { expectedRevision: 0 }),
    () => editor.save(current.id, { revision: 4 }),
    () => editor.remove(current.id, { revision: 4 }),
    () => editor.discardDraft(current.id, { revision: 4 }),
    () => editor.unpublish(current.id, { revision: 4 }),
    () => saveInstructionWithTaxonomy(f.repository, current, { taxonomyRepository: registry }),
    () => rollbackInstruction(current.id, options),
  ];
  for (const operation of operations) {
    assert.throws(operation, { code: 'TAXONOMY_BULK_PENDING', status: 409 });
  }
  assert.equal(
    registry.withLock(() => 'recovery', { allowPendingOperation: true }),
    'recovery',
  );
  assert.equal(registry.read().revision, 0);
  assert.deepEqual(f.repository.getByIdFresh(current.id), current);
  assert.equal(editor.get(current.id).instruction.id, current.id);
});

test('a malformed active journal freezes normal writers without creating instruction writes', t => {
  const f = fixture(t);
  const registry = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(f.directory, 'registry', 'instruction-taxonomy.json'),
  });
  registry.withLock(() => {});
  assert.equal(fs.existsSync(registry.operationsDirectory), false);
  fs.mkdirSync(registry.operationsDirectory);
  fs.writeFileSync(path.join(registry.operationsDirectory, 'active.json'), '{broken');
  assert.throws(() => registry.withLock(() => assert.fail('Malformed journal was ignored')), {
    code: 'TAXONOMY_BULK_STORAGE_ERROR',
    status: 500,
  });
  assert.equal(
    registry.withLock(() => 'recovery', { allowPendingOperation: true }),
    'recovery',
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, 'registry', 'instruction-taxonomy.json')),
    false,
  );
});
