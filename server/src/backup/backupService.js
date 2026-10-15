import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { backupManifest } from './backupManifest.js';

const execFileAsync = promisify(execFile);

function formatDate(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function createBackup({ sourceRoot, outputDir }) {
  if (!sourceRoot || !outputDir) {
    throw new Error('sourceRoot and outputDir are required');
  }

  await mkdir(outputDir, {
    recursive: true,
    mode: 0o700,
  });

  const archiveName = `boykovdocs-backup-${formatDate()}.tar.gz`;

  const archivePath = path.join(outputDir, archiveName);

  const relativePaths = [];
  for (const item of backupManifest.includedPaths) {
    try {
      await stat(path.join(sourceRoot, item));
      relativePaths.push(item);
    } catch (error) {
      if (error.code !== 'ENOENT' || !backupManifest.optionalPaths.includes(item)) throw error;
    }
  }

  await execFileAsync('tar', ['-czf', archivePath, ...relativePaths], {
    cwd: sourceRoot,
  });

  await chmod(archivePath, 0o600);

  /*
   * Verify archive can be listed.
   */
  await execFileAsync('tar', ['-tzf', archivePath]);

  const hash = createHash('sha256');

  const content = await readFile(archivePath);

  hash.update(content);

  const checksum = hash.digest('hex');

  const checksumPath = `${archivePath}.sha256`;

  await import('node:fs/promises').then(fs =>
    fs.writeFile(checksumPath, `${checksum}  ${archiveName}\n`, 'utf8'),
  );

  const archiveStat = await stat(archivePath);

  return {
    archivePath,

    checksumPath,

    checksum,

    size: archiveStat.size,

    createdAt: new Date().toISOString(),
  };
}
