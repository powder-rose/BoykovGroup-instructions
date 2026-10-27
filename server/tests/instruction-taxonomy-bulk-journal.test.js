import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertNoPendingTaxonomyBulkOperation,
  createInstructionTaxonomyBulkJournal,
} from '../src/services/instructionTaxonomyBulkJournal.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-journal-'));
  const directory = path.join(root, 'operations');
  let timestamp = Date.parse('2026-10-23T09:00:00.000Z');
  const create = () => createInstructionTaxonomyBulkJournal({ directory, now: () => timestamp });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    directory,
    journal: create(),
    create,
    advance(milliseconds) {
      timestamp += milliseconds;
    },
    activeFile: path.join(directory, 'active.json'),
    planFile: operationId => path.join(directory, 'plans', `${operationId}.json`),
  };
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function input(overrides = {}) {
  const before = Buffer.from(
    '\uFEFF' +
      JSON.stringify({
        id: 'doc-one',
        primaryCategoryId: 'P01',
        title: 'Приватное тело инструкции',
        revision: 4,
      }),
  );
  const after = Buffer.from(
    JSON.stringify({
      id: 'doc-one',
      primaryCategoryId: 'P02',
      title: 'Приватное тело инструкции',
      revision: 5,
    }),
  );
  return {
    kind: 'apply',
    actor: 'admin-one',
    createdAt: '2026-10-23T09:00:00.000Z',
    expiresAt: '2026-10-23T09:30:00.000Z',
    registryRevision: 9,
    action: { type: 'set-section', sectionId: 'P02' },
    ids: ['doc-one'],
    counts: { selected: 1, changed: 1, unchanged: 0 },
    rows: [{ id: 'doc-one', status: 'change' }],
    inventory: [{ id: 'doc-one', version: 'published', fingerprint: hash(before) }],
    slots: [
      {
        id: 'doc-one',
        version: 'published',
        beforeBase64: before.toString('base64'),
        afterBase64: after.toString('base64'),
        beforeHash: hash(before),
        afterHash: hash(after),
      },
    ],
    ...overrides,
  };
}

function result(plan, status = 'committed') {
  return {
    operationId: plan.id,
    status,
    kind: plan.kind,
    counts: plan.counts,
    completedAt: '2026-10-23T09:01:00.000Z',
  };
}

function emulatePlatform(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { ...descriptor, value });
  t.after(() => Object.defineProperty(process, 'platform', descriptor));
}

test('empty history and pending guard are read-only; operation paths accept only server UUIDs', t => {
  const f = fixture(t);
  assert.deepEqual(f.journal.list(), { items: [], total: 0, page: 1, pageSize: 20 });
  assert.equal(f.journal.getActive(), null);
  assertNoPendingTaxonomyBulkOperation(f.directory);
  for (const id of ['../secret', '/etc/passwd', 'not-a-uuid', '']) {
    assert.throws(() => f.journal.read(id), { code: 'INVALID_TAXONOMY_BULK_OPERATION' });
  }
  assert.deepEqual(fs.readdirSync(f.root), []);
});

test('missing-tag journal actions require a complete unique assignment map with bounded fields', t => {
  const f = fixture(t);
  const action = { type: 'assign-missing-tags', assignments: [{ id: 'doc-one', tagIds: ['T02'] }] };
  const plan = f.journal.savePreview(input({ action }));
  assert.deepEqual(f.create().read(plan.id).action, action);
  for (const assignments of [
    [],
    [{ id: 'other', tagIds: ['T02'] }],
    [{ id: 'doc-one', tagIds: [] }],
    [...action.assignments, ...action.assignments],
    [{ ...action.assignments[0], extra: true }],
  ]) {
    assert.throws(() =>
      f.journal.savePreview(input({ action: { type: 'assign-missing-tags', assignments } })),
    );
  }
});

