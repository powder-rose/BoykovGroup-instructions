import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data", "instructions");

/**
 * Простое файловое хранилище инструкций: каждая инструкция — один JSON-файл
 * в server/src/data/instructions/<id>.json. Для реального продакшена
 * это легко заменить на любую БД, не меняя API репозитория ниже.
 */
class InstructionsRepository {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map(); // id -> instruction
    this._load();
  }

  _load() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    this.cache.clear();
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.dir, file), "utf-8");
        const data = JSON.parse(raw);
        if (data && data.id) {
          this.cache.set(data.id, data);
        }
      } catch (err) {
        console.error(`Не удалось прочитать инструкцию ${file}:`, err.message);
      }
    }
  }

  getAll() {
    return Array.from(this.cache.values());
  }

  getById(id) {
    return this.cache.get(id) ?? null;
  }

  exists(id) {
    return this.cache.has(id);
  }

  /** Сохраняет новую (или обновлённую) инструкцию на диск и в кэш. */
  save(instruction) {
    if (!instruction?.id) {
      throw new Error("У инструкции должен быть id перед сохранением");
    }
    const filePath = path.join(this.dir, `${instruction.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(instruction, null, 2), "utf-8");
    this.cache.set(instruction.id, instruction);
    return instruction;
  }

  /** Удаляет инструкцию с диска и из кэша. */
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
