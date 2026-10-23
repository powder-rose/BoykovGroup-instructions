import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createVerifiedDataBackup } from '../src/backup/verifiedBackupService.js';

test(
  'verification uses archive names even when tar listing prints non-UTF8 Windows-style bytes',
  {
    skip:
      process.platform === 'win32'
        ? 'POSIX executable shim simulates Windows output on Linux'
        : false,
  },
  async t => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-tar-listing-'));
    t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
    const actualTar = execFileSync('sh', ['-c', 'command -v tar'], { encoding: 'utf8' }).trim();
    const sourceRoot = path.join(sandbox, 'app');
    const outputDir = path.join(sandbox, 'backup');
    const relative = 'server/uploads/imports/Исходник инструкции.docx';
    const file = path.join(sourceRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, 'server/src/data/instructions'), { recursive: true });
    const bytes = Buffer.from([0, 255, 128, 13, 10]);
    fs.writeFileSync(file, bytes, { mode: 0o600 });
    const shimDirectory = path.join(sandbox, 'bin');
    fs.mkdirSync(shimDirectory);
    const log = path.join(sandbox, 'listing-calls.txt');
    const wrapper = `${'#!'}${process.execPath}
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
if (args[0] === '-tzf' || args[0] === '-tvzf') {
  fs.appendFileSync(${JSON.stringify(log)}, args[0] + '\\n');
  process.stdout.write(Buffer.from([0xd1, 0xe8, 0xf0, 0xee, 0xe4, 0xed, 0xe8, 0xea, 10]));
} else {
  const result = spawnSync(${JSON.stringify(actualTar)}, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status === null ? 1 : result.status;
}
`;
    fs.writeFileSync(path.join(shimDirectory, 'tar'), wrapper, { mode: 0o700 });
    const previousPath = process.env.PATH;
    process.env.PATH = `${shimDirectory}${path.delimiter}${previousPath || ''}`;
    t.after(() => {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    });
    const report = await createVerifiedDataBackup({ sourceRoot, outputDir, writersStopped: true });
    assert.equal(report.status, 'verified');
    assert.deepEqual(fs.readFileSync(path.join(report.restoredRoot, relative)), bytes);
    assert.deepEqual(fs.readFileSync(file), bytes);
    assert.equal(fs.readFileSync(log, 'utf8'), '-tzf\n');
  },
);
