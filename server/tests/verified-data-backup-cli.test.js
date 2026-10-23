import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runVerifiedDataBackup } from '../scripts/createVerifiedDataBackup.js';

const CLI_FILE = fileURLToPath(new URL('../scripts/createVerifiedDataBackup.js', import.meta.url));

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-verified-backup-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourceRoot = path.join(directory, 'app');
  const outputDir = path.join(directory, 'verified-backup');
  const files = new Map([
    [
      'server/src/data/instructions/document.json',
      Buffer.from('{"id":"document","title":"Инструкция"}\n'),
    ],
    [
      'server/src/data/instruction-drafts/ZG9jdW1lbnQ.json',
      Buffer.from('{"id":"document","revision":2,"status":"draft"}\n'),
    ],
    ['server/data/instruction-taxonomy.json', Buffer.from('{"revision":3}\n')],
    [
      'server/data/instruction-taxonomy-operations/history.json',
      Buffer.from('{"status":"committed"}\n'),
    ],
    [
      'server/uploads/imports/original.docx',
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 255, 127, 13, 10]),
    ],
    ['server/uploads/import-batches/pending/batch.json', Buffer.from('{"pending":true}\n')],
  ]);
  for (const [relative, bytes] of files) {
    const target = path.join(sourceRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  return { directory, sourceRoot, outputDir, files };
}

function argumentsFor(context) {
  return [
    '--source-root',
    context.sourceRoot,
    '--output-dir',
    context.outputDir,
    '--writers-stopped',
  ];
}

function assertSourceIntact(context) {
  for (const [relative, bytes] of context.files) {
    assert.deepEqual(fs.readFileSync(path.join(context.sourceRoot, relative)), bytes, relative);
  }
}

test('verified backup CLI preserves source bytes and verifies isolated recovery including binary uploads', async t => {
  const context = fixture(t);
  const report = await runVerifiedDataBackup(argumentsFor(context));
  assert.equal(report.status, 'verified');
  assert.equal(report.outputDir, fs.realpathSync(context.outputDir));
  assert.equal(report.counts.files, context.files.size);
  assert.ok(report.counts.directories > 0);
  assert.ok(report.counts.bytes > 0);
  for (const file of [report.archivePath, report.checksumPath, report.reportPath]) {
    assert.equal(fs.statSync(file).isFile(), true);
  }
  assert.notEqual(report.restoredRoot, context.sourceRoot);
  for (const [relative, bytes] of context.files) {
    assert.deepEqual(fs.readFileSync(path.join(report.restoredRoot, relative)), bytes, relative);
  }
  const stored = JSON.parse(fs.readFileSync(report.reportPath, 'utf8'));
  assert.equal(stored.status, 'verified');
  assertSourceIntact(context);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(context.outputDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(report.reportPath).mode & 0o777, 0o600);
  }
});

test('verified backup CLI requires explicit stopped-writer acknowledgement before creating output', async t => {
  const context = fixture(t);
  await assert.rejects(
    runVerifiedDataBackup(argumentsFor(context).slice(0, -1)),
    /writers-stopped/u,
  );
  assert.equal(fs.existsSync(context.outputDir), false);
  assertSourceIntact(context);
});

test('verified backup CLI requires both nonempty explicit paths and rejects unknown or positional arguments', async t => {
  const context = fixture(t);
  for (const args of [
    [],
    ['--source-root', context.sourceRoot],
    ['--source-root', '', '--output-dir', context.outputDir, '--writers-stopped'],
    ['--output-dir', context.outputDir, '--writers-stopped'],
    [...argumentsFor(context), '--apply'],
    [...argumentsFor(context), 'unexpected'],
  ]) {
    await assert.rejects(runVerifiedDataBackup(args));
  }
  assert.equal(fs.existsSync(context.outputDir), false);
  assertSourceIntact(context);
});

test('verified backup CLI fails for missing source or a server root passed instead of repository root', async t => {
  const context = fixture(t);
  for (const sourceRoot of [
    path.join(context.directory, 'missing'),
    path.join(context.sourceRoot, 'server'),
  ]) {
    await assert.rejects(
      runVerifiedDataBackup([
        '--source-root',
        sourceRoot,
        '--output-dir',
        context.outputDir,
        '--writers-stopped',
      ]),
    );
    if (fs.existsSync(context.outputDir)) {
      const diagnostic = JSON.parse(
        fs.readFileSync(path.join(context.outputDir, 'recovery.json'), 'utf8'),
      );
      assert.equal(diagnostic.status, 'incomplete');
      fs.rmSync(context.outputDir, { recursive: true });
    }
  }
  assert.equal(fs.existsSync(context.outputDir), false);
  assertSourceIntact(context);
});

test('verified backup CLI refuses existing output and keeps its contents untouched', async t => {
  const context = fixture(t);
  fs.mkdirSync(context.outputDir);
  const existing = path.join(context.outputDir, 'existing.txt');
  fs.writeFileSync(existing, 'retain me');
  await assert.rejects(runVerifiedDataBackup(argumentsFor(context)));
  assert.deepEqual(fs.readdirSync(context.outputDir), ['existing.txt']);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'retain me');
  assertSourceIntact(context);
});

test('verified backup CLI rejects output inside the source without creating it', async t => {
  const context = fixture(t);
  context.outputDir = path.join(context.sourceRoot, 'server', 'data', 'backup-new');
  await assert.rejects(runVerifiedDataBackup(argumentsFor(context)));
  assert.equal(fs.existsSync(context.outputDir), false);
  assertSourceIntact(context);
});

test('verified backup CLI direct invocation prints help without writes and reports fatal failures with exit one', t => {
  const context = fixture(t);
  const help = spawnSync(process.execPath, [CLI_FILE, '--help'], {
    encoding: 'utf8',
    cwd: context.directory,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /REPOSITORY_ROOT/u);
  assert.match(help.stdout, /--writers-stopped/u);
  assert.equal(help.stderr, '');
  const failed = spawnSync(process.execPath, [CLI_FILE, ...argumentsFor(context).slice(0, -1)], {
    encoding: 'utf8',
    cwd: context.directory,
  });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /writers-stopped/u);
  assert.equal(failed.stdout, '');
  assert.equal(fs.existsSync(context.outputDir), false);
  assertSourceIntact(context);
});

test('verified backup CLI direct invocation emits parseable verified artifact locations', t => {
  const context = fixture(t);
  const result = spawnSync(process.execPath, [CLI_FILE, ...argumentsFor(context)], {
    encoding: 'utf8',
    cwd: context.directory,
  });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, 'verified');
  assert.equal(summary.counts.files, context.files.size);
  assert.equal(fs.statSync(summary.archivePath).isFile(), true);
  assert.equal(fs.statSync(summary.reportPath).isFile(), true);
  assertSourceIntact(context);
});
