import { randomUUID } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { readBackupInventory } from './backupInventory.js';
import { hashBackupFile } from './restoreVerifier.js';

const execFileAsync = promisify(execFile);

function isWithin(directory, target) {
  const relative = path.relative(directory, target);
  return !relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function destinationPath(outputDir) {
  const absolute = path.resolve(outputDir);
  const tail = [];
  let existing = absolute;
  while (true) {
    try {
      const info = await lstat(existing);
      if (existing === absolute && !info.isDirectory()) {
        throw new Error('Backup output must be a real directory, not a link or file');
      }
      const physical = await realpath(existing);
      return path.join(physical, ...tail.reverse());
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      tail.push(path.basename(existing));
      existing = parent;
    }
  }
}

export async function createBackup({ sourceRoot, outputDir }) {
  if (
    typeof sourceRoot !== 'string' ||
    !sourceRoot.trim() ||
    typeof outputDir !== 'string' ||
    !outputDir.trim()
  ) {
    throw new Error('sourceRoot and outputDir are required');
  }

  const sourceInventory = await readBackupInventory({ sourceRoot });
  const destination = await destinationPath(outputDir);
  if (isWithin(sourceInventory.sourceRoot, destination)) {
    throw new Error('Backup output must be outside the source root');
  }
  await mkdir(destination, { recursive: true, mode: 0o700 });

  const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const archiveName = `boykovdocs-backup-${timestamp}-${randomUUID()}.tar.gz`;
  const archivePath = path.join(destination, archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const temporaryDirectory = await mkdtemp(path.join(destination, '.boykovdocs-backup-'));
  const temporaryArchive = path.join(temporaryDirectory, archiveName);
  const temporaryChecksum = path.join(temporaryDirectory, `${archiveName}.sha256`);
  let archivePublished = false;
  let checksumPublished = false;

  try {
    await chmod(temporaryDirectory, 0o700);
    await execFileAsync('tar', ['-czf', temporaryArchive, '--', ...sourceInventory.includedPaths], {
      cwd: sourceInventory.sourceRoot,
      maxBuffer: 16 * 1024 * 1024,
    });
    await chmod(temporaryArchive, 0o600);
    await execFileAsync('tar', ['-tzf', temporaryArchive], { maxBuffer: 16 * 1024 * 1024 });

    const checksum = await hashBackupFile(temporaryArchive);
    await writeFile(temporaryChecksum, `${checksum}  ${archiveName}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await link(temporaryArchive, archivePath);
    archivePublished = true;
    await link(temporaryChecksum, checksumPath);
    checksumPublished = true;

    const archiveStat = await stat(archivePath);
    return {
      archivePath,
      checksumPath,
      checksum,
      size: archiveStat.size,
      createdAt: new Date().toISOString(),
      sourceInventory,
    };
  } catch (error) {
    if (checksumPublished) await rm(checksumPath, { force: true });
    if (archivePublished) await rm(archivePath, { force: true });
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
