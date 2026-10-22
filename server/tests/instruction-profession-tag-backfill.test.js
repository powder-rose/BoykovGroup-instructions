import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  applyProfessionTagBackfill,
  createProfessionTagBackfillPlan,
  summarizeProfessionTagBackfill,
} from '../scripts/backfillInstructionProfessionTags.js';
import { planInstructionProfessionTags } from '../src/services/instructionProfessionTagBackfill.js';
import { getInstructionTaxonomyCatalog } from '../src/services/instructionTaxonomyService.js';

const catalog = getInstructionTaxonomyCatalog();
const workIds = catalog.tags.filter(tag => tag.type === 'work').map(tag => tag.id);
const script = fileURLToPath(
  new URL('../scripts/backfillInstructionProfessionTags.js', import.meta.url),
);

function instruction(overrides = {}) {
  return {
    id: 'slesar-test',
    slug: 'slesar-public-path',
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
    primaryCategoryId: 'warehouse',
    tagIds: [workIds[0]],
    taxonomyMeta: {
      categorySource: 'manual',
      tagsSource: 'auto',
      needsReview: true,
      reviewedAt: '2026-10-18T12:00:00Z',
    },
    seoTitle: 'Редакторское название',
    seoDescription: 'Описание из редактора',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст инструкции.' }] }],
    },
    createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-18T12:00:00Z',
    revision: 7,
    ...overrides,
  };
}

function fixture(t, records = [instruction()]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-profession-backfill-'));
  const directory = path.join(root, 'instructions');
  const backup = path.join(root, 'backup');
  fs.mkdirSync(directory);
  const originals = new Map();
  records.forEach((record, index) => {
    const name = `${String(index).padStart(2, '0')}.json`;
    const bytes = Buffer.from(`${index === 0 ? '\uFEFF' : ''}${JSON.stringify(record)}\n`);
    originals.set(name, bytes);
    fs.writeFileSync(path.join(directory, name), bytes, { mode: 0o640 });
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, directory, backup, originals };
}

function readInstruction(directory, file = '00.json') {
  return JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8').replace(/^\uFEFF/u, ''));
}

function assertOriginals(f) {
  for (const [file, bytes] of f.originals) {
    assert.deepEqual(fs.readFileSync(path.join(f.directory, file)), bytes, file);
  }
}

function emulatePlatform(t, platform) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { ...descriptor, value: platform });
  t.after(() => Object.defineProperty(process, 'platform', descriptor));
}

test('profession backfill only appends profession IDs and preserves categories and editorial data', () => {
  const before = instruction();
  const snapshot = structuredClone(before);
  const proposal = planInstructionProfessionTags(before);
  assert.equal(proposal.status, 'change');
  assert.deepEqual(proposal.addedTagIds, ['slesar', 'elektrik']);
  assert.deepEqual(proposal.instruction.tagIds, [workIds[0], 'slesar', 'elektrik']);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(proposal.instruction, {
    ...before,
    tagIds: [workIds[0], 'slesar', 'elektrik'],
    taxonomyMeta: { ...before.taxonomyMeta, needsReview: false, schemaVersion: catalog.version },
  });
  assert.equal(planInstructionProfessionTags(proposal.instruction).status, 'unchanged');

  const legacy = instruction({
    primaryCategoryId: undefined,
    tagIds: undefined,
    taxonomyMeta: undefined,
  });
  const legacyProposal = planInstructionProfessionTags(legacy);
  assert.equal(legacyProposal.status, 'change');
  assert.equal(legacyProposal.instruction.primaryCategoryId, undefined);
  assert.equal(legacyProposal.instruction.taxonomyMeta.categorySource, undefined);
  assert.equal(legacyProposal.instruction.taxonomyMeta.tagsSource, 'auto');
  assert.equal(legacyProposal.instruction.taxonomyMeta.needsReview, true);
});

test('manual selections, unknown provenance and full selections are never replaced', () => {
  for (const tagIds of [[], ['elektrik']]) {
    const record = instruction({ tagIds, taxonomyMeta: { tagsSource: 'manual' } });
    const proposal = planInstructionProfessionTags(record);
    assert.equal(proposal.status, 'manual');
    assert.equal(proposal.instruction, record);
    assert.deepEqual(proposal.addedTagIds, []);
  }
  for (const tagsSource of [undefined, 'unassigned', 'imported']) {
    const record = instruction({ taxonomyMeta: { tagsSource } });
    assert.equal(planInstructionProfessionTags(record).status, 'unknown-source');
  }
  const full = instruction({ tagIds: workIds.slice(0, 5) });
  const proposal = planInstructionProfessionTags(full);
  assert.equal(proposal.status, 'limit');
  assert.equal(proposal.instruction, full);
  assert.deepEqual(proposal.instruction.tagIds, workIds.slice(0, 5));
});

