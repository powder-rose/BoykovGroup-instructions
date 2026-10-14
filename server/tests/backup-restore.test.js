import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');

test('backup archive can be restored with production data intact', async () => {
  const servicePath = path.join(ROOT, 'src', 'backup', 'backupService.js');

  const { createBackup } = await import(pathToFileURL(servicePath).href);

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-backup-restore-'));

  const sourceRoot = path.join(sandbox, 'app');

  const restoreRoot = path.join(sandbox, 'restore');

  const backupDir = path.join(sandbox, 'backups');

  try {
    fs.mkdirSync(restoreRoot, {
      recursive: true,
    });

    const dataDir = path.join(sourceRoot, 'server', 'src', 'data');

    fs.mkdirSync(dataDir, {
      recursive: true,
    });

    fs.writeFileSync(
      path.join(dataDir, 'critical.json'),
      JSON.stringify({
        restored: true,
      }),
    );

    const result = await createBackup({
      sourceRoot,

      outputDir: backupDir,
    });

    assert.equal(fs.existsSync(result.archivePath), true);

    assert.equal(fs.existsSync(result.checksumPath), true);

    execFileSync('tar', ['-xzf', result.archivePath, '-C', restoreRoot]);

    const restoredFile = path.join(restoreRoot, 'server', 'src', 'data', 'critical.json');

    assert.equal(fs.existsSync(restoredFile), true);

    const restored = JSON.parse(fs.readFileSync(restoredFile, 'utf8'));

    assert.deepEqual(restored, {
      restored: true,
    });
  } finally {
    fs.rmSync(sandbox, {
      recursive: true,

      force: true,
    });
  }
});
