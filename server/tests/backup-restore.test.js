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

    const accountDataDir = path.join(sourceRoot, 'server', 'data');
    fs.mkdirSync(accountDataDir, { recursive: true });
    const companyProfiles = {
      version: 1,
      profiles: { 'fixture-user': { companyProfile: { companyName: 'Тестовая организация' } } },
      outbox: [{ id: 'pending-email', user: { id: 'fixture-user' } }],
    };
    fs.writeFileSync(
      path.join(accountDataDir, 'company-profiles.json'),
      JSON.stringify(companyProfiles),
      { mode: 0o600 },
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

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(path.join(restoreRoot, 'server/data/company-profiles.json'), 'utf8'),
      ),
      companyProfiles,
    );
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(result.archivePath).mode & 0o777, 0o600);
    }
  } finally {
    fs.rmSync(sandbox, {
      recursive: true,

      force: true,
    });
  }
});

test('backup allows a fresh installation without account storage but requires instruction data', async () => {
  const { createBackup } = await import('../src/backup/backupService.js');
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-backup-fresh-'));
  const sourceRoot = path.join(sandbox, 'app');
  const outputDir = path.join(sandbox, 'backups');
  const dataDir = path.join(sourceRoot, 'server', 'src', 'data');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'critical.json'), '{}');
    const result = await createBackup({ sourceRoot, outputDir });
    assert.ok(fs.existsSync(result.archivePath));
    fs.rmSync(dataDir, { recursive: true });
    await assert.rejects(createBackup({ sourceRoot, outputDir }), { code: 'ENOENT' });
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
