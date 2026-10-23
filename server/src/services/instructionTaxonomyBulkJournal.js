import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import { InstructionEditorError } from './instructionEditorError.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_SLOT_BYTES = 8 * 1024 * 1024;
const MAX_IDS = 5000;
const PREVIEW_LIFETIME_MS = 30 * 60 * 1000;
const TERMINAL = new Set(['committed', 'failed', 'recovered']);
const PLAN_FIELDS = new Set([
  'schemaVersion',
  'id',
  'kind',
  'actor',
  'createdAt',
  'expiresAt',
  'registryRevision',
  'action',
  'ids',
  'counts',
  'rows',
  'inventory',
  'slots',
  'sourceOperationId',
  'rollbackOf',
  'status',
  'result',
  'error',
  'recoveredAt',
]);

function fail(message, { code = 'INVALID_TAXONOMY_BULK_OPERATION', status = 400, cause } = {}) {
  throw new InstructionEditorError(message, { code, status, cause });
}

function storage(cause) {
  return new InstructionEditorError(
    'Не удалось прочитать или сохранить журнал массовых изменений',
    {
      code: 'TAXONOMY_BULK_STORAGE_ERROR',
      status: 500,
      cause,
    },
  );
}

function object(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

function text(value, maximum = 2000) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    [...value].every(character => character.codePointAt(0) > 31 && character.codePointAt(0) !== 127)
  );
}

function id(value) {
  if (typeof value !== 'string' || !UUID.test(value)) fail('Некорректный идентификатор операции');
  return value;
}

function date(value) {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function fields(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.has(key))) {
    fail('Некорректные поля журнала массовых изменений');
  }
}

function uniqueStrings(values, maximum = MAX_IDS) {
  return (
    Array.isArray(values) &&
    values.length <= maximum &&
    values.every(value => text(value)) &&
    new Set(values).size === values.length
  );
}

function validateAction(action, kind) {
  if (kind === 'rollback') {
    fields(action, new Set(['type', 'operationId']));
    if (action.type !== 'rollback') fail('Некорректное действие отката');
    id(action.operationId);
    return;
  }
  if (action?.type === 'set-section') {
    fields(action, new Set(['type', 'sectionId']));
    if (!text(action.sectionId, 160)) fail('Не указан основной раздел');
    return;
  }
  fields(action, new Set(['type', 'tagIds']));
  if (
    !['add-tags', 'remove-tags'].includes(action.type) ||
    !uniqueStrings(action.tagIds) ||
    !action.tagIds.length
  ) {
    fail('Некорректное изменение тегов');
  }
}

function decodedSlot(value, expectedHash, instructionId) {
  if (
    typeof value !== 'string' ||
    value.length > Math.ceil(MAX_SLOT_BYTES / 3) * 4 ||
    !HASH.test(expectedHash || '')
  ) {
    fail('Некорректная резервная копия инструкции');
  }
  const bytes = Buffer.from(value, 'base64');
  if (
    !bytes.length ||
    bytes.length > MAX_SLOT_BYTES ||
    bytes.toString('base64') !== value ||
    createHash('sha256').update(bytes).digest('hex') !== expectedHash
  ) {
    fail('Резервная копия инструкции не соответствует контрольной сумме');
  }
  let record;
  try {
    record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (cause) {
    fail('Некорректный JSON резервной копии инструкции', { cause });
  }
  if (!object(record) || record.id !== instructionId)
    fail('Резервная копия относится к другой инструкции');
}

function boundedJson(value) {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > MAX_FILE_BYTES)
    fail('Файл операции превышает допустимый размер');
  return `${serialized}\n`;
}

