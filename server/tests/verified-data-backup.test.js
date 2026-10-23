import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readBackupInventory } from '../src/backup/backupInventory.js';
import { createBackup } from '../src/backup/backupService.js';
import { createVerifiedDataBackup } from '../src/backup/verifiedBackupService.js';

function fixture(t, { minimal = false } = {}) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-verified-backup-'));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const sourceRoot = path.join(sandbox, 'app');
  const outputDir = path.join(sandbox, 'backup');
  const files = new Map([
    ['server/src/data/instructions/one.json', Buffer.from('{"id":"one","title":"Инструкция"}\r\n')],
  ]);
  if (!minimal) {
    files.set('server/src/data/instruction-drafts/one.json', Buffer.from('{"draft":true}'));
    files.set('server/data/instruction-taxonomy.json', Buffer.from('{"revision":2}'));
    files.set(
      'server/data/instruction-taxonomy-operations/op/backup.bin',
      Buffer.from([0, 255, 2, 3]),
    );
    files.set(
      'server/uploads/imports/Исходник инструкции.docx',
      Buffer.from([0, 255, 128, 10, 13, 1]),
    );
    files.set(
      'server/uploads/import-batches/batch/manifest.json',
      Buffer.from('{"status":"pending"}'),
    );
    files.set('server/uploads/import-batches/batch/pending/source.bin', Buffer.from([128, 0, 77]));
  }
  for (const [relative, bytes] of files) {
    const destination = path.join(sourceRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { mode: 0o600 });
  }
  return { sandbox, sourceRoot, outputDir, files };
}

function readReport(outputDir) {
  return JSON.parse(fs.readFileSync(path.join(outputDir, 'recovery.json'), 'utf8'));
}

function updateArchiveChecksum(result) {
  const bytes = fs.readFileSync(result.archivePath);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(result.checksumPath, `${checksum}  ${path.basename(result.archivePath)}\n`);
  return { ...result, checksum, size: bytes.length };
}

test('verified backup restores exact business data including binary Unicode uploads and import queues', async t => {
  const context = fixture(t);
  fs.mkdirSync(path.join(context.sourceRoot, 'server/uploads/empty-folder'));
  const before = await readBackupInventory(context);
  const result = await createVerifiedDataBackup({ ...context, writersStopped: true });
  assert.equal(result.status, 'verified');
  assert.equal(result.counts.files, context.files.size);
  assert.equal(
    result.counts.bytes,
    [...context.files.values()].reduce((total, bytes) => total + bytes.length, 0),
  );
  assert.equal(result.restoredFingerprint, before.fingerprint);
  assert.equal(result.sourceAfterFingerprint, before.fingerprint);
  assert.equal(result.applicationStarted, false);
  assert.equal(result.sourceWritesPerformed, false);
  assert.equal(readReport(context.outputDir).status, 'verified');
  for (const [relative, bytes] of context.files) {
    assert.deepEqual(fs.readFileSync(path.join(context.sourceRoot, relative)), bytes);
    assert.deepEqual(fs.readFileSync(path.join(result.restoredRoot, relative)), bytes);
  }
  assert.ok(
    fs.statSync(path.join(result.restoredRoot, 'server/uploads/empty-folder')).isDirectory(),
  );
  if (process.platform !== 'win32') {
    for (const item of [result.reportPath, result.archivePath, result.checksumPath])
      assert.equal(fs.statSync(item).mode & 0o777, 0o600);
    assert.equal(fs.statSync(result.outputDir).mode & 0o777, 0o700);
  }
});

test('fresh installation records absent optional storage rather than inventing empty source directories', async t => {
  const context = fixture(t, { minimal: true });
  const result = await createVerifiedDataBackup({ ...context, writersStopped: true });
  assert.deepEqual(result.sourceInventory.includedPaths, ['server/src/data']);
  assert.deepEqual(result.sourceInventory.missingOptionalPaths, ['server/data', 'server/uploads']);
  assert.equal(fs.existsSync(path.join(context.sourceRoot, 'server/data')), false);
  assert.equal(fs.existsSync(path.join(result.restoredRoot, 'server/uploads')), false);
  assert.equal(result.counts.files, 1);
});

test('a source edit made after archive creation remains untouched and prevents verified status', async t => {
  const context = fixture(t, { minimal: true });
  const relative = [...context.files.keys()][0];
  const externalEdit = Buffer.from('operator-new-edit');
  await assert.rejects(
    createVerifiedDataBackup({
      ...context,
      writersStopped: true,
      createArchive: async options => {
        const result = await createBackup(options);
        fs.writeFileSync(path.join(context.sourceRoot, relative), externalEdit);
        return result;
      },
    }),
    /Source changed during backup/u,
  );
  assert.deepEqual(fs.readFileSync(path.join(context.sourceRoot, relative)), externalEdit);
  const report = readReport(context.outputDir);
  assert.equal(report.status, 'incomplete');
  assert.ok(!report.verifiedAt);
  assert.deepEqual(
    fs.readFileSync(path.join(report.restoredRoot, relative)),
    context.files.get(relative),
  );
});

