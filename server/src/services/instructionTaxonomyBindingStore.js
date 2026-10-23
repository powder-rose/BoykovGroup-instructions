import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import { InstructionEditorError } from './instructionEditorError.js';
import {
  DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
  assertInstructionVersionRecord,
  instructionVersionFilename,
  instructionsRepository,
  readInstructionVersionDirectory,
  readInstructionVersionFile,
} from './instructionsRepository.js';

function storageError(cause) {
  if (cause instanceof InstructionEditorError) return cause;
  return new InstructionEditorError('Не удалось прочитать или сохранить назначения инструкций', {
    status: 500,
    code: 'TAXONOMY_BINDING_STORAGE_ERROR',
    cause,
  });
}

function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const descriptor = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function createInstructionTaxonomyBindingStore({
  repository = instructionsRepository,
  draftsDirectory = DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
} = {}) {
  const directories = {
    published: path.resolve(repository.dir),
    draft: path.resolve(draftsDirectory),
  };
  const targets = new WeakMap();

  function targetFor(snapshot) {
    const target = targets.get(snapshot);
    if (!target || snapshot.id !== target.id || snapshot.version !== target.version) {
      throw new Error('Use an unchanged snapshot returned by this binding store');
    }
    return target;
  }

  function validateRecord(target, record) {
    assertInstructionVersionRecord(record, target.version);
    if (record.id !== target.id) throw new Error('Instruction ID cannot change');
  }

  return {
    read() {
      try {
        const published = repository.getAllFreshSnapshots();
        const drafts = readInstructionVersionDirectory(directories.draft, 'draft');
        return [...published, ...drafts].map(item => {
          const snapshot = {
            id: item.id,
            version: item.version,
            record: structuredClone(item.record),
            bytes: Buffer.from(item.bytes),
            fingerprint: createHash('sha256').update(item.bytes).digest('hex'),
          };
          targets.set(snapshot, {
            id: item.id,
            version: item.version,
            file: path.join(
              directories[item.version],
              instructionVersionFilename(item.id, item.version),
            ),
          });
          return snapshot;
        });
      } catch (cause) {
        throw storageError(cause);
      }
    },

    serialize(snapshot, record) {
      try {
        const target = targetFor(snapshot);
        validateRecord(target, record);
        return Buffer.from(
          `${JSON.stringify(record, null, 2)}${target.version === 'draft' ? '\n' : ''}`,
          'utf8',
        );
      } catch (cause) {
        throw storageError(cause);
      }
    },

    writeBytes(snapshot, bytes, { assertHeld } = {}) {
      let temporary;
      try {
        if (typeof assertHeld !== 'function') throw new Error('A held taxonomy lease is required');
        if (!Buffer.isBuffer(bytes)) throw new Error('Instruction bytes must be a Buffer');
        const target = targetFor(snapshot);
        const record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        validateRecord(target, record);
        readInstructionVersionFile(target.file, target.version);
        assertHeld();
        temporary = path.join(
          path.dirname(target.file),
          `.${path.basename(target.file)}.${randomUUID()}.tmp`,
        );
        const descriptor = fs.openSync(temporary, 'wx', fs.statSync(target.file).mode & 0o777);
        try {
          fs.writeFileSync(descriptor, bytes);
          fs.fsyncSync(descriptor);
        } finally {
          fs.closeSync(descriptor);
        }
        if (!fs.lstatSync(target.file).isFile()) throw new Error('Non-regular instruction target');
        assertHeld();
        fs.renameSync(temporary, target.file);
        syncDirectory(path.dirname(target.file));
      } catch (cause) {
        throw storageError(cause);
      } finally {
        if (temporary) fs.rmSync(temporary, { force: true });
      }
    },

    refresh() {
      repository.getAllFresh();
    },
  };
}

export const instructionTaxonomyBindingStore = createInstructionTaxonomyBindingStore();