test('previews retain exact backup bytes across restart and assign immutable server operation IDs', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  assert.match(plan.id, /^[0-9a-f-]{36}$/u);
  assert.equal(plan.status, 'preview');
  assert.equal(f.create().read(plan.id).slots[0].beforeBase64, input().slots[0].beforeBase64);
  plan.slots[0].beforeBase64 = 'changed returned view';
  assert.equal(f.create().read(plan.id).slots[0].beforeBase64, input().slots[0].beforeBase64);
  assert.throws(() => f.journal.savePreview({ ...input(), id: plan.id }), {
    code: 'INVALID_TAXONOMY_BULK_OPERATION',
  });
  assert.deepEqual(fs.readdirSync(path.dirname(f.planFile(plan.id))), [`${plan.id}.json`]);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(f.planFile(plan.id)).mode & 0o777, 0o600);
    assert.equal(fs.statSync(f.directory).mode & 0o777, 0o700);
  }
});

test('invalid snapshots, mismatched hashes and envelope fields cannot create a preview', t => {
  const f = fixture(t);
  const valid = input();
  for (const plan of [
    { ...valid, unexpected: true },
    { ...valid, actor: '' },
    { ...valid, counts: new Date() },
    { ...valid, ids: ['doc-one', 'doc-one'] },
    { ...valid, expiresAt: '2026-10-23T10:00:00.000Z' },
    { ...valid, slots: [{ ...valid.slots[0], afterHash: '0'.repeat(64) }] },
    { ...valid, slots: [{ ...valid.slots[0], beforeBase64: `${valid.slots[0].beforeBase64}\n` }] },
    { ...valid, slots: [{ ...valid.slots[0], id: 'other-document' }] },
  ])
    assert.throws(() => f.journal.savePreview(plan), { code: 'INVALID_TAXONOMY_BULK_OPERATION' });
  assert.deepEqual(fs.readdirSync(f.root), []);
});

test('active operations freeze normal writers until the consumed status is durable', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  assert.equal(f.journal.begin(plan.id).status, 'applying');
  assert.equal(f.create().getActive().operationId, plan.id);
  assert.throws(
    () => f.journal.assertNoPending(),
    error => {
      assert.equal(error.code, 'TAXONOMY_BULK_PENDING');
      assert.equal(error.status, 409);
      assert.deepEqual(error.details, { operationId: plan.id });
      return true;
    },
  );
  assert.throws(() => f.journal.clearActive(plan.id), { code: 'TAXONOMY_BULK_PENDING' });
  f.journal.finish(plan.id, { status: 'committed', result: result(plan) });
  assert.equal(f.create().read(plan.id).status, 'committed');
  assert.throws(() => f.journal.assertNoPending(), { code: 'TAXONOMY_BULK_PENDING' });
  assert.equal(f.journal.clearActive(plan.id), true);
  assert.equal(f.journal.clearActive(plan.id), false);
  f.journal.assertNoPending();
  assert.throws(() => f.journal.begin(plan.id), { code: 'TAXONOMY_BULK_CONSUMED' });
  const bytes = fs.readFileSync(f.planFile(plan.id));
  assert.equal(f.journal.finish(plan.id, { status: 'committed' }).status, 'committed');
  assert.deepEqual(fs.readFileSync(f.planFile(plan.id)), bytes);
});

test('a failed operation can be recovered while its active marker remains, but never replayed', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  f.journal.begin(plan.id);
  f.journal.finish(plan.id, {
    status: 'failed',
    error: { code: 'WRITE_FAILED', message: 'Требуется восстановление' },
  });
  assert.throws(() => f.journal.begin(plan.id), { code: 'TAXONOMY_BULK_PENDING' });
  f.journal.finish(plan.id, { status: 'recovered', recoveredAt: '2026-10-23T09:02:00.000Z' });
  f.journal.clearActive(plan.id);
  assert.equal(f.journal.read(plan.id).status, 'recovered');
  assert.throws(() => f.journal.finish(plan.id, { status: 'committed' }), {
    code: 'TAXONOMY_BULK_CONSUMED',
  });
});

