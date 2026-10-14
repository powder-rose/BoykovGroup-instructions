import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, '..', 'data', 'instructions');

class InstructionsRepository {
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

  getById(id) {
    return this.cache.get(id) || null;
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

  save(instruction) {
    if (!instruction?.id) {
      throw new Error('Инструкция должна иметь id');
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

  remove(id) {
    const filePath = path.join(this.dir, `${id}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.cache.delete(id);
  }

  reload() {
    this._load();
  }
}

export const instructionsRepository = new InstructionsRepository(DATA_DIR);
