import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { performance } from 'node:perf_hooks';

import {
  acquireFileLeaseLock,
  refreshFileLeaseLock,
  releaseFileLeaseLock,
} from '../utils/fileLeaseLock.js';
import { InstructionEditorError } from './instructionEditorError.js';
import { validateInstructionTaxonomyRegistry } from './instructionTaxonomyRegistryModel.js';
import { getInstructionTaxonomyRegistrySeed } from './instructionTaxonomySource.js';

const DEFAULT_FILE = fileURLToPath(
  new URL('../../data/instruction-taxonomy.json', import.meta.url),
);
const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_BUFFER = new Int32Array(new SharedArrayBuffer(4));

function storageError(cause) {
  return new InstructionEditorError('Не удалось прочитать или сохранить справочник классификации', {
    status: 500,
    code: 'TAXONOMY_STORAGE_ERROR',
    cause,
  });
}

function assertRevision(revision) {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new InstructionEditorError('Передайте номер сохранённой версии справочника', {
      code: 'INVALID_TAXONOMY_REVISION',
    });
  }
}

function retainLock(lock) {
  if (!refreshFileLeaseLock(lock)) {
    throw new InstructionEditorError('Блокировка справочника потеряна. Повторите изменение.', {
      status: 409,
      code: 'TAXONOMY_LOCK_LOST',
    });
  }
}

export function createInstructionTaxonomyRegistryRepository({
  filePath = DEFAULT_FILE,
  seed = getInstructionTaxonomyRegistrySeed(),
} = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new TypeError('Taxonomy registry filePath must be a nonempty string');
  }
  validateInstructionTaxonomyRegistry(seed);
  const initialState = structuredClone(seed);
  const file = path.resolve(filePath);

  function read() {
    let bytes;
    try {
      if (!fs.lstatSync(file).isFile()) {
        throw new Error('Taxonomy registry must be a regular file');
      }
      bytes = fs.readFileSync(file);
    } catch (cause) {
      if (cause.code === 'ENOENT') return structuredClone(initialState);
      throw storageError(cause);
    }

    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const state = JSON.parse(text);
      validateInstructionTaxonomyRegistry(state);
      return structuredClone(state);
    } catch (cause) {
      throw storageError(cause);
    }
  }

  function write(state, assertHeld) {
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
    try {
      assertHeld();
      const descriptor = fs.openSync(temporary, 'wx', 0o600);
      try {
        fs.writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      assertHeld();
      fs.renameSync(temporary, file);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }

  function withLock(callback, { waitMs = 0 } = {}) {
    if (typeof callback !== 'function' || callback.constructor?.name === 'AsyncFunction') {
      throw new TypeError('Taxonomy transaction requires a synchronous callback');
    }
    if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 5000) {
      throw new TypeError('Taxonomy lock wait must be an integer between 0 and 5000 milliseconds');
    }
    let lock;
    let callbackStarted = false;
    try {
      const deadline = performance.now() + waitMs;
      do {
        lock = acquireFileLeaseLock({
          filePath: `${file}.lock`,
          staleMs: LOCK_STALE_MS,
          metadata: { purpose: 'instruction-taxonomy-update' },
        });
        if (lock.acquired) break;
        const remaining = deadline - performance.now();
        if (remaining <= 0) {
          throw new InstructionEditorError('Справочник уже сохраняется. Повторите изменение.', {
            status: 409,
            code: 'TAXONOMY_LOCKED',
          });
        }
        Atomics.wait(LOCK_WAIT_BUFFER, 0, 0, Math.min(10, remaining));
      } while (!lock.acquired);
      const assertHeld = () => retainLock(lock);
      const state = read();
      callbackStarted = true;
      const result = callback(state, assertHeld);
      if (result && typeof result.then === 'function') {
        throw new InstructionEditorError('Изменение должно выполняться синхронно', {
          code: 'INVALID_TAXONOMY_UPDATE',
        });
      }
      return result;
    } catch (cause) {
      if (callbackStarted) throw cause;
      if (cause instanceof InstructionEditorError) throw cause;
      throw storageError(cause);
    } finally {
      if (lock?.acquired) releaseFileLeaseLock(lock);
    }
  }

  return {
    read,
    withLock,

    update(mutator, { expectedRevision } = {}) {
      assertRevision(expectedRevision);
      if (typeof mutator !== 'function') {
        throw new TypeError('Taxonomy registry update requires a synchronous mutator');
      }
      return withLock((current, assertHeld) => {
        try {
          if (current.revision !== expectedRevision) {
            throw new InstructionEditorError(
              'Справочник уже изменён. Загрузите актуальную версию.',
              {
                status: 409,
                code: 'TAXONOMY_REVISION_CONFLICT',
              },
            );
          }

          const changed = mutator(structuredClone(current));
          if (!changed || typeof changed !== 'object' || Array.isArray(changed) || changed.then) {
            throw new InstructionEditorError('Изменение должно вернуть справочник классификации', {
              code: 'INVALID_TAXONOMY_UPDATE',
            });
          }
          const next = { ...changed, revision: current.revision + 1 };
          validateInstructionTaxonomyRegistry(next);
          write(next, assertHeld);
          return structuredClone(next);
        } catch (cause) {
          if (cause instanceof InstructionEditorError) throw cause;
          throw storageError(cause);
        }
      });
    },
  };
}

export const instructionTaxonomyRegistryRepository = createInstructionTaxonomyRegistryRepository();
