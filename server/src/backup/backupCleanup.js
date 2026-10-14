import { readdir, stat, unlink } from 'node:fs/promises';

import path from 'node:path';

export async function cleanupExpiredBackups({ backupDir, retentionDays }) {
  if (!backupDir || !retentionDays) {
    throw new Error('backupDir and retentionDays are required');
  }

  const removed = [];

  const files = await readdir(backupDir);

  const threshold = Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (!file.endsWith('.tar.gz')) {
      continue;
    }

    const fullPath = path.join(backupDir, file);

    const info = await stat(fullPath);

    if (info.mtimeMs < threshold) {
      await unlink(fullPath);

      removed.push(fullPath);
    }
  }

  return {
    removed,
  };
}
