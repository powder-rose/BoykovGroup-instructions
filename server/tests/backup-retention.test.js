import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');

test('backup retention removes only expired archives', async () => {
  const cleanupPath = path.join(ROOT, 'src', 'backup', 'backupCleanup.js');

  assert.equal(fs.existsSync(cleanupPath), true, 'backup cleanup service must exist');

  const { cleanupExpiredBackups } = await import(pathToFileURL(cleanupPath).href);

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-retention-'));

  try {
    const oldBackup = path.join(sandbox, 'old-backup.tar.gz');

    const freshBackup = path.join(sandbox, 'fresh-backup.tar.gz');

    fs.writeFileSync(oldBackup, 'old');

    fs.writeFileSync(freshBackup, 'fresh');

    const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

    fs.utimesSync(oldBackup, oldDate, oldDate);

    const result = await cleanupExpiredBackups({
      backupDir: sandbox,

      retentionDays: 14,
    });

    assert.ok(result.removed.includes(oldBackup));

    assert.equal(fs.existsSync(oldBackup), false);

    assert.equal(fs.existsSync(freshBackup), true);
  } finally {
    fs.rmSync(sandbox, {
      recursive: true,

      force: true,
    });
  }
});
