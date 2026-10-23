import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createHash } from 'node:crypto';
import { hashBackupFile, verifyBackupChecksum } from '../src/backup/restoreVerifier.js';

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

test('backup hashing preserves binary content across a multi-megabyte archive', async t => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-backup-binary-'));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const archivePath = path.join(sandbox, 'binary.tar.gz');
  const bytes = Buffer.alloc(8 * 1024 * 1024 + 13, 0xa5);
  bytes[0] = 0;
  bytes[bytes.length - 1] = 0xff;
  fs.writeFileSync(archivePath, bytes);
  assert.equal(await hashBackupFile(archivePath), createHash('sha256').update(bytes).digest('hex'));
});

test('backup verifier refuses malformed or oversized checksum records', async t => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-backup-malformed-'));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const archivePath = path.join(sandbox, 'archive.tar.gz');
  const checksumPath = `${archivePath}.sha256`;
  fs.writeFileSync(archivePath, 'archive');
  const checksum = createHash('sha256').update('archive').digest('hex');
  for (const text of [
    '',
    'not-a-hash',
    `${checksum}  archive.tar.gz\nsecond record`,
    'a'.repeat(4097),
  ]) {
    fs.writeFileSync(checksumPath, text);
    assert.equal(await verifyBackupChecksum({ archivePath, checksumPath }), false);
  }
  fs.writeFileSync(checksumPath, `${checksum.toUpperCase()}  archive.tar.gz\n`);
  assert.equal(await verifyBackupChecksum({ archivePath, checksumPath }), true);
});

test(
  'backup verification refuses symbolic links instead of hashing their targets',
  {
    skip:
      process.platform === 'win32'
        ? 'Creating symbolic links may require Windows privileges'
        : false,
  },
  async t => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-backup-linked-'));
    t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
    const archivePath = path.join(sandbox, 'archive.tar.gz');
    const checksumPath = `${archivePath}.sha256`;
    const linkedArchive = path.join(sandbox, 'linked.tar.gz');
    fs.writeFileSync(archivePath, 'archive');
    fs.writeFileSync(
      checksumPath,
      `${createHash('sha256').update('archive').digest('hex')}  archive.tar.gz\n`,
    );
    fs.symlinkSync(archivePath, linkedArchive);
    await assert.rejects(hashBackupFile(linkedArchive), /regular file/u);
    const linkedChecksum = path.join(sandbox, 'linked.sha256');
    fs.symlinkSync(checksumPath, linkedChecksum);
    await assert.rejects(
      verifyBackupChecksum({ archivePath, checksumPath: linkedChecksum }),
      /regular file/u,
    );
  },
);
