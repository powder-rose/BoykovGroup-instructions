import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');

test('backup verifier accepts valid checksum and rejects corrupted archive', async () => {
  const verifierPath = path.join(ROOT, 'src', 'backup', 'restoreVerifier.js');

  assert.equal(fs.existsSync(verifierPath), true, 'restore verifier must exist');

  const { verifyBackupChecksum } = await import(pathToFileURL(verifierPath).href);

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-checksum-'));

  const archivePath = path.join(sandbox, 'backup.tar.gz');

  const checksumPath = `${archivePath}.sha256`;

  try {
    fs.writeFileSync(archivePath, 'backup-content');

    const crypto = await import('node:crypto');

    const hash = crypto.createHash('sha256').update('backup-content').digest('hex');

    fs.writeFileSync(checksumPath, `${hash}  backup.tar.gz\n`);

    assert.equal(
      await verifyBackupChecksum({
        archivePath,

        checksumPath,
      }),
      true,
    );

    fs.writeFileSync(archivePath, 'corrupted-content');

    assert.equal(
      await verifyBackupChecksum({
        archivePath,

        checksumPath,
      }),
      false,
    );
  } finally {
    fs.rmSync(sandbox, {
      recursive: true,

      force: true,
    });
  }
});
