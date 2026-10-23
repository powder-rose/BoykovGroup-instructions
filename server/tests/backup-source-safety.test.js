import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createBackup } from '../src/backup/backupService.js';
import { verifyBackupChecksum } from '../src/backup/restoreVerifier.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-backup-safety-'));
  const sourceRoot = path.join(directory, 'app');
  const outputDir = path.join(directory, 'backups');
  const dataDirectory = path.join(sourceRoot, 'server/src/data');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(path.join(dataDirectory, 'instruction.json'), '{"id":"stable"}\n');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, sourceRoot, outputDir, dataDirectory };
}

test('backup rejects output inside the source before creating nested directories or changing input', async t => {
  const context = fixture(t);
  const before = fs.readFileSync(path.join(context.dataDirectory, 'instruction.json'));
  const outputDir = path.join(context.sourceRoot, 'new/backup');
  await assert.rejects(
    createBackup({ sourceRoot: context.sourceRoot, outputDir }),
    /outside the source root/u,
  );
  assert.equal(fs.existsSync(path.join(context.sourceRoot, 'new')), false);
  assert.deepEqual(fs.readFileSync(path.join(context.dataDirectory, 'instruction.json')), before);
});

test('concurrent backups publish distinct complete archives and preserve existing output files', async t => {
  const context = fixture(t);
  fs.mkdirSync(context.outputDir);
  const existingFile = path.join(context.outputDir, 'existing.tar.gz');
  fs.writeFileSync(existingFile, 'preserved');
  const results = await Promise.all([createBackup(context), createBackup(context)]);
  assert.notEqual(results[0].archivePath, results[1].archivePath);
  for (const result of results) {
    assert.equal(await verifyBackupChecksum(result), true);
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(result.archivePath).mode & 0o777, 0o600);
      assert.equal(fs.statSync(result.checksumPath).mode & 0o777, 0o600);
    }
  }
  assert.equal(fs.readFileSync(existingFile, 'utf8'), 'preserved');
  assert.equal(fs.readdirSync(context.outputDir).filter(name => name.startsWith('.')).length, 0);
  assert.equal(results[0].sourceInventory.fingerprint, results[1].sourceInventory.fingerprint);
});

test('optional upload storage that exists as a file is rejected rather than silently omitted', async t => {
  const context = fixture(t);
  fs.writeFileSync(path.join(context.sourceRoot, 'server/uploads'), 'unexpected file');
  await assert.rejects(createBackup(context), /real directory/u);
  assert.equal(fs.existsSync(context.outputDir), false);
});

test(
  'backup rejects linked data roots, nested links and output paths that resolve into the source',
  {
    skip:
      process.platform === 'win32'
        ? 'Creating symbolic links may require Windows privileges'
        : false,
  },
  async t => {
    const context = fixture(t);
    const linkedOutput = path.join(context.directory, 'output-link');
    fs.symlinkSync(context.sourceRoot, linkedOutput, 'dir');
    await assert.rejects(
      createBackup({
        sourceRoot: context.sourceRoot,
        outputDir: path.join(linkedOutput, 'backups'),
      }),
      /outside the source root/u,
    );
    const linkedFile = path.join(context.dataDirectory, 'linked.json');
    fs.symlinkSync(path.join(context.dataDirectory, 'instruction.json'), linkedFile);
    await assert.rejects(createBackup(context), /link or special/u);
    fs.unlinkSync(linkedFile);
    fs.symlinkSync(context.dataDirectory, path.join(context.sourceRoot, 'server/uploads'), 'dir');
    await assert.rejects(createBackup(context), /real directory/u);
    assert.equal(fs.existsSync(context.outputDir), false);
  },
);

test(
  'failed tar verification leaves no published archive, checksum or private temporary directory',
  { skip: process.platform === 'win32' ? 'Fixture replaces tar with a POSIX executable' : false },
  async t => {
    const context = fixture(t);
    const binaryDirectory = path.join(context.directory, 'bin');
    fs.mkdirSync(binaryDirectory);
    fs.writeFileSync(
      path.join(binaryDirectory, 'tar'),
      '#!/bin/sh\nif [ "$1" = "-czf" ]; then printf invalid > "$2"; exit 0; fi\nexit 2\n',
      { mode: 0o700 },
    );
    const originalPath = process.env.PATH;
    process.env.PATH = `${binaryDirectory}${path.delimiter}${originalPath || ''}`;
    try {
      await assert.rejects(createBackup(context));
      assert.deepEqual(fs.readdirSync(context.outputDir), []);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  },
);
