import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

import { InstructionEditorError } from './instructionEditorError.js';
import { instructionFileSignature } from './instructionPublicIndex.js';

export const DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY = fileURLToPath(
  new URL('../data/instruction-drafts', import.meta.url),
);

export function versionStorageError(version, cause) {
  return new InstructionEditorError(
    version === 'draft'
      ? 'Не удалось прочитать черновик инструкции'
      : 'Не удалось прочитать полный список инструкций',
    {
      status: 500,
      code: version === 'draft' ? 'INSTRUCTION_DRAFT_STORAGE_ERROR' : 'INSTRUCTION_STORAGE_ERROR',
      cause,
    },
  );
}

export function assertInstructionStorageId(id) {
  if (
    typeof id !== 'string' ||
    !id.trim() ||
    id !== id.trim() ||
    id === '.' ||
    id === '..' ||
    /[\\/<>:"|?*]/u.test(id) ||
    [...id].some(character => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f) ||
    id.endsWith('.')
  ) {
    throw new Error('Instruction ID must be a safe filename component');
  }
}

export function instructionVersionFilename(id, version) {
  assertInstructionStorageId(id);
  if (!['published', 'draft'].includes(version)) throw new Error('Unknown instruction version');
  return `${version === 'draft' ? Buffer.from(id, 'utf8').toString('base64url') : id}.json`;
}

export function assertInstructionVersionRecord(record, version) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Invalid instruction record');
  }
  assertInstructionStorageId(record.id);
  if (
    (record.revision !== undefined &&
      (!Number.isSafeInteger(record.revision) || record.revision < 0)) ||
    (version === 'draft' &&
      (!Number.isSafeInteger(record.revision) ||
        record.revision < 1 ||
        record.status !== 'draft')) ||
    (record.primaryCategoryId !== undefined &&
      record.primaryCategoryId !== null &&
      typeof record.primaryCategoryId !== 'string') ||
    (record.tagIds !== undefined &&
      record.tagIds !== null &&
      (!Array.isArray(record.tagIds) || record.tagIds.some(id => typeof id !== 'string')))
  ) {
    throw new Error('Invalid instruction record fields');
  }
}

export function readInstructionVersionFile(
  file,
  version,
  { allowMissing = false, verifyUnchanged = false } = {},
) {
  let descriptor;
  try {
    const pathStat = fs.lstatSync(file, { bigint: true });
    if (!pathStat.isFile()) throw new Error('Non-regular instruction file');
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const descriptorStat = fs.fstatSync(descriptor, { bigint: true });
    if (!descriptorStat.isFile()) throw new Error('Non-regular instruction file');
    if (
      verifyUnchanged &&
      instructionFileSignature(pathStat) !== instructionFileSignature(descriptorStat)
    ) {
      throw new Error('Instruction changed before reading');
    }
    const bytes = fs.readFileSync(descriptor);
    if (
      verifyUnchanged &&
      (instructionFileSignature(fs.fstatSync(descriptor, { bigint: true })) !==
        instructionFileSignature(descriptorStat) ||
        instructionFileSignature(fs.lstatSync(file, { bigint: true })) !==
          instructionFileSignature(descriptorStat))
    ) {
      throw new Error('Instruction changed while reading');
    }
    const record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    assertInstructionVersionRecord(record, version);
    if (path.basename(file) !== instructionVersionFilename(record.id, version)) {
      throw new Error('Instruction filename does not match its ID');
    }
    return { id: record.id, version, record, bytes };
  } catch (cause) {
    if (allowMissing && cause.code === 'ENOENT') return null;
    throw versionStorageError(version, cause);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function readInstructionVersionDirectory(directory, version) {
  try {
    if (!fs.lstatSync(directory).isDirectory())
      throw new Error('Non-regular instruction directory');
    const snapshots = [];
    const ids = new Set();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.name.endsWith('.json')) continue;
      if (!entry.isFile()) throw new Error('Non-regular instruction entry');
      const snapshot = readInstructionVersionFile(path.join(directory, entry.name), version);
      if (ids.has(snapshot.id)) throw new Error('Duplicate instruction ID');
      ids.add(snapshot.id);
      snapshots.push(snapshot);
    }
    return snapshots;
  } catch (cause) {
    if (version === 'draft' && cause.code === 'ENOENT') return [];
    if (cause instanceof InstructionEditorError) throw cause;
    throw versionStorageError(version, cause);
  }
}
