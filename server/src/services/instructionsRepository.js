import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { InstructionEditorError } from './instructionEditorError.js';
import { createInstructionPublicIndex } from './instructionPublicIndex.js';
import {
  readInstructionVersionFile,
  readInstructionVersionDirectory,
  versionStorageError,
} from './instructionVersionStorage.js';
export {
  DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
  assertInstructionStorageId,
  instructionVersionFilename,
  assertInstructionVersionRecord,
  readInstructionVersionFile,
  readInstructionVersionDirectory,
} from './instructionVersionStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, '..', 'data', 'instructions');

export class InstructionsRepository {
  constructor(dir) {
    this.dir = dir;

    this.cache = new Map();
    this.publicIndex = createInstructionPublicIndex({
      directory: this.dir,
      readInstruction: (file, options) => readInstructionVersionFile(file, 'published', options),
    });

    this._load();
  }

  _load() {
    this.publicIndex.reset();
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
    this.publicIndex.reset();
    return snapshots;
  }

  getPublicReferencesFresh() {
    try {
      const result = this.publicIndex.refresh(this.cache);
      this.cache = result.cache;
      return result.references;
    } catch (cause) {
      if (cause instanceof InstructionEditorError) throw cause;
      throw versionStorageError('published', cause);
    }
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
    this.publicIndex.invalidate(`${instruction.id}.json`);

    return instruction;
  }

  remove(id, { assertHeld } = {}) {
    const filePath = path.join(this.dir, `${id}.json`);

    if (fs.existsSync(filePath)) {
      assertHeld?.();
      fs.unlinkSync(filePath);
    }

    this.cache.delete(id);
    this.publicIndex.invalidate(`${id}.json`);
  }

  reload() {
    this._load();
  }
}

export const instructionsRepository = new InstructionsRepository(DATA_DIR);