test('malformed active markers and damaged operation backups fail closed without reset', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  f.journal.begin(plan.id);
  const validActive = fs.readFileSync(f.activeFile);
  for (const malformed of ['{broken', 'null', '[]']) {
    fs.writeFileSync(f.activeFile, malformed);
    assert.throws(() => f.journal.assertNoPending(), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
    assert.equal(fs.readFileSync(f.activeFile, 'utf8'), malformed);
  }
  fs.writeFileSync(f.activeFile, validActive);
  fs.writeFileSync(f.planFile(plan.id), 'null');
  assert.throws(() => f.journal.read(plan.id), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  fs.writeFileSync(f.planFile(plan.id), JSON.stringify(plan));
  const corrupt = {
    ...f.journal.read(plan.id),
    slots: [{ ...plan.slots[0], afterHash: '0'.repeat(64) }],
  };
  fs.writeFileSync(f.planFile(plan.id), JSON.stringify(corrupt));
  assert.throws(() => f.journal.read(plan.id), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  assert.throws(() => f.journal.assertNoPending(), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  assert.equal(fs.existsSync(f.activeFile), true);
});

test('backup flush failure prevents activation and records that no instruction writes began', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  const originalSync = fs.fsyncSync;
  let injected = false;
  t.mock.method(fs, 'fsyncSync', descriptor => {
    if (!injected && fs.fstatSync(descriptor).isFile()) {
      injected = true;
      throw Object.assign(new Error('Simulated backup flush failure'), { code: 'EIO' });
    }
    return originalSync(descriptor);
  });
  assert.throws(() => f.journal.begin(plan.id), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  assert.equal(injected, true);
  assert.equal(f.journal.getActive(), null);
  assert.equal(f.journal.read(plan.id).status, 'failed');
  assert.equal(f.journal.read(plan.id).error.code, 'JOURNAL_START_FAILED');
  assert.deepEqual(f.journal.read(plan.id).slots, plan.slots);
  assert.deepEqual(fs.readdirSync(path.dirname(f.planFile(plan.id))), [`${plan.id}.json`]);
});

test('active-marker write failure consumes the non-started operation without leaving misleading recovery', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  const originalRename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === f.activeFile) throw new Error('Simulated marker replacement failure');
    return originalRename(from, to);
  });
  assert.throws(() => f.journal.begin(plan.id), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  assert.equal(f.journal.getActive(), null);
  assert.equal(f.journal.read(plan.id).status, 'failed');
  f.journal.assertNoPending();
});

test('terminal replacement failure keeps the applying record and active marker for recovery', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  f.journal.begin(plan.id);
  const original = fs.readFileSync(f.planFile(plan.id));
  const originalRename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === f.planFile(plan.id)) throw new Error('Simulated terminal replacement failure');
    return originalRename(from, to);
  });
  assert.throws(() => f.journal.finish(plan.id, { status: 'committed', result: result(plan) }), {
    code: 'TAXONOMY_BULK_STORAGE_ERROR',
  });
  assert.deepEqual(fs.readFileSync(f.planFile(plan.id)), original);
  assert.throws(() => f.journal.assertNoPending(), { code: 'TAXONOMY_BULK_PENDING' });
  assert.deepEqual(fs.readdirSync(path.dirname(f.planFile(plan.id))), [`${plan.id}.json`]);
});

test('history pagination is stable and expired previews cannot begin', t => {
  const f = fixture(t);
  const first = f.journal.savePreview(input());
  const second = f.journal.savePreview(
    input({ createdAt: '2026-10-23T09:01:00.000Z', expiresAt: '2026-10-23T09:31:00.000Z' }),
  );
  assert.deepEqual(
    f.journal.list({ page: 1, pageSize: 1 }).items.map(plan => plan.id),
    [second.id],
  );
  assert.deepEqual(
    f.journal.list({ page: 2, pageSize: 1 }).items.map(plan => plan.id),
    [first.id],
  );
  assert.equal(f.journal.list({ page: 3, pageSize: 1 }).total, 2);
  f.advance(30 * 60 * 1000);
  assert.throws(() => f.journal.begin(first.id), { code: 'TAXONOMY_BULK_EXPIRED' });
  assert.equal(f.journal.getActive(), null);
});

test('emulated Windows never opens directories for flushing and still rejects regular-file fsync failure', t => {
  const f = fixture(t);
  const originalOpen = fs.openSync;
  const originalSync = fs.fsyncSync;
  let fileSyncs = 0;
  let failNextFileSync = false;
  emulatePlatform(t, 'win32');
  t.mock.method(fs, 'openSync', (file, ...args) => {
    if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory())
      throw new Error('Windows directory handle');
    return originalOpen(file, ...args);
  });
  t.mock.method(fs, 'fsyncSync', descriptor => {
    assert.equal(fs.fstatSync(descriptor).isFile(), true);
    if (failNextFileSync) {
      failNextFileSync = false;
      throw Object.assign(new Error('Windows regular-file flush failed'), { code: 'EPERM' });
    }
    fileSyncs++;
    return originalSync(descriptor);
  });
  const plan = f.journal.savePreview(input());
  assert.equal(fileSyncs, 1);
  failNextFileSync = true;
  assert.throws(() => f.journal.begin(plan.id), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  assert.equal(f.journal.getActive(), null);
  assert.equal(f.journal.read(plan.id).status, 'failed');
});

