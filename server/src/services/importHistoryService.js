import { normalizeUploadedFilename } from '../utils/uploadedFilename.js';

/**
 * История массовой обработки документов
 *
 * Хранит:
 * - запуски импорта;
 * - список файлов;
 * - статусы обработки;
 * - ошибки;
 * - связь с созданными инструкциями.
 *
 * Пока хранение в памяти.
 * Позже можно заменить на JSON/БД без изменения API.
 */

import crypto from 'node:crypto';
const imports = new Map();

/**
 * Создание нового импорта
 *
 * @param {Array} files
 * @returns {Object}
 */
export function createImport(files = []) {
  const id = `import-${Date.now()}`;

  const importTask = {
    id,

    createdAt: new Date().toISOString(),

    status: 'waiting',

    total: files.length,

    completed: 0,

    failed: 0,

    created: 0,

    duplicates: 0,

    updatedVersions: 0,

    files: files.map(file => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,

      name: normalizeUploadedFilename(file.originalname || file.name || 'unknown'),

      // путь к сохранённому файлу
      path: null,

      status: 'waiting',

      instructionId: null,

      error: null,

      startedAt: null,

      finishedAt: null,
    })),
  };

  imports.set(id, importTask);

  return importTask;
}

/**
 * Получить импорт по ID
 */
export function getImport(id) {
  return imports.get(id) || null;
}

/**
 * Получить все импорты
 */
export function getAllImports() {
  return Array.from(imports.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Обновить импорт
 */
export function updateImport(id, updates = {}) {
  const current = imports.get(id);

  if (!current) {
    return null;
  }

  const updated = {
    ...current,

    ...updates,
  };

  imports.set(id, updated);

  return updated;
}

/**
 * Изменить статус одного файла
 */
export function updateImportFile(importId, fileId, updates = {}) {
  const current = imports.get(importId);

  if (!current) {
    return null;
  }

  const file = current.files.find(item => item.id === fileId);

  if (!file) {
    return null;
  }

  Object.assign(file, updates);

  if (updates.action === 'new') {
    current.created++;
  }

  if (updates.action === 'duplicate') {
    current.duplicates++;
  }

  if (updates.action === 'new_version') {
    current.updatedVersions++;
  }

  recalculateImportStatus(current);

  return file;
}

/**
 * Автоматический пересчёт прогресса
 */
function recalculateImportStatus(importTask) {
  importTask.completed = importTask.files.filter(file => file.status === 'completed').length;

  importTask.failed = importTask.files.filter(file => file.status === 'failed').length;

  const processing = importTask.files.some(file => file.status === 'processing');

  const waiting = importTask.files.some(file => file.status === 'waiting');

  if (importTask.completed + importTask.failed === importTask.total) {
    importTask.status = 'completed';

    importTask.finishedAt = new Date().toISOString();

    return;
  }

  if (processing) {
    importTask.status = 'processing';

    return;
  }

  if (waiting) {
    importTask.status = 'waiting';
  }
}

/**
 * Удаление истории импорта
 */
export function removeImport(id) {
  return imports.delete(id);
}

/**
 * Получение прогресса
 */
export function getImportProgress(id) {
  console.log('SEARCH IMPORT:', id);

  console.log('ALL IMPORTS:', Array.from(imports.keys()));

  const item = imports.get(id);

  if (!item) {
    return null;
  }

  const progress =
    item.total === 0 ? 0 : Math.round(((item.completed + item.failed) / item.total) * 100);

  return {
    id: item.id,

    status: item.status,

    total: item.total,

    completed: item.completed,

    failed: item.failed,

    created: item.created || 0,

    duplicates: item.duplicates || 0,

    updatedVersions: item.updatedVersions || 0,

    progress,

    files: item.files.map(file => ({
      id: file.id,

      name: file.name,

      status: file.status,

      action: file.action || null,

      error: file.error,

      instructionId: file.instructionId,

      startedAt: file.startedAt,

      finishedAt: file.finishedAt,
    })),
  };
}

export function getFailedImportFiles(id) {
  const current = imports.get(id);

  if (!current) {
    return [];
  }

  return current.files.filter(file => file.status === 'failed');
}
