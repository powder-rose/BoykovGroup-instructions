import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createInstructionTaxonomyBulkJournal } from '../src/services/instructionTaxonomyBulkJournal.js';

const storageError = { code: 'TAXONOMY_BULK_STORAGE_ERROR' };
const invalidError = { code: 'INVALID_TAXONOMY_BULK_OPERATION' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-journal-payload-'));
  const directory = path.join(root, 'operations');
  const create = () =>
    createInstructionTaxonomyBulkJournal({
      directory,
      now: () => Date.parse('2026-10-26T09:00:00.000Z'),
    });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    directory,
    create,
    journal: create(),
    planFile: operationId => path.join(directory, 'plans', `${operationId}.json`),
    payloadFile: operationId => path.join(directory, 'payloads', `${operationId}.bin`),
  };
}

function version(id = 'doc-one', versionName = 'published') {
  const beforeBytes = Buffer.from(
    '\uFEFF' +
      JSON.stringify({
        id,
        revision: 7,
        title: 'Приватный текст: ёж, 🔧, \u0000, 汉字',
        primaryCategoryId: 'P01',
        tagIds: ['T01'],
      }) +
      '\r\n',
    'utf8',
  );
  const afterBytes = Buffer.from(
    JSON.stringify({
      id,
      revision: 8,
      title: 'Приватный текст: ёж, 🔧, \u0000, 汉字',
      primaryCategoryId: 'P02',
      tagIds: ['T01', 'T02'],
    }) + '\n',
    'utf8',
  );
  return { id, version: versionName, beforeBytes, afterBytes };
}

function input(versions, slots) {
  const ids = [...new Set(versions.map(value => value.id))];
  return {
    kind: 'apply',
    actor: 'payload-admin',
    createdAt: '2026-10-26T09:00:00.000Z',
    expiresAt: '2026-10-26T09:30:00.000Z',
    registryRevision: 0,
    action: { type: 'set-section', sectionId: 'P02' },
    ids,
    counts: { selectedDocuments: ids.length, changedDocuments: slots.length },
    rows: ids.map(id => ({ id, title: 'Назначение раздела' })),
    inventory: versions.map(value => ({
      id: value.id,
      version: value.version,
      fingerprint: sha256(value.beforeBytes),
    })),
    slots,
  };
}

function save(f, versions = [version()]) {
  return f.journal.savePreview(createSlot =>
    input(
      versions,
      versions.map(value => createSlot(value)),
    ),
  );
}

function mutateManifest(f, plan, update) {
  const value = JSON.parse(fs.readFileSync(f.planFile(plan.id), 'utf8'));
  update(value);
  fs.writeFileSync(f.planFile(plan.id), JSON.stringify(value));
}

function assertUnpublished(f) {
  assert.equal(f.journal.getActive(), null);
  assert.equal(f.journal.list().total, 0);
  for (const name of ['plans', 'payloads']) {
    const directory = path.join(f.directory, name);
    if (fs.existsSync(directory)) assert.deepEqual(fs.readdirSync(directory), []);
  }
}

function assertPayloadRejected(f, plan, direction = 'before') {
  const metadata = f.journal.read(plan.id);
  assert.throws(
    () => f.journal.readSlotBytes(metadata, metadata.slots[0], direction),
    storageError,
  );
  assert.throws(() => f.journal.validateSlotBytes(metadata), storageError);
  assert.throws(() => f.journal.begin(plan.id), storageError);
  assert.equal(f.journal.getActive(), null);
  assert.equal(f.journal.read(plan.id).status, 'preview');
}

