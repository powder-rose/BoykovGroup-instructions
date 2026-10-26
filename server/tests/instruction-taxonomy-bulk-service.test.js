import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { InstructionEditorError } from '../src/services/instructionEditorError.js';
import { createInstructionTaxonomyBindingStore } from '../src/services/instructionTaxonomyBindingStore.js';
import { createInstructionTaxonomyBulkJournal } from '../src/services/instructionTaxonomyBulkJournal.js';
import { createInstructionTaxonomyBulkService } from '../src/services/instructionTaxonomyBulkService.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-bulk-service-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const draftsDirectory = path.join(directory, 'drafts');
  fs.mkdirSync(draftsDirectory);
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(directory, 'taxonomy.json'),
  });
  const bindingStore = createInstructionTaxonomyBindingStore({ repository, draftsDirectory });
  let clock = Date.parse('2026-10-23T12:00:00.000Z');
  const now = () => clock;
  const journal = createInstructionTaxonomyBulkJournal({
    directory: taxonomyRepository.operationsDirectory,
    now,
  });
  const faults = {
    writes: 0,
    failWrites: new Set(),
    commitThenThrow: false,
    failJournalReadsAfterCommit: false,
    committed: false,
  };
  const store = {
    ...bindingStore,
    writeBytes(snapshot, bytes, options) {
      faults.writes += 1;
      if (faults.failWrites.has(faults.writes))
        throw new Error('Simulated assignment write failure');
      return bindingStore.writeBytes(snapshot, bytes, options);
    },
  };
  const guardedJournal = {
    ...journal,
    read(id) {
      if (faults.failJournalReadsAfterCommit && faults.committed)
        throw new Error('Simulated unreadable committed journal');
      return journal.read(id);
    },
    finish(id, patch) {
      const result = journal.finish(id, patch);
      if (patch.status === 'committed') {
        faults.committed = true;
        if (faults.commitThenThrow) throw new Error('Simulated post-commit durability error');
      }
      return result;
    },
  };
  const service = createInstructionTaxonomyBulkService({
    taxonomyRepository,
    store,
    journal: guardedJournal,
    now,
  });
  const taxonomy = createInstructionTaxonomyRegistryService({
    repository: taxonomyRepository,
    getInstructions: () => bindingStore.read().map(snapshot => snapshot.record),
  });
  function write(id, version = 'published', values = {}) {
    const record = {
      id,
      title: `Инструкция ${id}`,
      slug: `original-${id}-XyZ`,
      status: version === 'draft' ? 'draft' : 'published',
      revision: 4,
      primaryCategoryId: 'P10',
      tagIds: ['sosudy-pod-davleniem'],
      taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual', note: 'retained' },
      seoTitle: 'Неизменённое SEO',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...values,
    };
    fs.writeFileSync(
      version === 'draft'
        ? path.join(draftsDirectory, `${Buffer.from(id).toString('base64url')}.json`)
        : path.join(repository.dir, `${id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    );
    return record;
  }
  const bytes = () =>
    Object.fromEntries(
      bindingStore
        .read()
        .map(snapshot => [`${snapshot.id}:${snapshot.version}`, snapshot.bytes.toString('base64')]),
    );
  const preview = (
    ids = ['first'],
    action = { type: 'set-section', sectionId: 'W01' },
    actor = 'admin-one',
  ) =>
    service.preview(
      { ids, registryRevision: taxonomyRepository.read().revision, includeDrafts: true, action },
      actor,
    );
  const apply = (previewId, actor = 'admin-one') =>
    service.apply({ previewId, confirmed: true }, actor);
  return {
    now,
    service,
    taxonomy,
    taxonomyRepository,
    journal,
    repository,
    bindingStore,
    faults,
    write,
    bytes,
    preview,
    apply,
    advance: milliseconds => {
      clock += milliseconds;
    },
  };
}

test('bulk preview and rollback use metadata snapshots and preserve absent managed fields', t => {
  const f = fixture(t);
  const original = f.write('first', 'published', {
    taxonomyMeta: undefined,
    instructionContent: { type: 'doc', content: [{ type: 'text', text: 'Body '.repeat(20_000) }] },
    custom: { retained: ['all', 'fields'] },
  });
  delete original.taxonomyMeta;
  const file = path.join(f.repository.dir, 'first.json');
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(file)]));
  t.mock.method(f.repository, 'getAllFreshSnapshots', () => {
    throw new Error('Bulk operations must not materialize all full-body snapshots');
  });
  const preview = f.preview();
  const saved = f.journal.read(preview.previewId);
  assert.equal(saved.schemaVersion, 2);
  assert.equal(Object.hasOwn(saved.slots[0], 'beforeBase64'), false);
  assert.equal(Object.hasOwn(saved.slots[0], 'afterBase64'), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, '')), original);
  f.apply(preview.previewId);
  const rollback = f.service.previewRollback(preview.previewId, 'admin-one');
  f.apply(rollback.previewId);
  const restored = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { revision: _revision, ...restoredFields } = restored;
  const { revision: _originalRevision, ...originalFields } = original;
  assert.deepEqual(restoredFields, originalFields);
  assert.equal(Object.hasOwn(restored, 'taxonomyMeta'), false);
});

test('legacy inline previews still apply and create bounded rollback previews', t => {
  const f = fixture(t);
  f.write('first');
  const generated = f.journal.read(f.preview().previewId);
  const {
    id: _id,
    schemaVersion: _schemaVersion,
    payloadBytes: _payloadBytes,
    status: _status,
    ...input
  } = generated;
  input.slots = generated.slots.map(slot => ({
    id: slot.id,
    version: slot.version,
    beforeHash: slot.beforeHash,
    afterHash: slot.afterHash,
    beforeBase64: f.journal.readSlotBytes(generated, slot, 'before').toString('base64'),
    afterBase64: f.journal.readSlotBytes(generated, slot, 'after').toString('base64'),
  }));
  const legacy = f.journal.savePreview(input);
  assert.equal(legacy.schemaVersion, 1);
  assert.equal(f.apply(legacy.id).status, 'committed');
  const rollback = f.service.previewRollback(legacy.id, 'admin-one');
  assert.equal(f.journal.read(rollback.previewId).schemaVersion, 2);
  assert.equal(f.apply(rollback.previewId).status, 'committed');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(f.repository.dir, 'first.json'), 'utf8'))
      .primaryCategoryId,
    'P10',
  );
});

test('bulk previews reject invalid selections, payload injection and noncanonical targets without changing files', t => {
  const f = fixture(t);
  f.write('first');
  const before = f.bytes();
  for (const input of [
    { ids: [] },
    { ids: ['first', 'first'] },
    { ids: Array.from({ length: 5001 }, (_, i) => String(i)) },
    { action: { type: 'set-section', sectionId: 'office' } },
    { action: { type: 'add-tags', tagIds: ['sosudy-pod-davleniem'] } },
    { action: { type: 'remove-tags', tagIds: ['T99'] } },
    { action: { type: 'replace-tags', tagIds: ['T01'] } },
    { includeDrafts: false },
    { actor: 'client-controlled' },
  ]) {
    assert.throws(
      () =>
        f.service.preview(
          {
            ids: ['first'],
            registryRevision: 0,
            includeDrafts: true,
            action: { type: 'set-section', sectionId: 'W01' },
            ...input,
          },
          'admin-one',
        ),
      { status: 400 },
    );
    assert.deepEqual(f.bytes(), before);
  }
  assert.throws(() => f.preview(['missing']), { code: 'TAXONOMY_BULK_SELECTION_CONFLICT' });
  assert.equal(f.journal.list().total, 0);
  assert.equal(f.faults.writes, 0);
});

test('server previews bind actor, expiry, dictionary revision and explicit confirmation before any write', t => {
  const f = fixture(t);
  f.write('first');
  const before = f.bytes();
  const preview = f.preview();
  assert.throws(() => f.apply(preview.previewId, 'different-admin'), {
    code: 'TAXONOMY_BULK_ACTOR_CONFLICT',
  });
  assert.throws(
    () =>
      f.service.apply({ previewId: preview.previewId, confirmed: true, after: {} }, 'admin-one'),
    { status: 400 },
  );
  assert.throws(
    () => f.service.apply({ previewId: preview.previewId, confirmed: false }, 'admin-one'),
    { status: 400 },
  );
  f.advance(30 * 60 * 1000);
  assert.throws(() => f.apply(preview.previewId), { code: 'TAXONOMY_BULK_PREVIEW_EXPIRED' });
  const current = f.preview();
  f.taxonomy.update('tag', 'T01', { name: 'Новое имя' }, { expectedRevision: 0 });
  assert.throws(() => f.apply(current.previewId), { code: 'TAXONOMY_BULK_PREVIEW_CONFLICT' });
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.faults.writes, 0);
});

test('adding a saved draft after preview conflicts before the first assignment write', t => {
  const f = fixture(t);
  f.write('first');
  const preview = f.preview();
  f.write('first', 'draft', { revision: 7 });
  const before = f.bytes();
  assert.throws(() => f.apply(preview.previewId), { code: 'TAXONOMY_BULK_PREVIEW_CONFLICT' });
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.faults.writes, 0);
});

test('a failed batch compensates all known changes to exact original bytes and consumes its preview', t => {
  const f = fixture(t);
  f.write('first');
  f.write('first', 'draft', { revision: 6 });
  const before = f.bytes();
  const preview = f.preview();
  f.faults.failWrites.add(2);
  assert.throws(() => f.apply(preview.previewId), { code: 'TAXONOMY_BULK_APPLY_FAILED' });
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.journal.read(preview.previewId).status, 'failed');
  assert.equal(f.service.status().blocked, false);
  assert.throws(() => f.apply(preview.previewId), { code: 'TAXONOMY_BULK_CONSUMED' });
});

test('a durable committed plan is never compensated when journal completion reports a later error', t => {
  const f = fixture(t);
  f.write('first');
  const preview = f.preview();
  f.faults.commitThenThrow = true;
  assert.throws(() => f.apply(preview.previewId), { code: 'TAXONOMY_BULK_RECOVERY_REQUIRED' });
  const committed = f.bytes();
  assert.equal(f.journal.read(preview.previewId).status, 'committed');
  assert.equal(f.service.status().blocked, true);
  assert.equal(f.faults.writes, 1);
  const result = f.service.recover(
    { operationId: preview.previewId, confirmed: true },
    'admin-one',
  );
  assert.equal(result.status, 'committed');
  assert.deepEqual(f.bytes(), committed);
  assert.equal(f.faults.writes, 1);
  assert.equal(f.service.status().blocked, false);
});

test('an unreadable completion journal freezes safely without guessing whether committed bytes can be undone', t => {
  const f = fixture(t);
  f.write('first');
  const preview = f.preview();
  f.faults.commitThenThrow = true;
  f.faults.failJournalReadsAfterCommit = true;
  assert.throws(() => f.apply(preview.previewId), { code: 'TAXONOMY_BULK_RECOVERY_REQUIRED' });
  assert.equal(f.faults.writes, 1);
  const committed = f.bytes();
  f.faults.failJournalReadsAfterCommit = false;
  assert.equal(f.journal.read(preview.previewId).status, 'committed');
  assert.equal(
    f.service.recover({ operationId: preview.previewId, confirmed: true }, 'admin-one').status,
    'committed',
  );
  assert.deepEqual(f.bytes(), committed);
  assert.equal(f.faults.writes, 1);
});

test('rollback refuses unknown restored codes and a committed rollback cannot be applied twice', t => {
  const f = fixture(t);
  f.write('first');
  const original = f.apply(f.preview().previewId);
  const firstRollback = f.service.previewRollback(original.operationId, 'admin-one');
  const secondRollback = f.service.previewRollback(original.operationId, 'admin-one');
  f.apply(firstRollback.previewId);
  const restored = f.bytes();
  assert.throws(() => f.apply(secondRollback.previewId), {
    code: 'TAXONOMY_BULK_ALREADY_ROLLED_BACK',
  });
  assert.deepEqual(f.bytes(), restored);

  const secondOperation = f.apply(f.preview().previewId);
  f.taxonomy.remove('section', 'P10', { expectedRevision: 0 });
  const committed = f.bytes();
  assert.throws(() => f.service.previewRollback(secondOperation.operationId, 'admin-one'), {
    code: 'INVALID_INSTRUCTION_TAXONOMY',
  });
  assert.deepEqual(f.bytes(), committed);
  assert.equal(f.journal.read(secondOperation.operationId).status, 'committed');
});

test('list uses exact filters across both versions and exposes only paginated assignment fields', t => {
  const f = fixture(t);
  f.write('first');
  f.write('first', 'draft', { primaryCategoryId: 'W01', tagIds: ['T48'], revision: 7 });
  f.write('second', 'published', { primaryCategoryId: 'W01', tagIds: [] });
  const result = f.service.list({
    query: 'ИНСТРУКЦИЯ',
    section: 'W01',
    tag: 'T48',
    page: '1',
    pageSize: '1',
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'first');
  assert.equal(result.items[0].versions.length, 2);
  assert.equal(result.items[0].hasDraft, true);
  assert.equal(result.items[0].publishedUrl, '/instrukciya-po-ohrane-truda/original-first-XyZ');
  assert.equal(Object.hasOwn(result.items[0], 'seoTitle'), false);
  assert.equal(Object.hasOwn(result.items[0], 'bytes'), false);
  for (const filters of [
    { section: 'unknown' },
    { tag: false },
    { pageSize: 101 },
    { page: [] },
    { actor: 'client' },
  ]) {
    assert.throws(() => f.service.list(filters), { status: 400 });
  }
  const history = f.service.history();
  assert.deepEqual(history.items, []);
});

test('losing the lease after one write stops all further writes and leaves explicit recovery available', t => {
  const f = fixture(t);
  f.write('first');
  f.write('first', 'draft', { revision: 6 });
  const before = f.bytes();
  const lease = { lost: false, loseAfterWrite: true, writes: 0 };
  const taxonomyRepository = {
    ...f.taxonomyRepository,
    withLock(callback, options) {
      return f.taxonomyRepository.withLock(
        (registry, assertHeld) =>
          callback(registry, () => {
            if (lease.lost)
              throw new InstructionEditorError('Lease lost', {
                status: 409,
                code: 'TAXONOMY_LOCK_LOST',
              });
            assertHeld();
          }),
        options,
      );
    },
  };
  const store = {
    ...f.bindingStore,
    writeBytes(snapshot, bytes, options) {
      lease.writes += 1;
      f.bindingStore.writeBytes(snapshot, bytes, options);
      if (lease.loseAfterWrite) lease.lost = true;
    },
  };
  const service = createInstructionTaxonomyBulkService({
    taxonomyRepository,
    store,
    journal: f.journal,
    now: f.now,
  });
  const preview = service.preview(
    {
      ids: ['first'],
      registryRevision: 0,
      includeDrafts: true,
      action: { type: 'set-section', sectionId: 'W01' },
    },
    'admin-one',
  );
  assert.throws(
    () => service.apply({ previewId: preview.previewId, confirmed: true }, 'admin-one'),
    { code: 'TAXONOMY_BULK_RECOVERY_REQUIRED' },
  );
  assert.equal(lease.writes, 1);
  assert.equal(service.status().blocked, true);
  lease.lost = false;
  lease.loseAfterWrite = false;
  assert.equal(
    service.recover({ operationId: preview.previewId, confirmed: true }, 'admin-one').status,
    'recovered',
  );
  assert.deepEqual(f.bytes(), before);
  assert.equal(lease.writes, 2);
});

test('an interruption after the active marker but before applying status recovers unchanged original files', t => {
  const f = fixture(t);
  f.write('first');
  const before = f.bytes();
  const preview = f.preview();
  const planFile = path.join(
    f.taxonomyRepository.operationsDirectory,
    'plans',
    `${preview.previewId}.json`,
  );
  const rename = fs.renameSync;
  const mock = t.mock.method(fs, 'renameSync', (source, target) => {
    if (target === planFile) throw new Error('Interrupted before applying status');
    return rename(source, target);
  });
  assert.throws(() => f.apply(preview.previewId), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  mock.mock.restore();
  assert.equal(f.journal.read(preview.previewId).status, 'preview');
  assert.equal(f.service.status().blocked, true);
  assert.equal(f.faults.writes, 0);
  assert.equal(
    f.service.recover({ operationId: preview.previewId, confirmed: true }, 'admin-one').status,
    'recovered',
  );
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.service.status().blocked, false);
});

test('a mismatched active marker kind fails recovery before any instruction write', t => {
  const f = fixture(t);
  f.write('first');
  const preview = f.preview();
  f.journal.begin(preview.previewId);
  const activeFile = path.join(f.taxonomyRepository.operationsDirectory, 'active.json');
  const active = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
  fs.writeFileSync(activeFile, JSON.stringify({ ...active, kind: 'rollback' }));
  const before = f.bytes();
  assert.throws(
    () => f.service.recover({ operationId: preview.previewId, confirmed: true }, 'admin-one'),
    { code: 'TAXONOMY_BULK_RECOVERY_CONFLICT' },
  );
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.faults.writes, 0);
  assert.equal(fs.existsSync(activeFile), true);
});