function validatePlan(plan, expectedId) {
  fields(plan, PLAN_FIELDS);
  id(plan.id);
  if (
    plan.id !== expectedId ||
    plan.schemaVersion !== 1 ||
    !['apply', 'rollback'].includes(plan.kind) ||
    !text(plan.actor, 2000) ||
    !date(plan.createdAt) ||
    !date(plan.expiresAt) ||
    !Number.isSafeInteger(plan.registryRevision) ||
    plan.registryRevision < 0 ||
    !['preview', 'applying', ...TERMINAL].includes(plan.status)
  ) {
    fail('Некорректная структура операции');
  }
  const duration = Date.parse(plan.expiresAt) - Date.parse(plan.createdAt);
  if (duration <= 0 || duration > PREVIEW_LIFETIME_MS)
    fail('Некорректный срок действия предварительного просмотра');
  validateAction(plan.action, plan.kind);
  if (
    !uniqueStrings(plan.ids) ||
    !object(plan.counts) ||
    Object.values(plan.counts).some(value => !Number.isSafeInteger(value) || value < 0) ||
    !Array.isArray(plan.rows) ||
    plan.rows.length > MAX_IDS ||
    plan.rows.some(row => !object(row))
  ) {
    fail('Некорректная сводка массового изменения');
  }
  if (
    !Array.isArray(plan.inventory) ||
    plan.inventory.length > MAX_IDS * 2 ||
    !Array.isArray(plan.slots) ||
    plan.slots.length > MAX_IDS * 2
  )
    fail('Некорректный список резервных копий');
  const selected = new Set(plan.ids);
  const inventory = new Map();
  for (const entry of plan.inventory) {
    fields(entry, new Set(['id', 'version', 'fingerprint']));
    const key = JSON.stringify([entry.id, entry.version]);
    if (
      !selected.has(entry.id) ||
      !['published', 'draft'].includes(entry.version) ||
      !HASH.test(entry.fingerprint || '') ||
      inventory.has(key)
    )
      fail('Некорректная исходная версия инструкции');
    inventory.set(key, entry.fingerprint);
  }
  const slots = new Set();
  for (const slot of plan.slots) {
    fields(
      slot,
      new Set(['id', 'version', 'beforeBase64', 'afterBase64', 'beforeHash', 'afterHash']),
    );
    const key = JSON.stringify([slot.id, slot.version]);
    if (!inventory.has(key) || inventory.get(key) !== slot.beforeHash || slots.has(key))
      fail('Резервная копия не соответствует исходному состоянию');
    decodedSlot(slot.beforeBase64, slot.beforeHash, slot.id);
    decodedSlot(slot.afterBase64, slot.afterHash, slot.id);
    slots.add(key);
  }
  for (const field of ['sourceOperationId', 'rollbackOf']) {
    if (plan[field] !== undefined) id(plan[field]);
  }
  if (plan.recoveredAt !== undefined && !date(plan.recoveredAt))
    fail('Некорректная дата восстановления');
  if (plan.error !== undefined) {
    fields(plan.error, new Set(['code', 'message']));
    if (!text(plan.error.code, 200) || !text(plan.error.message, 2000))
      fail('Некорректное описание ошибки');
  }
  if (plan.result !== undefined && !object(plan.result)) fail('Некорректный результат операции');
  boundedJson(plan);
  return plan;
}

function validateActive(marker) {
  fields(marker, new Set(['schemaVersion', 'operationId', 'kind', 'startedAt']));
  id(marker.operationId);
  if (
    marker.schemaVersion !== 1 ||
    !['apply', 'rollback'].includes(marker.kind) ||
    !date(marker.startedAt)
  )
    fail('Некорректный маркер незавершённой операции');
  return marker;
}

