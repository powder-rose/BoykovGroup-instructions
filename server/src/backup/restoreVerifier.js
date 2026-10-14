import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function verifyBackupChecksum({ archivePath, checksumPath }) {
  if (!archivePath || !checksumPath) {
    throw new Error('archivePath and checksumPath are required');
  }

  const checksumFile = await readFile(checksumPath, 'utf8');

  const expected = checksumFile.trim().split(/\s+/u)[0];

  if (!expected) {
    return false;
  }

  const archive = await readFile(archivePath);

  const actual = createHash('sha256').update(archive).digest('hex');

  return actual === expected;
}