test('malformed taxonomy is reported and work-scope instructions receive no profession guesses', () => {
  for (const tagIds of ['elektrik', ['unknown'], ['elektrik', 'elektrik'], workIds.slice(0, 6)]) {
    const proposal = planInstructionProfessionTags(instruction({ tagIds }));
    assert.equal(proposal.status, 'invalid');
    assert.ok(proposal.error);
  }
  for (const record of [null, [], { id: '' }, instruction({ taxonomyMeta: [] })]) {
    assert.equal(planInstructionProfessionTags(record).status, 'invalid');
  }
  const work = instruction({
    title: 'Инструкция по охране труда при работе со слесарным инструментом',
    profession: 'при работе со слесарным инструментом',
    tagIds: [],
    taxonomyMeta: undefined,
  });
  assert.equal(planInstructionProfessionTags(work).status, 'unchanged');
});

test('CLI defaults to dry-run and leaves all files and their modification times intact', t => {
  const f = fixture(t);
  const before = fs.statSync(path.join(f.directory, '00.json')).mtimeMs;
  const result = spawnSync(process.execPath, [script, '--directory', f.directory], {
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.counts.change, 1);
  assert.equal(report.addedTags, 2);
  assert.equal(fs.statSync(path.join(f.directory, '00.json')).mtimeMs, before);
  assertOriginals(f);
  assert.deepEqual(fs.readdirSync(f.root).sort(), ['instructions']);
  assert.deepEqual(fs.readdirSync(f.directory).sort(), ['00.json']);
});

test('apply stores every original byte, preserves access and manual choices and is idempotent', t => {
  const f = fixture(t, [
    instruction(),
    instruction({ id: 'manual', tagIds: [], taxonomyMeta: { tagsSource: 'manual' } }),
    instruction({ id: 'unknown-source', taxonomyMeta: undefined }),
  ]);
  const before = fs.statSync(path.join(f.directory, '00.json'));
  const plan = createProfessionTagBackfillPlan(f.directory);
  assert.deepEqual(summarizeProfessionTagBackfill(plan).counts, {
    change: 1,
    unchanged: 0,
    manual: 1,
    'unknown-source': 1,
    limit: 0,
    invalid: 0,
  });
  assertOriginals(f);
  assert.deepEqual(applyProfessionTagBackfill(plan, f.backup), {
    applied: 1,
    backupDirectory: f.backup,
  });
  assert.deepEqual(readInstruction(f.directory).tagIds, [workIds[0], 'slesar', 'elektrik']);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, '01.json')), f.originals.get('01.json'));
  assert.deepEqual(fs.readFileSync(path.join(f.directory, '02.json')), f.originals.get('02.json'));
  for (const [file, bytes] of f.originals) {
    const originalPath = path.join(f.backup, 'originals', file);
    assert.deepEqual(fs.readFileSync(originalPath), bytes);
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(originalPath).mode & 0o777, 0o600);
    }
  }
  const after = fs.statSync(path.join(f.directory, '00.json'));
  assert.equal(after.mode & 0o7777, before.mode & 0o7777);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(f.backup).mode & 0o777, 0o700);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(f.backup, 'manifest.json'), 'utf8'));
  assert.equal(manifest.records.length, 3);
  assert.equal(manifest.records[0].originalSha256.length, 64);
  assert.equal(manifest.records[0].candidateSha256.length, 64);
  assert.ok(fs.existsSync(path.join(f.backup, 'completed.json')));
  assert.deepEqual(fs.readdirSync(f.directory).sort(), ['00.json', '01.json', '02.json']);

  const appliedBytes = fs.readFileSync(path.join(f.directory, '00.json'));
  const second = createProfessionTagBackfillPlan(f.directory);
  const secondBackup = path.join(f.root, 'second-backup');
  assert.deepEqual(applyProfessionTagBackfill(second, secondBackup), {
    applied: 0,
    backupDirectory: null,
  });
  assert.equal(fs.existsSync(secondBackup), false);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, '00.json')), appliedBytes);
});