test('corrupted generated archive is rejected before extraction and retained as incomplete evidence', async t => {
  const context = fixture(t, { minimal: true });
  await assert.rejects(
    createVerifiedDataBackup({
      ...context,
      writersStopped: true,
      createArchive: async options => {
        const result = await createBackup(options);
        fs.appendFileSync(result.archivePath, 'corruption');
        return result;
      },
    }),
    /checksum verification failed/u,
  );
  const report = readReport(context.outputDir);
  assert.equal(report.status, 'incomplete');
  assert.equal(fs.existsSync(report.restoredRoot), false);
  assert.equal(fs.existsSync(report.archivePath), true);
});

test('a checksum-valid archive with extra members cannot be extracted as the source snapshot', async t => {
  const context = fixture(t, { minimal: true });
  await assert.rejects(
    createVerifiedDataBackup({
      ...context,
      writersStopped: true,
      createArchive: async options => {
        const result = await createBackup(options);
        const attackRoot = path.join(context.sandbox, 'different-tree');
        fs.cpSync(context.sourceRoot, attackRoot, { recursive: true });
        fs.writeFileSync(path.join(attackRoot, 'server/src/data/extra.json'), '{}');
        execFileSync('tar', ['-czf', result.archivePath, '--', 'server/src/data'], {
          cwd: attackRoot,
        });
        return updateArchiveChecksum(result);
      },
    }),
    /membership does not match/u,
  );
  assert.equal(readReport(context.outputDir).status, 'incomplete');
  assert.equal(fs.existsSync(path.join(context.outputDir, 'restored')), false);
  assert.equal(fs.existsSync(path.join(context.sourceRoot, 'server/src/data/extra.json')), false);
});

test(
  'a checksum-valid archive with a symlink member is rejected before any extraction',
  {
    skip: process.platform === 'win32' ? 'Symbolic links require Windows privileges' : false,
  },
  async t => {
    const context = fixture(t, { minimal: true });
    const outsideFile = path.join(context.sandbox, 'outside');
    fs.writeFileSync(outsideFile, 'must-not-change');
    await assert.rejects(
      createVerifiedDataBackup({
        ...context,
        writersStopped: true,
        createArchive: async options => {
          const result = await createBackup(options);
          const attackRoot = path.join(context.sandbox, 'linked-tree');
          fs.cpSync(context.sourceRoot, attackRoot, { recursive: true });
          const replacement = path.join(attackRoot, [...context.files.keys()][0]);
          fs.unlinkSync(replacement);
          fs.symlinkSync(outsideFile, replacement);
          execFileSync('tar', ['-czf', result.archivePath, '--', 'server/src/data'], {
            cwd: attackRoot,
          });
          return updateArchiveChecksum(result);
        },
      }),
      /link or unsupported archive member/u,
    );
    assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'must-not-change');
    assert.equal(readReport(context.outputDir).status, 'incomplete');
    assert.equal(fs.existsSync(path.join(context.outputDir, 'restored')), false);
  },
);

test(
  'inventory rejects links in included parents, nested entries and hard-linked files',
  {
    skip: process.platform === 'win32' ? 'Symbolic link cases require Windows privileges' : false,
  },
  async t => {
    await t.test('linked included parent', async subtest => {
      const context = fixture(subtest, { minimal: true });
      const actual = path.join(context.sandbox, 'actual-server');
      fs.renameSync(path.join(context.sourceRoot, 'server'), actual);
      fs.symlinkSync(actual, path.join(context.sourceRoot, 'server'), 'dir');
      await assert.rejects(readBackupInventory(context), /real directory/u);
    });
    await t.test('nested symbolic link', async subtest => {
      const context = fixture(subtest, { minimal: true });
      fs.symlinkSync(
        path.join(context.sandbox, 'missing'),
        path.join(context.sourceRoot, 'server/src/data/link'),
      );
      await assert.rejects(readBackupInventory(context), /link or special file/u);
    });
    await t.test('hard-linked file', async subtest => {
      const context = fixture(subtest, { minimal: true });
      fs.linkSync(
        path.join(context.sourceRoot, [...context.files.keys()][0]),
        path.join(context.sourceRoot, 'server/src/data/copy.json'),
      );
      await assert.rejects(readBackupInventory(context), /hard-linked/u);
    });
  },
);

test(
  'inventory refuses special entries and ambiguous filenames without blocking on file reads',
  {
    skip: process.platform === 'win32' ? 'POSIX FIFO and filename cases' : false,
  },
  async t => {
    const context = fixture(t, { minimal: true });
    const fifo = path.join(context.sourceRoot, 'server/src/data/queue.pipe');
    execFileSync('mkfifo', [fifo]);
    await assert.rejects(readBackupInventory(context), /link or special file/u);
    fs.unlinkSync(fifo);
    fs.writeFileSync(path.join(context.sourceRoot, 'server/src/data/line\nbreak.json'), '{}');
    await assert.rejects(readBackupInventory(context), /unambiguous names/u);
  },
);