test('packed previews preserve exact BOM, Unicode and newline bytes across restart without inline bodies', t => {
  const f = fixture(t);
  const versions = [version(), version('doc-one', 'draft'), version('doc-two')];
  const plan = save(f, versions);
  assert.equal(plan.schemaVersion, 2);
  assert.equal(
    plan.payloadBytes,
    versions.reduce(
      (total, value) => total + value.beforeBytes.length + value.afterBytes.length,
      0,
    ),
  );
  const persisted = fs.readFileSync(f.planFile(plan.id), 'utf8');
  assert.equal(persisted.includes('Приватный текст'), false);
  assert.equal(persisted.includes('beforeBase64'), false);
  assert.equal(persisted.includes('afterBase64'), false);
  const restarted = f.create();
  const fresh = restarted.read(plan.id);
  let offset = 0;
  for (const [index, slot] of fresh.slots.entries()) {
    const expected = versions[index];
    assert.equal(slot.beforeOffset, offset);
    assert.equal(slot.afterOffset, offset + expected.beforeBytes.length);
    assert.equal(slot.beforeHash, sha256(expected.beforeBytes));
    assert.equal(slot.afterHash, sha256(expected.afterBytes));
    assert.deepEqual(restarted.readSlotBytes(fresh, slot, 'before'), expected.beforeBytes);
    assert.deepEqual(restarted.readSlotBytes(fresh, slot, 'after'), expected.afterBytes);
    offset = slot.afterOffset + slot.afterLength;
  }
  assert.equal(offset, plan.payloadBytes);
  assert.equal(restarted.validateSlotBytes(fresh), true);
  fresh.slots[0].afterHash = '0'.repeat(64);
  assert.equal(restarted.read(plan.id).slots[0].afterHash, plan.slots[0].afterHash);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(f.payloadFile(plan.id)).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(f.directory, 'payloads')).mode & 0o777, 0o700);
  }
});

test('history and v2 metadata reads never hydrate or read the payload bodies', t => {
  const f = fixture(t);
  const plan = save(f);
  const originalOpen = fs.openSync;
  t.mock.method(fs, 'openSync', (file, ...args) => {
    if (String(file).endsWith('.bin')) throw new Error('Metadata operation read payload bytes');
    return originalOpen(file, ...args);
  });
  assert.equal(f.journal.read(plan.id).schemaVersion, 2);
  assert.equal(f.journal.list().items[0].id, plan.id);
  assert.equal(f.journal.getActive(), null);
});

test('an unchanged selection has a durable zero-byte pack and can begin normally', t => {
  const f = fixture(t);
  const values = [version()];
  const plan = f.journal.savePreview(() => input(values, []));
  assert.equal(plan.payloadBytes, 0);
  assert.deepEqual(plan.slots, []);
  assert.equal(fs.statSync(f.payloadFile(plan.id)).size, 0);
  assert.equal(f.journal.validateSlotBytes(plan), true);
  let assertions = 0;
  assert.equal(f.journal.begin(plan.id, { assertHeld: () => assertions++ }).status, 'applying');
  assert.ok(assertions > 0);
});

test('bounded slot readers handle partial filesystem reads and writes without losing bytes', t => {
  const f = fixture(t);
  const originalOpen = fs.openSync;
  const originalRead = fs.readSync;
  const originalWrite = fs.writeSync;
  const payloadDescriptors = new Set();
  let shortWrites = 0;
  let shortReads = 0;
  t.mock.method(fs, 'openSync', (file, ...args) => {
    const descriptor = originalOpen(file, ...args);
    if (String(file).startsWith(path.join(f.directory, 'payloads') + path.sep))
      payloadDescriptors.add(descriptor);
    else payloadDescriptors.delete(descriptor);
    return descriptor;
  });
  t.mock.method(fs, 'writeSync', (...args) => {
    if (payloadDescriptors.has(args[0]) && Buffer.isBuffer(args[1])) {
      args[3] = Math.min(args[3], 11);
      shortWrites++;
    }
    return originalWrite(...args);
  });
  t.mock.method(fs, 'readSync', (...args) => {
    if (payloadDescriptors.has(args[0])) {
      args[3] = Math.min(args[3], 7);
      shortReads++;
    }
    return originalRead(...args);
  });
  const values = [version()];
  const plan = save(f, values);
  assert.deepEqual(f.journal.readSlotBytes(plan, plan.slots[0], 'before'), values[0].beforeBytes);
  assert.deepEqual(f.journal.readSlotBytes(plan, plan.slots[0], 'after'), values[0].afterBytes);
  assert.equal(f.journal.validateSlotBytes(plan), true);
  assert.ok(shortWrites > 2);
  assert.ok(shortReads > 2);
});