function readJson(file) {
  let descriptor;
  try {
    if (!fs.lstatSync(file).isFile()) throw new Error('Journal entry must be a regular file');
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error('Invalid journal entry size');
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(descriptor)),
    );
  } catch (cause) {
    if (cause.code === 'ENOENT') return undefined;
    throw storage(cause);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function ensureDirectory(directory) {
  const existed = fs.existsSync(directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(directory).isDirectory())
    throw new Error('Journal directory must be a real directory');
  if (!existed) syncDirectory(path.dirname(directory));
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

function writeJson(file, value, { createOnly = false } = {}) {
  const serialized = boundedJson(value);
  const directory = path.dirname(file);
  ensureDirectory(directory);
  if (fs.existsSync(file)) {
    if (createOnly) throw new Error('Journal entry already exists');
    if (!fs.lstatSync(file).isFile()) throw new Error('Journal entry must be a regular file');
  }
  const temporary = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    const descriptor = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, serialized, 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, file);
    syncDirectory(directory);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function pending(marker) {
  const error = new InstructionEditorError(
    'Завершите восстановление предыдущего массового изменения',
    {
      code: 'TAXONOMY_BULK_PENDING',
      status: 409,
    },
  );
  error.operationId = marker.operationId;
  error.details = { operationId: marker.operationId };
  return error;
}

export function createInstructionTaxonomyBulkJournal({ directory, now = Date.now } = {}) {
  if (!text(directory) || typeof now !== 'function')
    throw new TypeError('Journal directory and clock are required');
  const root = path.resolve(directory);
  const plans = path.join(root, 'plans');
  const activeFile = path.join(root, 'active.json');
  const planFile = operationId => path.join(plans, `${id(operationId)}.json`);

  function read(operationId) {
    const raw = readJson(planFile(operationId));
    if (raw === undefined)
      fail('Операция не найдена', { code: 'TAXONOMY_BULK_OPERATION_NOT_FOUND', status: 404 });
    try {
      return structuredClone(validatePlan(raw, operationId));
    } catch (cause) {
      throw storage(cause);
    }
  }

  function getActive() {
    const marker = readJson(activeFile);
    if (marker === undefined) return null;
    try {
      return structuredClone(validateActive(marker));
    } catch (cause) {
      throw storage(cause);
    }
  }

  function assertNoPending() {
    const marker = getActive();
    if (!marker) return;
    try {
      const plan = read(marker.operationId);
      if (plan.kind !== marker.kind) throw new Error('Active marker does not match its operation');
    } catch (cause) {
      throw storage(cause);
    }
    throw pending(marker);
  }

  return {
    read,
    getActive,
    assertNoPending,

    savePreview(input) {
      if (
        !object(input) ||
        ['id', 'schemaVersion', 'status', 'result', 'error', 'recoveredAt'].some(key =>
          Object.hasOwn(input, key),
        )
      )
        fail('Идентификатор и статус операции назначаются сервером');
      const plan = {
        ...structuredClone(input),
        schemaVersion: 1,
        id: randomUUID(),
        status: 'preview',
      };
      validatePlan(plan, plan.id);
      assertNoPending();
      try {
        ensureDirectory(root);
        writeJson(planFile(plan.id), plan, { createOnly: true });
        return structuredClone(plan);
      } catch (cause) {
        throw storage(cause);
      }
    },

    list({ page = 1, pageSize = 20 } = {}) {
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
      )
        fail('Некорректные параметры истории');
      let entries;
      try {
        entries = fs.readdirSync(plans, { withFileTypes: true });
      } catch (cause) {
        if (cause.code === 'ENOENT') return { items: [], total: 0, page, pageSize };
        throw storage(cause);
      }
      const ordered = entries
        .filter(entry => entry.name.endsWith('.json'))
        .map(entry => {
          if (!entry.isFile() || !UUID.test(entry.name.slice(0, -5)))
            throw storage(new Error('Invalid operation history entry'));
          const plan = read(entry.name.slice(0, -5));
          return { id: plan.id, createdAt: plan.createdAt };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return {
        items: ordered.slice((page - 1) * pageSize, page * pageSize).map(entry => read(entry.id)),
        total: ordered.length,
        page,
        pageSize,
      };
    },

    begin(operationId) {
      assertNoPending();
      const previous = read(operationId);
      if (previous.status !== 'preview')
        fail('Операция уже использована', { code: 'TAXONOMY_BULK_CONSUMED', status: 409 });
      if (now() >= Date.parse(previous.expiresAt))
        fail('Предварительный просмотр устарел', { code: 'TAXONOMY_BULK_EXPIRED', status: 409 });
      const plan = { ...previous, status: 'applying' };
      const marker = {
        schemaVersion: 1,
        operationId,
        kind: plan.kind,
        startedAt: new Date(now()).toISOString(),
      };
      try {
        writeJson(activeFile, marker, { createOnly: true });
        writeJson(planFile(operationId), plan);
        return structuredClone(plan);
      } catch (cause) {
        let marker;
        try {
          marker = getActive();
          if (!marker || marker.operationId !== operationId) {
            writeJson(planFile(operationId), {
              ...plan,
              status: 'failed',
              error: {
                code: 'JOURNAL_START_FAILED',
                message: 'Операция не началась: инструкции не изменялись',
              },
            });
          }
        } catch (cleanupCause) {
          throw storage(new AggregateError([cause, cleanupCause], 'Journal start failed'));
        }
        throw storage(cause);
      }
    },

    finish(operationId, patch) {
      fields(patch, new Set(['status', 'result', 'error', 'recoveredAt']));
      if (!TERMINAL.has(patch.status)) fail('Некорректный конечный статус операции');
      const previous = read(operationId);
      if (previous.status === patch.status && TERMINAL.has(previous.status)) return previous;
      const marker = getActive();
      if (
        !marker ||
        marker.operationId !== operationId ||
        !['preview', 'applying', 'failed'].includes(previous.status) ||
        (previous.status === 'preview' && patch.status === 'committed') ||
        (previous.status === 'failed' && patch.status !== 'recovered')
      )
        fail('Операция не находится в ожидаемом состоянии', {
          code: 'TAXONOMY_BULK_CONSUMED',
          status: 409,
        });
      const plan = { ...previous, ...structuredClone(patch) };
      validatePlan(plan, operationId);
      try {
        writeJson(planFile(operationId), plan);
        return structuredClone(plan);
      } catch (cause) {
        throw storage(cause);
      }
    },

    clearActive(operationId) {
      id(operationId);
      const marker = getActive();
      if (!marker) return false;
      if (marker.operationId !== operationId) throw pending(marker);
      const plan = read(operationId);
      if (!TERMINAL.has(plan.status)) throw pending(marker);
      try {
        fs.unlinkSync(activeFile);
        syncDirectory(root);
        return true;
      } catch (cause) {
        throw storage(cause);
      }
    },
  };
}

export function assertNoPendingTaxonomyBulkOperation(directory) {
  createInstructionTaxonomyBulkJournal({ directory }).assertNoPending();
}
