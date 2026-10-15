import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { instructionsRepository } from './instructionsRepository.js';
import { assertNoPendingInstructionDraft } from './instructionDraftGuard.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const HISTORY_ROOT = path.join(__dirname, '..', 'data', 'instruction-history');

const MAX_HISTORY = 30;

/*
 * Не используем id инструкции
 * непосредственно как имя каталога.
 */
function getInstructionHistoryDir(instructionId) {
  const safeId = Buffer.from(String(instructionId), 'utf8').toString('base64url');

  return path.join(HISTORY_ROOT, safeId);
}

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true,
    });
  }
}

function listSnapshots(instructionId) {
  const directory = getInstructionHistoryDir(instructionId);

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter(filename => filename.endsWith('.json'))
    .sort()
    .reverse()
    .map(filename => path.join(directory, filename));
}

/*
 * Сохраняем состояние инструкции
 * ДО внесения новых изменений.
 */
export function saveInstructionSnapshot(instruction) {
  if (!instruction?.id) {
    throw new Error('Нельзя создать историю инструкции без id');
  }

  ensureDirectory(HISTORY_ROOT);

  const directory = getInstructionHistoryDir(instruction.id);

  ensureDirectory(directory);

  const timestamp = Date.now();

  const suffix = Math.random().toString(36).slice(2, 8);

  const filename = `${timestamp}-${suffix}.json`;

  const filePath = path.join(directory, filename);

  const temporaryPath = `${filePath}.tmp`;

  const snapshot = {
    savedAt: new Date().toISOString(),

    instruction,
  };

  fs.writeFileSync(temporaryPath, JSON.stringify(snapshot, null, 2), 'utf8');

  fs.renameSync(temporaryPath, filePath);

  /*
   * Оставляем максимум
   * 30 предыдущих состояний.
   */
  const snapshots = listSnapshots(instruction.id);

  for (const oldFile of snapshots.slice(MAX_HISTORY)) {
    try {
      fs.unlinkSync(oldFile);
    } catch {
      // Не мешаем сохранению документа
      // из-за ошибки очистки старой истории.
    }
  }

  return filePath;
}

/*
 * Возвращает документ
 * к предыдущему сохранённому состоянию.
 *
 * Использованная версия удаляется
 * из стека истории, поэтому повторный
 * откат вернёт ещё более раннюю версию.
 */
export function rollbackInstruction(instructionId) {
  const current = instructionsRepository.getById(instructionId);

  if (!current) {
    const error = new Error('Инструкция не найдена');

    error.code = 'INSTRUCTION_NOT_FOUND';

    throw error;
  }

  assertNoPendingInstructionDraft(current);

  const snapshots = listSnapshots(instructionId);

  if (snapshots.length === 0) {
    const error = new Error('Для этой инструкции пока нет предыдущей версии');

    error.code = 'NO_HISTORY';

    throw error;
  }

  const latestFile = snapshots[0];

  let data;

  try {
    data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
  } catch (error) {
    error.code = 'INVALID_HISTORY';

    throw error;
  }

  const snapshot = data?.instruction ?? data;

  if (!snapshot || typeof snapshot !== 'object') {
    const error = new Error('Файл предыдущей версии повреждён');

    error.code = 'INVALID_HISTORY';

    throw error;
  }

  const restored = {
    ...snapshot,

    /*
     * ID менять запрещено.
     */
    id: current.id,

    revision: Number(current.revision || 0) + 1,

    slugAliases: [
      ...new Set([
        current.id,
        current.slug || current.id,
        ...(current.slugAliases || []),
        ...(snapshot.slugAliases || []),
      ]),
    ].filter(value => value !== (snapshot.slug || current.id)),

    /*
     * Показываем реальное время отката.
     */
    updatedAt: new Date().toISOString(),
  };

  /*
   * Сначала восстанавливаем.
   * Только после успешной записи
   * удаляем использованный snapshot.
   */
  instructionsRepository.save(restored);

  fs.unlinkSync(latestFile);

  return restored;
}

export function getInstructionHistoryInfo(instructionId) {
  const snapshots = listSnapshots(instructionId);

  return {
    available: snapshots.length > 0,

    count: snapshots.length,
  };
}