test('payload and manifest publication follow successful payload flush and directory flush', t => {
  const f = fixture(t);
  const originalOpen = fs.openSync;
  const originalSync = fs.fsyncSync;
  const originalRename = fs.renameSync;
  const descriptors = new Map();
  const events = [];
  t.mock.method(fs, 'openSync', (file, ...args) => {
    const descriptor = originalOpen(file, ...args);
    descriptors.set(descriptor, String(file));
    return descriptor;
  });
  t.mock.method(fs, 'fsyncSync', descriptor => {
    const result = originalSync(descriptor);
    events.push({ kind: 'sync', file: descriptors.get(descriptor) });
    return result;
  });
  t.mock.method(fs, 'renameSync', (from, to) => {
    const result = originalRename(from, to);
    events.push({ kind: 'rename', file: String(to) });
    return result;
  });
  const plan = save(f);
  const payloadDirectory = path.join(f.directory, 'payloads');
  const payloadFlush = events.findIndex(
    event => event.kind === 'sync' && path.dirname(event.file) === payloadDirectory,
  );
  const payloadRename = events.findIndex(
    event => event.kind === 'rename' && event.file === f.payloadFile(plan.id),
  );
  const manifestRename = events.findIndex(
    event => event.kind === 'rename' && event.file === f.planFile(plan.id),
  );
  assert.ok(payloadFlush >= 0 && payloadFlush < payloadRename);
  assert.ok(payloadRename < manifestRename);
  assert.equal(
    events.filter(event => event.kind === 'sync' && path.dirname(event.file) === payloadDirectory)
      .length,
    1,
  );
  if (process.platform !== 'win32') {
    assert.ok(
      events.some(
        (event, index) =>
          event.kind === 'sync' &&
          event.file === payloadDirectory &&
          index > payloadRename &&
          index < manifestRename,
      ),
    );
  }
});

test('callback failures and asynchronous builders never leave a published pack or active marker', async t => {
  for (const kind of ['throw', 'promise', 'undefined', 'async']) {
    await t.test(kind, subtest => {
      const f = fixture(subtest);
      let invoked = false;
      const build =
        kind === 'async'
          ? async () => {
              invoked = true;
              return input([], []);
            }
          : createSlot => {
              const values = [version()];
              const slot = createSlot(values[0]);
              if (kind === 'throw') throw new Error('Simulated builder failure');
              if (kind === 'promise') return Promise.resolve(input(values, [slot]));
              return undefined;
            };
      assert.throws(() => f.journal.savePreview(build), { name: 'InstructionEditorError' });
      assert.equal(invoked, false);
      assertUnpublished(f);
    });
  }
});

test('builders cannot alter, drop, reorder or extend the slot metadata written to their pack', async t => {
  for (const kind of ['alter', 'drop', 'reorder', 'extra-field']) {
    await t.test(kind, subtest => {
      const f = fixture(subtest);
      assert.throws(
        () =>
          f.journal.savePreview(createSlot => {
            const values = [version(), version('doc-two')];
            const slots = values.map(value => createSlot(value));
            if (kind === 'alter') slots[0].afterHash = '0'.repeat(64);
            if (kind === 'drop') slots.pop();
            if (kind === 'reorder') slots.reverse();
            if (kind === 'extra-field') slots[0].file = '../../another-file';
            return input(values, slots);
          }),
        invalidError,
      );
      assertUnpublished(f);
    });
  }
});

test('slot writers reject malformed buffers and records without persisting a preview', async t => {
  for (const kind of ['non-buffer', 'wrong-id', 'wrong-json', 'invalid-utf8', 'oversized']) {
    await t.test(kind, subtest => {
      const f = fixture(subtest);
      const value = version();
      if (kind === 'non-buffer') value.beforeBytes = undefined;
      if (kind === 'wrong-id') value.beforeBytes = Buffer.from('{"id":"doc-two"}');
      if (kind === 'wrong-json') value.beforeBytes = Buffer.from('{broken');
      if (kind === 'invalid-utf8') value.beforeBytes = Buffer.from([0xff]);
      if (kind === 'oversized') value.beforeBytes = Buffer.alloc(8 * 1024 * 1024 + 1);
      assert.throws(() => save(f, [value]), { name: 'InstructionEditorError' });
      assertUnpublished(f);
    });
  }
});

