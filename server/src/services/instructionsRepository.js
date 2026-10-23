import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

import { InstructionEditorError } from './instructionEditorError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, '..', 'data', 'instructions');

export const DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY = path.join(
  __dirname,
  '..',
  'data',
  'instruction-drafts',
);

function versionStorageError(version, cause) {
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

export function readInstructionVersionFile(file, version, { allowMissing = false } = {}) {
  let descriptor;
  try {
    if (!fs.lstatSync(file).isFile()) throw new Error('Non-regular instruction file');
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    if (!fs.fstatSync(descriptor).isFile()) throw new Error('Non-regular instruction file');
    const bytes = fs.readFileSync(descriptor);
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

export class InstructionsRepository {
  constructor(dir) {
    this.dir = dir;

    this.cache = new Map();

    this._load();
  }

  _load() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, {
        recursive: true,
      });
    }

    const files = fs.readdirSync(this.dir).filter(file => file.endsWith('.json'));

    this.cache.clear();

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.dir, file), 'utf-8').replace(/^\uFEFF/, '');

        const data = JSON.parse(raw);

        if (data?.id) {
          this.cache.set(data.id, data);
        }
      } catch (err) {
        console.error(`Ошибка загрузки ${file}:`, err.message);
      }
    }
  }

  getAll() {
    return Array.from(this.cache.values());
  }

  getAllFreshSnapshots() {
    const snapshots = readInstructionVersionDirectory(this.dir, 'published');
    this.cache = new Map(snapshots.map(snapshot => [snapshot.id, snapshot.record]));
    return snapshots;
  }

  getAllFresh() {
    return this.getAllFreshSnapshots().map(snapshot => snapshot.record);
  }

  getByIdFresh(id) {
    this.getAllFresh();
    return this.getById(id);
  }

  getTaxonomyReferences() {
    return this.getAllFresh().map(instruction =>
      structuredClone({
        id: instruction.id,
        status: instruction.status,
        seoStatus: instruction.seoStatus,
        primaryCategoryId: instruction.primaryCategoryId,
        tagIds: instruction.tagIds,
      }),
    );
  }

  getById(id) {
    return this.cache.get(id) || null;
  }

  getBySlug(slug) {
    return (
      this.getAll().find(
        instruction =>
          instruction.id === slug ||
          instruction.slug === slug ||
          instruction.slugAliases?.includes(slug),
      ) || null
    );
  }

  exists(id) {
    return this.cache.has(id);
  }

  /**
   * Поиск инструкции по профессии
   * для защиты от дублей
   */
  findByProfessionKey(key) {
    if (!key) {
      return null;
    }

    return Array.from(this.cache.values()).find(item => item.professionKey === key) || null;
  }

  save(instruction, { assertHeld } = {}) {
    if (!instruction?.id) {
      throw new Error('Инструкция должна иметь id');
    }

    // Generation, imports and rollbacks share the same public URL namespace as the editor.
    const addresses = new Set([
      instruction.id,
      instruction.slug || instruction.id,
      ...(instruction.slugAliases || []),
    ]);

    for (const existing of this.cache.values()) {
      if (existing.id === instruction.id) continue;

      const reserved = [existing.id, existing.slug || existing.id, ...(existing.slugAliases || [])];

      if (reserved.some(address => addresses.has(address))) {
        throw new InstructionEditorError('Этот адрес уже занят другой инструкцией', {
          status: 409,
          code: 'INSTRUCTION_SLUG_CONFLICT',
        });
      }
    }

    const filePath = path.join(this.dir, `${instruction.id}.json`);

    /*
     * Никогда не пишем новый JSON непосредственно
     * поверх последней успешно сохранённой версии.
     *
     * Сначала полностью записываем временный файл
     * в той же директории, затем атомарно заменяем
     * целевой файл через rename.
     */
    const temporaryPath = path.join(
      this.dir,
      `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );

    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(instruction, null, 2), {
        encoding: 'utf-8',
        flush: true,
      });

      assertHeld?.();
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      /*
       * После неудачной записи или rename
       * удаляем только незавершённый временный файл.
       *
       * Последняя успешно сохранённая инструкция
       * остаётся нетронутой.
       */
      try {
        if (fs.existsSync(temporaryPath)) {
          fs.unlinkSync(temporaryPath);
        }
      } catch {
        /*
         * Ошибка cleanup не должна скрывать
         * исходную ошибку сохранения.
         */
      }

      throw error;
    }

    /*
     * Cache обновляем только после успешного
     * atomic commit файла на диск.
     */
    this.cache.set(instruction.id, instruction);

    return instruction;
  }

  remove(id, { assertHeld } = {}) {
    const filePath = path.join(this.dir, `${id}.json`);

    if (fs.existsSync(filePath)) {
      assertHeld?.();
      fs.unlinkSync(filePath);
    }

    this.cache.delete(id);
  }

  reload() {
    this._load();
  }
}

export const instructionsRepository = new InstructionsRepository(DATA_DIR);
