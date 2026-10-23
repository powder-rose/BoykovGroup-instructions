import { createHash } from 'node:crypto';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

import { backupManifest } from './backupManifest.js';
import { hashBackupFile } from './restoreVerifier.js';

function signature(info) {
  return [info.dev, info.ino, info.mode, info.nlink, info.size, info.mtimeNs, info.ctimeNs].join(
    ':',
  );
}

function safeName(name) {
  if (
    !name ||
    name.includes('\\') ||
    [...name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new Error('Backup entries must have unambiguous names without control characters');
}

export async function readBackupInventory({ sourceRoot }) {
  if (typeof sourceRoot !== 'string' || !sourceRoot.trim())
    throw new TypeError('Backup sourceRoot is required');
  const supplied = path.resolve(sourceRoot);
  if (!(await lstat(supplied)).isDirectory())
    throw new Error('Backup sourceRoot must be a real directory, not a symbolic link');
  const root = await realpath(supplied);
  const entries = [];
  const includedPaths = [];
  const missingOptionalPaths = [];

  async function visit(relative) {
    const file = path.join(root, relative);
    const before = await lstat(file, { bigint: true });
    if (!before.isDirectory() && !before.isFile())
      throw new Error(`Backup cannot include a link or special file: ${relative}`);
    if (before.isFile() && before.nlink > 1n)
      throw new Error(`Backup cannot include hard-linked files: ${relative}`);
    const name = relative.split(path.sep).join('/');
    if (before.isDirectory()) {
      entries.push({
        path: name,
        kind: 'directory',
        mode: Number(before.mode & 0o777n),
        size: 0,
        sha256: null,
      });
      const children = await readdir(file);
      for (const child of children.sort()) {
        safeName(child);
        await visit(path.join(relative, child));
      }
    } else {
      if (before.size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error('Backup file is too large');
      const sha256 = await hashBackupFile(file);
      entries.push({
        path: name,
        kind: 'file',
        mode: Number(before.mode & 0o777n),
        size: Number(before.size),
        sha256,
      });
    }
    if (signature(before) !== signature(await lstat(file, { bigint: true })))
      throw new Error(`Backup source changed while reading: ${relative}`);
  }

  for (const relative of backupManifest.includedPaths) {
    const components = relative.split('/');
    let missing = false;
    for (let index = 1; index <= components.length; index += 1) {
      const component = path.join(root, ...components.slice(0, index));
      try {
        if (!(await lstat(component)).isDirectory())
          throw new Error(`Backup included path must be a real directory: ${relative}`);
      } catch (error) {
        if (error.code !== 'ENOENT' || !backupManifest.optionalPaths.includes(relative))
          throw error;
        missing = true;
        break;
      }
    }
    if (missing) missingOptionalPaths.push(relative);
    else {
      includedPaths.push(relative);
      await visit(path.join(...components));
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ includedPaths, missingOptionalPaths, entries }))
    .digest('hex');
  return { sourceRoot: root, includedPaths, missingOptionalPaths, entries, fingerprint };
}