test('invalid records, stale files and file-set changes block apply before creating a backup', t => {
  const invalid = fixture(t, [instruction(), instruction({ id: 'bad', tagIds: ['unknown'] })]);
  assert.throws(
    () =>
      applyProfessionTagBackfill(
        createProfessionTagBackfillPlan(invalid.directory),
        invalid.backup,
      ),
    /Invalid taxonomy records/u,
  );
  assertOriginals(invalid);
  assert.equal(fs.existsSync(invalid.backup), false);

  const stale = fixture(t);
  const stalePlan = createProfessionTagBackfillPlan(stale.directory);
  const edited = Buffer.from(JSON.stringify(instruction({ title: 'New editorial title' })));
  fs.writeFileSync(path.join(stale.directory, '00.json'), edited);
  assert.throws(() => applyProfessionTagBackfill(stalePlan, stale.backup), /snapshot changed/u);
  assert.deepEqual(fs.readFileSync(path.join(stale.directory, '00.json')), edited);
  assert.equal(fs.existsSync(stale.backup), false);

  const added = fixture(t);
  const addedPlan = createProfessionTagBackfillPlan(added.directory);
  fs.writeFileSync(
    path.join(added.directory, 'new.json'),
    JSON.stringify(instruction({ id: 'new' })),
  );
  assert.throws(() => applyProfessionTagBackfill(addedPlan, added.backup), /file set changed/u);
  assertOriginals(added);
  assert.equal(fs.existsSync(added.backup), false);
});

test('backup must be new and outside the instruction directory', t => {
  const f = fixture(t);
  const plan = createProfessionTagBackfillPlan(f.directory);
  assert.throws(() => applyProfessionTagBackfill(plan), /requires a new backup/u);
  assert.throws(
    () => applyProfessionTagBackfill(plan, path.join(f.directory, 'backup')),
    /outside/u,
  );
  fs.mkdirSync(f.backup);
  assert.throws(() => applyProfessionTagBackfill(plan, f.backup), /must not already exist/u);
  assertOriginals(f);
});

test('a partial replacement failure restores the complete original snapshot', t => {
  const f = fixture(t, [instruction(), instruction({ id: 'second' })]);
  const plan = createProfessionTagBackfillPlan(f.directory);
  const originalRename = fs.renameSync;
  let replacements = 0;
  t.mock.method(fs, 'renameSync', (source, destination) => {
    replacements++;
    if (replacements === 2) throw new Error('Simulated rename failure');
    return originalRename(source, destination);
  });
  assert.throws(() => applyProfessionTagBackfill(plan, f.backup), /Rollback: restored/u);
  assertOriginals(f);
  assert.equal(fs.existsSync(path.join(f.backup, 'completed.json')), false);
  const failure = JSON.parse(fs.readFileSync(path.join(f.backup, 'failed.json'), 'utf8'));
  assert.equal(failure.rollbackStatus, 'restored');
  assert.deepEqual(fs.readdirSync(f.directory).sort(), ['00.json', '01.json']);
});

test('a failure after rename still restores the row whose replacement did not return', t => {
  const f = fixture(t);
  const plan = createProfessionTagBackfillPlan(f.directory);
  const originalRename = fs.renameSync;
  let renamed = false;
  t.mock.method(fs, 'renameSync', (source, destination) => {
    originalRename(source, destination);
    if (!renamed) {
      renamed = true;
      throw new Error('Simulated failure after a completed rename');
    }
  });
  assert.throws(() => applyProfessionTagBackfill(plan, f.backup), /Rollback: restored/u);
  assertOriginals(f);
});

test('a completion-record failure rolls back and cannot leave a false success marker', t => {
  const f = fixture(t);
  const plan = createProfessionTagBackfillPlan(f.directory);
  const originalOpen = fs.openSync;
  const originalSync = fs.fsyncSync;
  let completionFd;
  t.mock.method(fs, 'openSync', (...args) => {
    const fd = originalOpen(...args);
    if (args[0] === path.join(f.backup, 'completed.json')) completionFd = fd;
    return fd;
  });
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === completionFd) {
      completionFd = undefined;
      throw new Error('Simulated completion-record fsync failure');
    }
    return originalSync(fd);
  });
  assert.throws(() => applyProfessionTagBackfill(plan, f.backup), /Rollback: restored/u);
  assertOriginals(f);
  assert.equal(fs.existsSync(path.join(f.backup, 'completed.json')), false);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(f.backup, 'failed.json'), 'utf8')).rollbackStatus,
    'restored',
  );
});

test('rollback refuses to overwrite a newer edit and keeps original and candidate backups', t => {
  const f = fixture(t, [instruction(), instruction({ id: 'second' })]);
  const plan = createProfessionTagBackfillPlan(f.directory);
  const originalRename = fs.renameSync;
  const external = Buffer.from(JSON.stringify(instruction({ title: 'Newer external edit' })));
  let replacements = 0;
  t.mock.method(fs, 'renameSync', (source, destination) => {
    replacements++;
    if (replacements === 2) {
      fs.writeFileSync(path.join(f.directory, '00.json'), external);
      throw new Error('Simulated concurrent editor');
    }
    return originalRename(source, destination);
  });
  assert.throws(() => applyProfessionTagBackfill(plan, f.backup), /Rollback: blocked/u);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, '00.json')), external);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, '01.json')), f.originals.get('01.json'));
  assert.deepEqual(
    fs.readFileSync(path.join(f.backup, 'originals', '00.json')),
    f.originals.get('00.json'),
  );
  assert.deepEqual(
    fs.readFileSync(path.join(f.backup, 'candidates', '00.json')),
    plan.records[0].candidate,
  );
  const failure = JSON.parse(fs.readFileSync(path.join(f.backup, 'failed.json'), 'utf8'));
  assert.equal(failure.rollbackStatus, 'blocked');
});