test('written bytes are immutable even if a builder later mutates its source buffer', t => {
  const f = fixture(t);
  const value = version();
  const expected = Buffer.from(value.beforeBytes);
  const expectedHash = sha256(expected);
  let lateWriter;
  const plan = f.journal.savePreview(createSlot => {
    lateWriter = createSlot;
    const slot = createSlot(value);
    value.beforeBytes.fill(0);
    const prepared = input([value], [slot]);
    prepared.inventory[0].fingerprint = expectedHash;
    return prepared;
  });
  assert.deepEqual(f.journal.readSlotBytes(plan, plan.slots[0], 'before'), expected);
  assert.throws(() => lateWriter(version('doc-two')), invalidError);
  assert.equal(fs.statSync(f.payloadFile(plan.id)).size, plan.payloadBytes);
});

test('invalid packed offsets, hashes, versions and field sets fail metadata validation', async t => {
  const changes = {
    'negative offset': plan => (plan.slots[0].beforeOffset = -1),
    'fractional length': plan => (plan.slots[0].beforeLength = 0.5),
    'zero length': plan => (plan.slots[0].beforeLength = 0),
    'oversized slot': plan => (plan.slots[0].beforeLength = 8 * 1024 * 1024 + 1),
    'unsafe integer': plan => (plan.slots[0].beforeOffset = Number.MAX_SAFE_INTEGER + 1),
    'overlapping sides': plan => (plan.slots[0].afterOffset = plan.slots[0].beforeOffset),
    'gap before slot': plan => (plan.slots[0].beforeOffset = 1),
    'wrong total': plan => plan.payloadBytes++,
    'payload over limit': plan => (plan.payloadBytes = 1024 * 1024 * 1024 + 1),
    'unknown slot field': plan => (plan.slots[0].file = '/private/outside.bin'),
    'unknown root field': plan => (plan.payloadFile = '/private/outside.bin'),
    'unknown version': plan => (plan.slots[0].version = 'archived'),
    'invalid hash': plan => (plan.slots[0].afterHash = 'z'.repeat(64)),
    'duplicate slot': plan => plan.slots.push({ ...plan.slots[0] }),
    'reordered slots': plan => plan.slots.reverse(),
    'unknown schema': plan => (plan.schemaVersion = 3),
    'server ID replaced': plan => (plan.id = '../../outside'),
  };
  for (const [name, change] of Object.entries(changes)) {
    await t.test(name, subtest => {
      const f = fixture(subtest);
      const plan = save(f, [version(), version('doc-two')]);
      mutateManifest(f, plan, change);
      assert.throws(() => f.journal.read(plan.id), storageError);
      assert.throws(() => f.journal.begin(plan.id), storageError);
      assert.equal(f.journal.getActive(), null);
    });
  }
});

test('missing, truncated, enlarged or hash-corrupted payloads cannot activate an operation', async t => {
  for (const kind of ['missing', 'truncated', 'enlarged', 'corrupted']) {
    await t.test(kind, subtest => {
      const f = fixture(subtest);
      const plan = save(f);
      const file = f.payloadFile(plan.id);
      if (kind === 'missing') fs.unlinkSync(file);
      if (kind === 'truncated') fs.truncateSync(file, plan.payloadBytes - 1);
      if (kind === 'enlarged') fs.appendFileSync(file, Buffer.from([0]));
      if (kind === 'corrupted') {
        const bytes = fs.readFileSync(file);
        bytes[plan.slots[0].afterOffset + 5] ^= 1;
        fs.writeFileSync(file, bytes);
      }
      assertPayloadRejected(f, plan, kind === 'corrupted' ? 'after' : 'before');
    });
  }
});

test('matching payload hashes cannot bypass instruction ID, UTF-8 or JSON verification', async t => {
  for (const kind of ['wrong-id', 'invalid-utf8', 'invalid-json']) {
    await t.test(kind, subtest => {
      const f = fixture(subtest);
      const plan = save(f);
      const bytes = fs.readFileSync(f.payloadFile(plan.id));
      const slot = plan.slots[0];
      const changed = Buffer.from(
        bytes.subarray(slot.afterOffset, slot.afterOffset + slot.afterLength),
      );
      if (kind === 'wrong-id') {
        const offset = changed.indexOf(Buffer.from('doc-one'));
        assert.ok(offset >= 0);
        Buffer.from('doc-two').copy(changed, offset);
      }
      if (kind === 'invalid-utf8') changed[0] = 0xff;
      if (kind === 'invalid-json') changed[0] = '!'.charCodeAt(0);
      changed.copy(bytes, slot.afterOffset);
      fs.writeFileSync(f.payloadFile(plan.id), bytes);
      mutateManifest(f, plan, value => (value.slots[0].afterHash = sha256(changed)));
      assertPayloadRejected(f, plan, 'after');
    });
  }
});