test('a preview backup cannot be acknowledged before its regular file is flushed', t => {
  const f = fixture(t);
  const originalSync = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', descriptor => {
    if (fs.fstatSync(descriptor).isFile()) {
      throw Object.assign(new Error('Backup was not flushed'), { code: 'EIO' });
    }
    return originalSync(descriptor);
  });
  assert.throws(() => f.journal.savePreview(input()), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  assert.equal(f.journal.getActive(), null);
  assert.equal(f.journal.list().total, 0);
  assert.deepEqual(fs.readdirSync(path.join(f.directory, 'plans')), []);
});

test('a durable active marker with the old preview remains recoverable after a start interruption', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  const originalRename = fs.renameSync;
  let injected = false;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (!injected && to === f.planFile(plan.id)) {
      injected = true;
      throw new Error('Interrupted after activation, before the applying state');
    }
    return originalRename(from, to);
  });
  assert.throws(() => f.journal.begin(plan.id), { code: 'TAXONOMY_BULK_STORAGE_ERROR' });
  assert.equal(f.create().getActive().operationId, plan.id);
  assert.equal(f.create().read(plan.id).status, 'preview');
  assert.throws(() => f.create().assertNoPending(), { code: 'TAXONOMY_BULK_PENDING' });
  assert.throws(() => f.journal.finish(plan.id, { status: 'committed' }), {
    code: 'TAXONOMY_BULK_CONSUMED',
  });
  f.journal.finish(plan.id, { status: 'recovered', recoveredAt: '2026-10-23T09:01:00.000Z' });
  assert.equal(f.journal.clearActive(plan.id), true);
  f.journal.assertNoPending();
});

test('a post-commit directory flush failure leaves the consumed marker for clear-only recovery', t => {
  const f = fixture(t);
  const plan = f.journal.savePreview(input());
  f.journal.begin(plan.id);
  const proxy = path.join(f.root, 'directory-handle-proxy');
  fs.writeFileSync(proxy, 'Directory handle test proxy');
  const originalOpen = fs.openSync;
  const originalClose = fs.closeSync;
  const originalSync = fs.fsyncSync;
  const originalRename = fs.renameSync;
  const directoryFds = new Set();
  let committed = false;
  let injected = false;
  emulatePlatform(t, 'linux');
  t.mock.method(fs, 'openSync', (file, ...args) => {
    if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) {
      const descriptor = originalOpen(proxy, 'r+');
      directoryFds.add(descriptor);
      return descriptor;
    }
    return originalOpen(file, ...args);
  });
  t.mock.method(fs, 'closeSync', descriptor => {
    directoryFds.delete(descriptor);
    return originalClose(descriptor);
  });
  t.mock.method(fs, 'renameSync', (from, to) => {
    originalRename(from, to);
    if (to === f.planFile(plan.id)) committed = true;
  });
  t.mock.method(fs, 'fsyncSync', descriptor => {
    if (committed && !injected && directoryFds.has(descriptor)) {
      injected = true;
      throw Object.assign(new Error('Post-commit directory flush failed'), { code: 'EIO' });
    }
    return originalSync(descriptor);
  });
  assert.throws(() => f.journal.finish(plan.id, { status: 'committed', result: result(plan) }), {
    code: 'TAXONOMY_BULK_STORAGE_ERROR',
  });
  assert.equal(injected, true);
  assert.equal(f.create().read(plan.id).status, 'committed');
  assert.throws(() => f.create().assertNoPending(), { code: 'TAXONOMY_BULK_PENDING' });
  assert.equal(f.journal.clearActive(plan.id), true);
  assert.throws(() => f.journal.begin(plan.id), { code: 'TAXONOMY_BULK_CONSUMED' });
  assert.equal(directoryFds.size, 0);
});