test('emulated Windows skips directory handles while retaining regular-file fsync', t => {
  const f = fixture(t);
  const plan = createProfessionTagBackfillPlan(f.directory);
  const originalOpen = fs.openSync;
  const originalSync = fs.fsyncSync;
  let directoryOpens = 0;
  let fileSyncs = 0;
  emulatePlatform(t, 'win32');
  t.mock.method(fs, 'openSync', (file, ...args) => {
    if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) {
      directoryOpens++;
      throw Object.assign(new Error('Windows directory handles cannot be synced'), {
        code: 'EPERM',
      });
    }
    return originalOpen(file, ...args);
  });
  t.mock.method(fs, 'fsyncSync', fd => {
    assert.equal(fs.fstatSync(fd).isFile(), true);
    fileSyncs++;
    return originalSync(fd);
  });

  assert.deepEqual(applyProfessionTagBackfill(plan, f.backup), {
    applied: 1,
    backupDirectory: f.backup,
  });
  assert.equal(directoryOpens, 0);
  assert.ok(fileSyncs >= 7);
  assert.deepEqual(readInstruction(f.directory).tagIds, [workIds[0], 'slesar', 'elektrik']);
  assert.deepEqual(
    fs.readFileSync(path.join(f.backup, 'originals', '00.json')),
    f.originals.get('00.json'),
  );
});

test('emulated Windows propagates regular-file EPERM during backup before applying changes', t => {
  const f = fixture(t);
  const plan = createProfessionTagBackfillPlan(f.directory);
  const originalOpen = fs.openSync;
  const originalSync = fs.fsyncSync;
  let backupFd;
  let injected = false;
  emulatePlatform(t, 'win32');
  t.mock.method(fs, 'openSync', (file, ...args) => {
    const fd = originalOpen(file, ...args);
    if (file === path.join(f.backup, 'originals', '00.json')) backupFd = fd;
    return fd;
  });
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === backupFd && !injected) {
      injected = true;
      assert.equal(fs.fstatSync(fd).isFile(), true);
      throw Object.assign(new Error('Simulated regular-file fsync EPERM'), { code: 'EPERM' });
    }
    return originalSync(fd);
  });

  assert.throws(
    () => applyProfessionTagBackfill(plan, f.backup),
    error => {
      assert.equal(error.cause.code, 'EPERM');
      assert.match(error.message, /regular-file fsync EPERM.*Rollback: not-needed/u);
      return true;
    },
  );
  assert.equal(injected, true);
  assertOriginals(f);
  assert.equal(fs.existsSync(path.join(f.backup, 'completed.json')), false);
  assert.equal(fs.existsSync(path.join(f.directory, '.profession-tags-backfill.lock')), false);
});

test('emulated POSIX propagates directory fsync errors before applying changes', t => {
  const f = fixture(t);
  const plan = createProfessionTagBackfillPlan(f.directory);
  const proxy = path.join(f.root, 'directory-handle-proxy');
  fs.writeFileSync(proxy, 'Directory handle test proxy');
  const originalOpen = fs.openSync;
  const originalSync = fs.fsyncSync;
  const originalClose = fs.closeSync;
  const directoryFds = new Set();
  let injected = false;
  emulatePlatform(t, 'linux');
  t.mock.method(fs, 'openSync', (file, ...args) => {
    if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) {
      const fd = originalOpen(proxy, 'r+');
      directoryFds.add(fd);
      return fd;
    }
    return originalOpen(file, ...args);
  });
  t.mock.method(fs, 'closeSync', fd => {
    directoryFds.delete(fd);
    return originalClose(fd);
  });
  t.mock.method(fs, 'fsyncSync', fd => {
    if (directoryFds.has(fd) && !injected) {
      injected = true;
      throw Object.assign(new Error('Simulated directory fsync EIO'), { code: 'EIO' });
    }
    return originalSync(fd);
  });

  assert.throws(
    () => applyProfessionTagBackfill(plan, f.backup),
    error => {
      assert.equal(error.cause.code, 'EIO');
      assert.match(error.message, /directory fsync EIO.*Rollback: not-needed/u);
      return true;
    },
  );
  assert.equal(injected, true);
  assert.equal(directoryFds.size, 0);
  assertOriginals(f);
  assert.equal(fs.existsSync(path.join(f.backup, 'completed.json')), false);
  assert.equal(fs.existsSync(path.join(f.directory, '.profession-tags-backfill.lock')), false);
});
