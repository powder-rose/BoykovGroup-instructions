import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import { InstructionEditorError } from './instructionEditorError.js';
import { instructionFileSignature } from './instructionPublicIndex.js';
import {
  DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
  assertInstructionVersionRecord,
  instructionVersionFilename,
  instructionsRepository,
  readInstructionVersionDirectory,
  readInstructionVersionFile,
} from './instructionsRepository.js';

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const PROJECTION_FIELDS = [
  'id',
  'title',
  'slug',
  'slugAliases',
  'status',
  'seoStatus',
  'revision',
  'primaryCategoryId',
  'tagIds',
  'taxonomyMeta',
];

function fingerprint(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readBoundedVersion(file, version) {
  let descriptor;
  try {
    const pathStat = fs.lstatSync(file, { bigint: true });
    if (!pathStat.isFile() || pathStat.size > BigInt(MAX_BODY_BYTES)) {
      throw new Error('Instruction must be a regular file of at most 8 MiB');
    }
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(descriptor, { bigint: true });
    if (
      !stat.isFile() ||
      stat.size > BigInt(MAX_BODY_BYTES) ||
      instructionFileSignature(pathStat) !== instructionFileSignature(stat)
    ) {
      throw new Error('Instruction must be an unchanged regular file of at most 8 MiB');
    }
    const bytes = Buffer.allocUnsafe(Number(stat.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (!count) throw new Error('Instruction changed while reading');
      offset += count;
    }
    if (
      fs.readSync(descriptor, Buffer.allocUnsafe(1), 0, 1, offset) !== 0 ||
      instructionFileSignature(fs.fstatSync(descriptor, { bigint: true })) !==
        instructionFileSignature(stat) ||
      instructionFileSignature(fs.lstatSync(file, { bigint: true })) !==
        instructionFileSignature(stat)
    ) {
      throw new Error('Instruction changed while reading');
    }
    const record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    assertInstructionVersionRecord(record, version);
    if (path.basename(file) !== instructionVersionFilename(record.id, version)) {
      throw new Error('Instruction filename does not match its ID');
    }
    return { id: record.id, version, record, bytes };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

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

  function readCurrent(snapshot) {
    const target = targetFor(snapshot);
    const current = readBoundedVersion(target.file, target.version);
    if (fingerprint(current.bytes) !== target.fingerprint) {
      throw new InstructionEditorError('Инструкция изменилась. Создайте новый предпросмотр.', {
        code: 'TAXONOMY_BULK_PREVIEW_CONFLICT',
        status: 409,
      });
    }
    return current;
  }

  function remember(item, metadataOnly) {
    const snapshot = {
      id: item.id,
      version: item.version,
      record: metadataOnly
        ? Object.fromEntries(
            PROJECTION_FIELDS.filter(field => Object.hasOwn(item.record, field)).map(field => [
              field,
              structuredClone(item.record[field]),
            ]),
          )
        : structuredClone(item.record),
      ...(!metadataOnly ? { bytes: Buffer.from(item.bytes) } : {}),
      fingerprint: fingerprint(item.bytes),
    };
    targets.set(snapshot, {
      id: item.id,
      version: item.version,
      file: path.join(directories[item.version], instructionVersionFilename(item.id, item.version)),
      fingerprint: snapshot.fingerprint,
      metadataOnly,
    });
    return snapshot;
  }

  function readMetadata(assertHeld) {
    const snapshots = [];
    for (const version of ['published', 'draft']) {
      const directory = directories[version];
      let entries;
      try {
        if (!fs.lstatSync(directory).isDirectory()) {
          throw new Error('Non-regular instruction directory');
        }
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch (cause) {
        if (version === 'draft' && cause.code === 'ENOENT') continue;
        throw cause;
      }
      const ids = new Set();
      for (const entry of entries) {
        if (!entry.name.endsWith('.json')) continue;
        assertHeld?.();
        if (!entry.isFile()) throw new Error('Non-regular instruction entry');
        const item = readBoundedVersion(path.join(directory, entry.name), version);
        if (ids.has(item.id)) throw new Error('Duplicate instruction ID');
        ids.add(item.id);
        snapshots.push(remember(item, true));
      }
    }
    assertHeld?.();
    return snapshots;
  }

  return {
    read({ metadataOnly = false, assertHeld } = {}) {
      try {
        if (metadataOnly) return readMetadata(assertHeld);
        const published = repository.getAllFreshSnapshots();
        const drafts = readInstructionVersionDirectory(directories.draft, 'draft');
        return [...published, ...drafts].map(item => remember(item, false));
      } catch (cause) {
        throw storageError(cause);
      }
    },

    readBytes(snapshot) {
      try {
        return readCurrent(snapshot).bytes;
      } catch (cause) {
        throw storageError(cause);
      }
    },

    serialize(snapshot, record) {
      try {
        const target = targetFor(snapshot);
        validateRecord(target, record);
        let complete = record;
        if (target.metadataOnly) {
          complete = readCurrent(snapshot).record;
          for (const field of PROJECTION_FIELDS) {
            if (Object.hasOwn(record, field)) complete[field] = record[field];
            else delete complete[field];
          }
          validateRecord(target, complete);
        }
        return Buffer.from(
          `${JSON.stringify(complete, null, 2)}${target.version === 'draft' ? '\n' : ''}`,
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
      if (typeof repository.getPublicReferencesFresh === 'function') {
        repository.getPublicReferencesFresh();
      } else {
        repository.getAllFresh();
      }
    },
  };
}

export const instructionTaxonomyBindingStore = createInstructionTaxonomyBindingStore();
