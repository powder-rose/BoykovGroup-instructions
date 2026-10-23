import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';

function signature(info) {
  return [info.dev, info.ino, info.size, info.mode, info.mtimeNs, info.ctimeNs].join(':');
}

export async function hashBackupFile(filePath) {
  const before = await lstat(filePath, { bigint: true });
  if (!before.isFile()) throw new Error('Backup hashing requires a regular file, not a link');
  const descriptor = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await descriptor.stat({ bigint: true });
    if (!opened.isFile() || signature(before) !== signature(opened)) {
      throw new Error('Backup input changed before hashing');
    }
    const hash = createHash('sha256');
    for await (const chunk of descriptor.createReadStream({ autoClose: false })) hash.update(chunk);
    if (
      signature(opened) !== signature(await descriptor.stat({ bigint: true })) ||
      signature(opened) !== signature(await lstat(filePath, { bigint: true }))
    ) {
      throw new Error('Backup input changed while hashing');
    }
    return hash.digest('hex');
  } finally {
    await descriptor.close();
  }
}

export async function verifyBackupChecksum({ archivePath, checksumPath }) {
  if (!archivePath || !checksumPath) {
    throw new Error('archivePath and checksumPath are required');
  }
  const checksumInfo = await lstat(checksumPath);
  if (!checksumInfo.isFile()) throw new Error('Checksum must be a regular file, not a link');
  if (checksumInfo.size > 4096) return false;
  const checksumFile = (await readFile(checksumPath, 'utf8')).trim();
  const match = checksumFile.match(/^([\da-f]{64})(?:[ \t]+[^\r\n]+)?$/iu);
  if (!match) return false;
  const actual = await hashBackupFile(archivePath);
  return actual === match[1].toLowerCase();
}
