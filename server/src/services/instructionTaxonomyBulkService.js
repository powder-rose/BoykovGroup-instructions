import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { getInstructionPublicPath } from '../shared/instructionDocument.js';
import { InstructionEditorError } from './instructionEditorError.js';
import {
  getInstructionTaxonomyAssignmentCatalog,
  validateInstructionTaxonomyAssignment,
} from './instructionTaxonomyAssignmentCatalog.js';
import { createInstructionTaxonomyBindingStore } from './instructionTaxonomyBindingStore.js';
import { createInstructionTaxonomyBulkJournal } from './instructionTaxonomyBulkJournal.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';
import { getInstructionTaxonomyCatalog } from './instructionTaxonomyService.js';

const MANAGED_FIELDS = ['primaryCategoryId', 'tagIds', 'taxonomyMeta'];
const MAX_IDS = 5000;
const PREVIEW_LIFETIME_MS = 30 * 60 * 1000;
const TAXONOMY_SCHEMA_VERSION = getInstructionTaxonomyCatalog().version;

function failure(message, code = 'INVALID_TAXONOMY_BULK_OPERATION', status = 400, details) {
  const error = new InstructionEditorError(message, { code, status });
  if (details) error.details = details;
  return error;
}

function fields(value, allowed) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(key => !allowed.includes(key))
  )
    throw failure('Некорректные параметры массовой операции');
}

function actorId(actor) {
  if (typeof actor !== 'string' || !actor.trim() || actor.length > 256) {
    throw failure('Не удалось определить администратора операции');
  }
  return actor;
}

function uniqueIds(ids, maximum = MAX_IDS) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > maximum ||
    ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 512) ||
    new Set(ids).size !== ids.length
  )
    throw failure(`Выберите от 1 до ${maximum} инструкций без повторений`);
  return [...ids].sort();
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function key(snapshot) {
  return JSON.stringify([snapshot.id, snapshot.version]);
}

function selection(record) {
  return {
    primaryCategoryId: record.primaryCategoryId ?? null,
    tagIds: [...(record.tagIds ?? [])],
  };
}

function managed(record) {
  return Object.fromEntries(
    MANAGED_FIELDS.filter(field => Object.hasOwn(record, field)).map(field => [
      field,
      structuredClone(record[field]),
    ]),
  );
}

function revision(record) {
  const value = record.revision ?? 0;
  if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER) {
    throw failure('Некорректная версия инструкции');
  }
  return value;
}

function grouped(snapshots) {
  const result = new Map();
  for (const snapshot of snapshots) {
    const versions = result.get(snapshot.id) ?? [];
    versions.push(snapshot);
    result.set(snapshot.id, versions);
  }
  for (const versions of result.values()) {
    versions.sort((a, b) => (a.version === b.version ? 0 : a.version === 'published' ? -1 : 1));
  }
  return result;
}

function pagination(input) {
  for (const field of ['page', 'pageSize']) {
    if (input[field] !== undefined && !['string', 'number'].includes(typeof input[field])) {
      throw failure('Некорректные параметры страницы');
    }
  }
  const page = input.page === undefined ? 1 : Number(input.page);
  const pageSize = input.pageSize === undefined ? 25 : Number(input.pageSize);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw failure('Некорректные параметры страницы');
  }
  return { page, pageSize };
}

function previewDto(plan) {
  return structuredClone({
    previewId: plan.id,
    kind: plan.kind,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    registryRevision: plan.registryRevision,
    action: plan.action,
    counts: plan.counts,
    rows: plan.rows,
    ...(plan.rollbackOf ? { rollbackOf: plan.rollbackOf } : {}),
  });
}

function summary(plan) {
  return structuredClone({
    operationId: plan.id,
    kind: plan.kind,
    status: plan.status,
    actor: plan.actor,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    action: plan.action,
    counts: plan.counts,
    ...(plan.result?.completedAt ? { completedAt: plan.result.completedAt } : {}),
    ...(plan.rollbackOf ? { rollbackOf: plan.rollbackOf } : {}),
  });
}