test(
  'payload regular-file and no-follow checks reject file and parent-directory links',
  {
    skip: process.platform === 'win32',
  },
  async t => {
    for (const kind of ['file-symlink', 'parent-symlink', 'hardlink', 'directory']) {
      await t.test(kind, subtest => {
        const f = fixture(subtest);
        const plan = save(f);
        const file = f.payloadFile(plan.id);
        if (kind === 'file-symlink') {
          const outside = path.join(f.root, 'outside.bin');
          fs.renameSync(file, outside);
          fs.symlinkSync(outside, file);
        }
        if (kind === 'parent-symlink') {
          const payloads = path.join(f.directory, 'payloads');
          const outside = path.join(f.root, 'outside-payloads');
          fs.renameSync(payloads, outside);
          fs.symlinkSync(outside, payloads, 'dir');
        }
        if (kind === 'hardlink') fs.linkSync(file, path.join(f.root, 'outside-hardlink.bin'));
        if (kind === 'directory') {
          fs.unlinkSync(file);
          fs.mkdirSync(file);
        }
        assertPayloadRejected(f, plan);
      });
    }
  },
);

test('payload write, flush and publication failures clean unpublished packs without activation', async t => {
  for (const kind of ['write-zero', 'file-flush', 'payload-rename', 'manifest-rename']) {
    await t.test(kind, subtest => {
      const f = fixture(subtest);
      const originalOpen = fs.openSync;
      const originalWrite = fs.writeSync;
      const originalSync = fs.fsyncSync;
      const originalRename = fs.renameSync;
      const descriptors = new Map();
      subtest.mock.method(fs, 'openSync', (file, ...args) => {
        const descriptor = originalOpen(file, ...args);
        descriptors.set(descriptor, String(file));
        return descriptor;
      });
      subtest.mock.method(fs, 'writeSync', (...args) => {
        if (
          kind === 'write-zero' &&
          path.dirname(descriptors.get(args[0]) || '') === path.join(f.directory, 'payloads')
        )
          return 0;
        return originalWrite(...args);
      });
      subtest.mock.method(fs, 'fsyncSync', descriptor => {
        if (
          kind === 'file-flush' &&
          path.dirname(descriptors.get(descriptor) || '') === path.join(f.directory, 'payloads')
        )
          throw new Error('Simulated payload flush failure');
        return originalSync(descriptor);
      });
      subtest.mock.method(fs, 'renameSync', (from, to) => {
        if (
          (kind === 'payload-rename' && String(to).endsWith('.bin')) ||
          (kind === 'manifest-rename' &&
            path.dirname(String(to)) === path.join(f.directory, 'plans'))
        )
          throw new Error('Simulated publication failure');
        return originalRename(from, to);
      });
      assert.throws(() => save(f), storageError);
      assertUnpublished(f);
    });
  }
});

test(
  'post-publication manifest flush failure retains every payload referenced by the visible plan',
  {
    skip: process.platform === 'win32',
  },
  t => {
    const f = fixture(t);
    const originalOpen = fs.openSync;
    const originalSync = fs.fsyncSync;
    const descriptors = new Map();
    t.mock.method(fs, 'openSync', (file, ...args) => {
      const descriptor = originalOpen(file, ...args);
      descriptors.set(descriptor, String(file));
      return descriptor;
    });
    t.mock.method(fs, 'fsyncSync', descriptor => {
      const file = descriptors.get(descriptor);
      if (
        file === path.join(f.directory, 'plans') &&
        fs.readdirSync(file).some(name => name.endsWith('.json'))
      )
        throw new Error('Simulated post-publication directory flush failure');
      return originalSync(descriptor);
    });
    assert.throws(() => save(f), storageError);
    const entries = fs.readdirSync(path.join(f.directory, 'plans'));
    assert.equal(entries.length, 1);
    const operationId = entries[0].slice(0, -5);
    const plan = f.journal.read(operationId);
    assert.equal(fs.existsSync(f.payloadFile(operationId)), true);
    assert.equal(f.journal.validateSlotBytes(plan), true);
    assert.equal(f.journal.getActive(), null);
  },
);