export function createInstructionTaxonomyBulkService({
  taxonomyRepository = instructionTaxonomyRegistryRepository,
  store = createInstructionTaxonomyBindingStore(),
  now = () => Date.now(),
  journal = createInstructionTaxonomyBulkJournal({
    directory: taxonomyRepository.operationsDirectory,
    now,
  }),
} = {}) {
  const clock = () => {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new TypeError('Bulk operation clock must return a date');
    return value;
  };

  function selectedSnapshots(snapshots, ids) {
    const byId = grouped(snapshots);
    const missing = ids.filter(id => !byId.has(id));
    if (missing.length)
      throw failure(
        'Часть выбранных инструкций не найдена',
        'TAXONOMY_BULK_SELECTION_CONFLICT',
        409,
        { conflicts: missing },
      );
    return ids.flatMap(id => byId.get(id));
  }

  function validateRecords(snapshots, registry) {
    const conflicts = [];
    for (const snapshot of snapshots) {
      try {
        validateInstructionTaxonomyAssignment(selection(snapshot.record), { registry });
        revision(snapshot.record);
      } catch {
        conflicts.push({ id: snapshot.id, version: snapshot.version });
      }
    }
    if (conflicts.length)
      throw failure(
        'Исправьте неизвестные назначения или версии выбранных инструкций',
        'TAXONOMY_BULK_SELECTION_CONFLICT',
        409,
        { conflicts },
      );
  }

  function validateAction(action, registry) {
    const catalog = getInstructionTaxonomyAssignmentCatalog(registry);
    if (action?.type === 'set-section') {
      fields(action, ['type', 'sectionId']);
      if (!catalog.sections.some(section => section.id === action.sectionId)) {
        throw failure('Выберите существующий тематический раздел');
      }
      return { type: action.type, sectionId: action.sectionId };
    }
    if (!['add-tags', 'remove-tags'].includes(action?.type))
      throw failure('Неизвестное массовое действие');
    fields(action, ['type', 'tagIds']);
    const tagIds = uniqueIds(action.tagIds, catalog.tags.length + catalog.legacyTags.length);
    const known = new Set([
      ...catalog.tags.map(tag => tag.id),
      ...(action.type === 'remove-tags' ? catalog.legacyTags.map(tag => tag.id) : []),
    ]);
    if (tagIds.some(id => !known.has(id)))
      throw failure('Выберите известные теги для этого действия');
    return { type: action.type, tagIds };
  }

  function changedRecord(record, action, registry) {
    const next = structuredClone(record);
    const before = selection(record);
    if (action.type === 'set-section') next.primaryCategoryId = action.sectionId;
    else if (action.type === 'add-tags')
      next.tagIds = [...new Set([...before.tagIds, ...action.tagIds])];
    else next.tagIds = before.tagIds.filter(id => !action.tagIds.includes(id));
    if (isDeepStrictEqual(before, selection(next))) return { record, changed: false };
    const canonicalSection = registry.sections.some(
      section => section.code === next.primaryCategoryId,
    );
    next.taxonomyMeta = {
      ...record.taxonomyMeta,
      ...(action.type === 'set-section' ? { categorySource: 'manual' } : {}),
      tagsSource: 'manual',
      needsReview: !next.primaryCategoryId || (!canonicalSection && !next.tagIds?.length),
      schemaVersion: record.taxonomyMeta?.schemaVersion ?? TAXONOMY_SCHEMA_VERSION,
    };
    validateInstructionTaxonomyAssignment(selection(next), { registry });
    return { record: next, changed: true };
  }

  function buildPlan({ kind, actor, registry, action, ids, snapshots, transform, rollbackOf }) {
    const rows = [];
    const slots = [];
    const counts = {
      selectedDocuments: ids.length,
      changedDocuments: 0,
      changedVersions: 0,
      updatedVersions: 0,
      unchangedDocuments: 0,
    };
    const byId = grouped(snapshots);
    for (const id of ids) {
      const versions = byId.get(id);
      const changes = versions.map(snapshot => ({ snapshot, ...transform(snapshot) }));
      const changed = changes.some(change => change.changed);
      const published = versions.find(snapshot => snapshot.version === 'published');
      rows.push({
        id,
        title: (published ?? versions[0]).record.title || id,
        publishedUrl: published ? getInstructionPublicPath(published.record) : null,
        versions: changes.map(change => ({
          version: change.snapshot.version,
          before: selection(change.snapshot.record),
          after: selection(change.record),
          changed: change.changed,
        })),
      });
      if (!changed) continue;
      counts.changedDocuments += 1;
      for (const change of changes) {
        if (change.changed) counts.changedVersions += 1;
        const after = { ...change.record, revision: revision(change.snapshot.record) + 1 };
        const bytes = store.serialize(change.snapshot, after);
        slots.push({
          id,
          version: change.snapshot.version,
          beforeBase64: change.snapshot.bytes.toString('base64'),
          afterBase64: bytes.toString('base64'),
          beforeHash: hash(change.snapshot.bytes),
          afterHash: hash(bytes),
        });
        counts.updatedVersions += 1;
      }
    }
    counts.unchangedDocuments = counts.selectedDocuments - counts.changedDocuments;
    const createdAt = new Date(clock()).toISOString();
    return {
      kind,
      actor,
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + PREVIEW_LIFETIME_MS).toISOString(),
      registryRevision: registry.revision,
      action,
      ids,
      counts,
      rows,
      inventory: snapshots.map(snapshot => ({
        id: snapshot.id,
        version: snapshot.version,
        fingerprint: hash(snapshot.bytes),
      })),
      slots,
      ...(rollbackOf ? { rollbackOf, sourceOperationId: rollbackOf } : {}),
    };
  }

  function assertActor(plan, actor) {
    if (plan.actor !== actorId(actor))
      throw failure(
        'Предпросмотр принадлежит другой административной сессии',
        'TAXONOMY_BULK_ACTOR_CONFLICT',
        409,
      );
  }

  function allOperations() {
    const first = journal.list({ page: 1, pageSize: 100 });
    const items = [...first.items];
    for (let page = 2; items.length < first.total; page += 1) {
      items.push(...journal.list({ page, pageSize: 100 }).items);
    }
    return items;
  }

  function assertNotRolledBack(operationId) {
    if (
      allOperations().some(
        plan =>
          plan.kind === 'rollback' &&
          plan.rollbackOf === operationId &&
          plan.status === 'committed',
      )
    ) {
      throw failure('Операция уже отменена', 'TAXONOMY_BULK_ALREADY_ROLLED_BACK', 409);
    }
  }

  function assertInventory(plan, snapshots) {
    const actual = snapshots.map(snapshot => ({
      id: snapshot.id,
      version: snapshot.version,
      fingerprint: hash(snapshot.bytes),
    }));
    if (!isDeepStrictEqual(actual, plan.inventory)) {
      throw failure(
        'Инструкции или их черновики изменились. Создайте новый предпросмотр.',
        'TAXONOMY_BULK_PREVIEW_CONFLICT',
        409,
      );
    }
  }

  function stateForRecovery(plan) {
    const snapshots = selectedSnapshots(store.read(), plan.ids);
    const actualKeys = snapshots.map(key).sort();
    const expectedKeys = plan.inventory.map(key).sort();
    if (!isDeepStrictEqual(actualKeys, expectedKeys)) {
      throw failure(
        'Состав опубликованных версий и черновиков изменился. Требуется проверка резервной копии.',
        'TAXONOMY_BULK_RECOVERY_CONFLICT',
        409,
      );
    }
    const byKey = new Map(snapshots.map(snapshot => [key(snapshot), snapshot]));
    const states = plan.slots.map(slot => {
      const snapshot = byKey.get(key(slot));
      const fingerprint = hash(snapshot.bytes);
      if (fingerprint !== slot.beforeHash && fingerprint !== slot.afterHash) {
        throw failure(
          'Файлы содержат изменения вне незавершённой операции. Восстановление остановлено.',
          'TAXONOMY_BULK_RECOVERY_CONFLICT',
          409,
          { conflicts: [{ id: slot.id, version: slot.version }] },
        );
      }
      return {
        slot,
        snapshot,
        after: fingerprint === slot.afterHash && slot.afterHash !== slot.beforeHash,
      };
    });
    return states;
  }

  function restore(plan, assertHeld) {
    const states = stateForRecovery(plan);
    for (const { slot, snapshot, after } of states) {
      if (!after) continue;
      assertHeld();
      store.writeBytes(snapshot, Buffer.from(slot.beforeBase64, 'base64'), { assertHeld });
    }
    store.refresh();
    const restored = stateForRecovery(plan);
    if (restored.some(item => item.after))
      throw failure('Не удалось восстановить все версии', 'TAXONOMY_BULK_RECOVERY_CONFLICT', 409);
  }

  function resultFor(plan, status) {
    return {
      operationId: plan.id,
      status,
      kind: plan.kind,
      counts: structuredClone(plan.counts),
      completedAt: new Date(clock()).toISOString(),
      ...(plan.rollbackOf ? { rollbackOf: plan.rollbackOf } : {}),
    };
  }

  return {
    list(input = {}) {
      fields(input, ['query', 'section', 'tag', 'page', 'pageSize']);
      const { page, pageSize } = pagination(input);
      return taxonomyRepository.withLock(
        (registry, assertHeld) => {
          journal.assertNoPending();
          const catalog = getInstructionTaxonomyAssignmentCatalog(registry);
          if (
            input.query !== undefined &&
            (typeof input.query !== 'string' || input.query.length > 200)
          )
            throw failure('Поисковый запрос слишком длинный');
          const query = String(input.query ?? '')
            .trim()
            .toLocaleLowerCase('ru-RU');
          for (const [filter, choices] of [
            ['section', [...catalog.sections, ...catalog.legacyCategories]],
            ['tag', [...catalog.tags, ...catalog.legacyTags]],
          ])
            if (
              input[filter] !== undefined &&
              (typeof input[filter] !== 'string' ||
                (input[filter] && !choices.some(item => item.id === input[filter])))
            )
              throw failure('Неизвестное значение фильтра');
          const items = [...grouped(store.read()).entries()]
            .map(([id, versions]) => {
              const published = versions.find(snapshot => snapshot.version === 'published');
              const primary = (published ?? versions[0]).record;
              const section = registry.sections.find(
                item => item.code === primary.primaryCategoryId,
              );
              return {
                id,
                title: primary.title || id,
                publishedUrl: published ? getInstructionPublicPath(primary) : null,
                versions: versions.map(snapshot => ({
                  version: snapshot.version,
                  ...selection(snapshot.record),
                  revision: revision(snapshot.record),
                })),
                catalogId: section?.parentCode ?? null,
                sectionId: primary.primaryCategoryId ?? null,
                tagIds: [...(primary.tagIds ?? [])],
                hasDraft: versions.some(snapshot => snapshot.version === 'draft'),
              };
            })
            .filter(
              item =>
                (!query || `${item.title} ${item.id}`.toLocaleLowerCase('ru-RU').includes(query)) &&
                (!input.section ||
                  item.versions.some(version => version.primaryCategoryId === input.section)) &&
                (!input.tag || item.versions.some(version => version.tagIds.includes(input.tag))),
            )
            .sort((a, b) => a.id.localeCompare(b.id));
          assertHeld();
          return {
            revision: registry.revision,
            items: items.slice((page - 1) * pageSize, page * pageSize),
            total: items.length,
            page,
            pageSize,
          };
        },
        { waitMs: 5000 },
      );
    },

    preview(input, actor) {
      fields(input, ['ids', 'registryRevision', 'includeDrafts', 'action']);
      const ids = uniqueIds(input.ids);
      actorId(actor);
      if (input.includeDrafts !== true)
        throw failure('Массовая операция должна учитывать опубликованные версии и все черновики');
      return taxonomyRepository.withLock(
        (registry, assertHeld) => {
          journal.assertNoPending();
          if (!Number.isSafeInteger(input.registryRevision) || input.registryRevision < 0)
            throw failure('Передайте версию справочника', 'INVALID_TAXONOMY_REVISION');
          if (registry.revision !== input.registryRevision)
            throw failure(
              'Справочник изменился. Обновите выбранные раздел и теги.',
              'TAXONOMY_REVISION_CONFLICT',
              409,
            );
          const action = validateAction(input.action, registry);
          const snapshots = selectedSnapshots(store.read(), ids);
          validateRecords(snapshots, registry);
          const plan = buildPlan({
            kind: 'apply',
            actor,
            registry,
            action,
            ids,
            snapshots,
            transform: snapshot => changedRecord(snapshot.record, action, registry),
          });
          assertHeld();
          return previewDto(journal.savePreview(plan));
        },
        { waitMs: 5000 },
      );
    },

    apply(input, actor) {
      fields(input, ['previewId', 'confirmed']);
      if (input.confirmed !== true) throw failure('Подтвердите применение просмотренных изменений');
      const saved = journal.read(input.previewId);
      assertActor(saved, actor);
      if (saved.status === 'committed') return structuredClone(saved.result);
      return taxonomyRepository.withLock(
        (registry, assertHeld) => {
          journal.assertNoPending();
          const plan = journal.read(input.previewId);
          assertActor(plan, actor);
          if (plan.status === 'committed') return structuredClone(plan.result);
          if (plan.status !== 'preview')
            throw failure('Этот предпросмотр уже использован', 'TAXONOMY_BULK_CONSUMED', 409);
          if (clock() >= Date.parse(plan.expiresAt))
            throw failure(
              'Срок предпросмотра истёк. Создайте новый.',
              'TAXONOMY_BULK_PREVIEW_EXPIRED',
              409,
            );
          if (registry.revision !== plan.registryRevision)
            throw failure(
              'Справочник изменился. Создайте новый предпросмотр.',
              'TAXONOMY_BULK_PREVIEW_CONFLICT',
              409,
            );
          if (plan.rollbackOf) assertNotRolledBack(plan.rollbackOf);
          const snapshots = selectedSnapshots(store.read(), plan.ids);
          assertInventory(plan, snapshots);
          validateRecords(snapshots, registry);
          const byKey = new Map(snapshots.map(snapshot => [key(snapshot), snapshot]));
          assertHeld();
          journal.begin(plan.id);
          try {
            for (const slot of plan.slots) {
              assertHeld();
              store.writeBytes(byKey.get(key(slot)), Buffer.from(slot.afterBase64, 'base64'), {
                assertHeld,
              });
            }
            store.refresh();
            const state = stateForRecovery(plan);
            if (state.some(item => !item.after && item.slot.afterHash !== item.slot.beforeHash))
              throw new Error('Bulk write verification failed');
            const result = resultFor(plan, 'committed');
            assertHeld();
            journal.finish(plan.id, { status: 'committed', result });
            assertHeld();
            journal.clearActive(plan.id);
            return result;
          } catch (cause) {
            let durable;
            try {
              durable = journal.read(plan.id);
            } catch {
              throw failure(
                'Не удалось проверить результат записи журнала. Требуется восстановление операции.',
                'TAXONOMY_BULK_RECOVERY_REQUIRED',
                409,
                { operationId: plan.id },
              );
            }
            if (durable?.status === 'committed') {
              throw failure(
                'Изменения сохранены. Завершите восстановление журнала операции.',
                'TAXONOMY_BULK_RECOVERY_REQUIRED',
                409,
                { operationId: plan.id },
              );
            }
            try {
              restore(plan, assertHeld);
              const result = resultFor(plan, 'failed');
              journal.finish(plan.id, {
                status: 'failed',
                result,
                error: {
                  code: cause.code || 'BULK_WRITE_FAILED',
                  message: 'Применение остановлено; исходные файлы восстановлены',
                },
              });
              assertHeld();
              journal.clearActive(plan.id);
            } catch {
              throw failure(
                'Применение прервано. До восстановления операции изменения заблокированы.',
                'TAXONOMY_BULK_RECOVERY_REQUIRED',
                409,
                { operationId: plan.id },
              );
            }
            throw failure(
              'Не удалось применить изменения. Исходные файлы восстановлены.',
              'TAXONOMY_BULK_APPLY_FAILED',
              500,
              { operationId: plan.id },
            );
          }
        },
        { waitMs: 5000 },
      );
    },

    history(input = {}) {
      fields(input, ['page', 'pageSize']);
      const result = journal.list(pagination(input));
      return { ...result, items: result.items.map(summary) };
    },

    previewRollback(operationId, actor) {
      actorId(actor);
      return taxonomyRepository.withLock(
        (registry, assertHeld) => {
          journal.assertNoPending();
          const operation = journal.read(operationId);
          if (operation.status !== 'committed' || operation.kind !== 'apply')
            throw failure('Отменить можно завершённую массовую операцию');
          assertNotRolledBack(operation.id);
          const snapshots = selectedSnapshots(store.read(), operation.ids);
          const beforeKeys = operation.inventory.map(key).sort();
          if (!isDeepStrictEqual(snapshots.map(key).sort(), beforeKeys))
            throw failure(
              'Состав опубликованных версий и черновиков изменился',
              'TAXONOMY_BULK_ROLLBACK_CONFLICT',
              409,
            );
          validateRecords(snapshots, registry);
          const slots = new Map(operation.slots.map(slot => [key(slot), slot]));
          const conflicts = [];
          const replacements = new Map();
          for (const snapshot of snapshots) {
            const slot = slots.get(key(snapshot));
            if (!slot) continue;
            const before = JSON.parse(Buffer.from(slot.beforeBase64, 'base64').toString('utf8'));
            const after = JSON.parse(Buffer.from(slot.afterBase64, 'base64').toString('utf8'));
            if (
              !isDeepStrictEqual(managed(snapshot.record), managed(after)) ||
              revision(snapshot.record) < revision(after)
            ) {
              conflicts.push({ id: snapshot.id, version: snapshot.version });
              continue;
            }
            const restored = structuredClone(snapshot.record);
            for (const field of MANAGED_FIELDS) {
              if (Object.hasOwn(before, field)) restored[field] = structuredClone(before[field]);
              else delete restored[field];
            }
            validateInstructionTaxonomyAssignment(selection(restored), { registry });
            replacements.set(key(snapshot), restored);
          }
          if (conflicts.length)
            throw failure(
              'Назначения изменились после операции. Автоматическая отмена остановлена.',
              'TAXONOMY_BULK_ROLLBACK_CONFLICT',
              409,
              { conflicts },
            );
          const action = { type: 'rollback', operationId: operation.id };
          const plan = buildPlan({
            kind: 'rollback',
            actor,
            registry,
            action,
            ids: operation.ids,
            snapshots,
            rollbackOf: operation.id,
            transform: snapshot => {
              const record = replacements.get(key(snapshot)) ?? snapshot.record;
              return {
                record,
                changed: !isDeepStrictEqual(managed(record), managed(snapshot.record)),
              };
            },
          });
          assertHeld();
          return previewDto(journal.savePreview(plan));
        },
        { waitMs: 5000 },
      );
    },

    recover(input, actor) {
      fields(input, ['operationId', 'confirmed']);
      actorId(actor);
      if (input.confirmed !== true)
        throw failure('Подтвердите восстановление незавершённой операции');
      return taxonomyRepository.withLock(
        (_registry, assertHeld) => {
          const marker = journal.getActive();
          const plan = journal.read(input.operationId);
          if (!marker) {
            if (['committed', 'failed', 'recovered'].includes(plan.status))
              return structuredClone(plan.result);
            throw failure(
              'Незавершённая операция не найдена',
              'TAXONOMY_BULK_OPERATION_NOT_FOUND',
              404,
            );
          }
          if (marker.operationId !== plan.id || marker.kind !== plan.kind)
            throw failure(
              'Сейчас ожидает восстановления другая операция',
              'TAXONOMY_BULK_RECOVERY_CONFLICT',
              409,
            );
          if (plan.status === 'committed') {
            assertHeld();
            journal.clearActive(plan.id);
            store.refresh();
            return structuredClone(plan.result);
          }
          restore(plan, assertHeld);
          const result = resultFor(plan, 'recovered');
          assertHeld();
          journal.finish(plan.id, { status: 'recovered', result, recoveredAt: result.completedAt });
          assertHeld();
          journal.clearActive(plan.id);
          return result;
        },
        { waitMs: 5000, allowPendingOperation: true },
      );
    },

    status() {
      const marker = journal.getActive();
      return {
        blocked: Boolean(marker),
        pendingOperation: marker ? summary(journal.read(marker.operationId)) : null,
      };
    },
  };
}

export const instructionTaxonomyBulkService = createInstructionTaxonomyBulkService();
