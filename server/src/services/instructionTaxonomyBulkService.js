import { createHash } from 'node:crypto';
import { isDeepStrictEqual, TextDecoder } from 'node:util';

import { getInstructionPublicPath } from '../shared/instructionDocument.js';
import { InstructionEditorError } from './instructionEditorError.js';
import {
  getInstructionTaxonomyAssignmentCatalog,
  validateInstructionTaxonomyAssignment,
} from './instructionTaxonomyAssignmentCatalog.js';
import { createInstructionTaxonomyBindingStore } from './instructionTaxonomyBindingStore.js';
import { createInstructionTaxonomyBulkJournal } from './instructionTaxonomyBulkJournal.js';
import {
  buildInstructionTaxonomyCsvImport,
  fingerprintInstructionTaxonomyImportAddresses,
} from './instructionTaxonomyCsvImport.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';
import { getInstructionTaxonomyCatalog } from './instructionTaxonomyService.js';

const MANAGED_FIELDS = ['primaryCategoryId', 'tagIds', 'taxonomyMeta'];
const MAX_IDS = 5000;
const PREVIEW_LIFETIME_MS = 30 * 60 * 1000;
const TAXONOMY_SCHEMA_VERSION = getInstructionTaxonomyCatalog().version;
const MAX_CSV_BYTES = 4 * 1024 * 1024;

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

function importBytes(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_CSV_BYTES / 3) * 4) {
    throw failure('Передайте CSV в допустимом размере', 'INVALID_TAXONOMY_CSV_INPUT');
  }
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length > MAX_CSV_BYTES || bytes.toString('base64') !== value) {
    throw failure('Некорректная передача файла CSV', 'INVALID_TAXONOMY_CSV_INPUT');
  }
  return bytes;
}

function emptyCounts() {
  return {
    selectedDocuments: 0,
    changedDocuments: 0,
    changedVersions: 0,
    updatedVersions: 0,
    unchangedDocuments: 0,
  };
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
    ...(plan.importReport ? { importReport: plan.importReport } : {}),
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
    ...(plan.importReport
      ? {
          importSummary: {
            file: plan.importReport.file,
            tagMode: plan.importReport.tagMode,
            counts: plan.importReport.counts,
          },
        }
      : {}),
    ...(plan.result?.completedAt ? { completedAt: plan.result.completedAt } : {}),
    ...(plan.rollbackOf ? { rollbackOf: plan.rollbackOf } : {}),
  });
}

export function createInstructionTaxonomyBulkService({
  taxonomyRepository = instructionTaxonomyRegistryRepository,
  store = createInstructionTaxonomyBindingStore(),
  origin = process.env.SITE_URL || 'https://boykovdocs.ru',
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

  const readSnapshots = assertHeld => store.read({ metadataOnly: true, assertHeld });
  const snapshotFingerprint = snapshot => snapshot.fingerprint ?? hash(snapshot.bytes);
  const snapshotBytes = snapshot =>
    typeof store.readBytes === 'function' ? store.readBytes(snapshot) : snapshot.bytes;

  function validateSlotBytes(plan, assertHeld) {
    journal.validateSlotBytes(plan, { assertHeld });
  }

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

  function validateRecords(snapshots, registry, assertHeld) {
    const conflicts = [];
    for (const snapshot of snapshots) {
      assertHeld?.();
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

  function changedSelection(record, selected, registry, { categoryManual = false } = {}) {
    const next = { ...record, ...selected };
    const before = selection(record);
    if (isDeepStrictEqual(before, selection(next))) return { record, changed: false };
    const canonicalSection = registry.sections.some(
      section => section.code === next.primaryCategoryId,
    );
    next.taxonomyMeta = {
      ...record.taxonomyMeta,
      ...(categoryManual ? { categorySource: 'manual' } : {}),
      tagsSource: 'manual',
      needsReview: !next.primaryCategoryId || (!canonicalSection && !next.tagIds?.length),
      schemaVersion: record.taxonomyMeta?.schemaVersion ?? TAXONOMY_SCHEMA_VERSION,
    };
    validateInstructionTaxonomyAssignment(selection(next), { registry });
    return { record: next, changed: true };
  }

  function changedRecord(record, action, registry) {
    const before = selection(record);
    const next =
      action.type === 'set-section'
        ? { primaryCategoryId: action.sectionId }
        : {
            tagIds:
              action.type === 'add-tags'
                ? [...new Set([...before.tagIds, ...action.tagIds])]
                : before.tagIds.filter(id => !action.tagIds.includes(id)),
          };
    return changedSelection(record, next, registry, {
      categoryManual: action.type === 'set-section',
    });
  }

  function buildPlan({
    kind,
    actor,
    registry,
    action,
    ids,
    snapshots,
    transform,
    rollbackOf,
    createSlot,
    assertHeld,
  }) {
    const rows = [];
    const slots = [];
    const counts = { ...emptyCounts(), selectedDocuments: ids.length };
    const byId = grouped(snapshots);
    for (const id of ids) {
      assertHeld?.();
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
        assertHeld?.();
        if (change.changed) counts.changedVersions += 1;
        const after = { ...change.record, revision: revision(change.snapshot.record) + 1 };
        const bytes = store.serialize(change.snapshot, after);
        slots.push(
          createSlot({
            id,
            version: change.snapshot.version,
            beforeBytes: snapshotBytes(change.snapshot),
            afterBytes: bytes,
          }),
        );
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
        fingerprint: snapshotFingerprint(snapshot),
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

  function assertInventory(plan, snapshots, assertHeld) {
    const actual = snapshots.map(snapshot => ({
      id: snapshot.id,
      version: snapshot.version,
      fingerprint: snapshotFingerprint(snapshot),
    }));
    if (!isDeepStrictEqual(actual, plan.inventory)) {
      throw failure(
        'Инструкции или их черновики изменились. Создайте новый предпросмотр.',
        'TAXONOMY_BULK_PREVIEW_CONFLICT',
        409,
      );
    }
    assertHeld?.();
  }

  function stateForRecovery(plan, assertHeld) {
    const snapshots = selectedSnapshots(readSnapshots(assertHeld), plan.ids);
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
      assertHeld?.();
      const snapshot = byKey.get(key(slot));
      const fingerprint = snapshotFingerprint(snapshot);
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
    validateSlotBytes(plan, assertHeld);
    const states = stateForRecovery(plan, assertHeld);
    for (const { slot, snapshot, after } of states) {
      if (!after) continue;
      assertHeld();
      store.writeBytes(snapshot, journal.readSlotBytes(plan, slot, 'before'), { assertHeld });
    }
    store.refresh();
    const restored = stateForRecovery(plan, assertHeld);
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
          const items = [...grouped(readSnapshots(assertHeld)).entries()]
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
          const snapshots = selectedSnapshots(readSnapshots(assertHeld), ids);
          validateRecords(snapshots, registry, assertHeld);
          const plan = journal.savePreview(createSlot =>
            buildPlan({
              kind: 'apply',
              actor,
              registry,
              action,
              ids,
              snapshots,
              transform: snapshot => changedRecord(snapshot.record, action, registry),
              createSlot,
              assertHeld,
            }),
          );
          assertHeld();
          return previewDto(plan);
        },
        { waitMs: 5000 },
      );
    },

    previewImport(input, actor) {
      fields(input, [
        'fileName',
        'csvBase64',
        'registryRevision',
        'includeDrafts',
        'tagMode',
        'replaceConfirmed',
      ]);
      actorId(actor);
      if (input.includeDrafts !== true) {
        throw failure('Импорт должен учитывать опубликованные версии и все черновики');
      }
      if (
        !['add', 'replace'].includes(input.tagMode) ||
        typeof input.replaceConfirmed !== 'boolean'
      ) {
        throw failure('Выберите режим тегов и подтвердите параметры импорта');
      }
      if (input.tagMode === 'replace' && !input.replaceConfirmed) {
        throw failure(
          'Отдельно подтвердите полную замену тегов перед предпросмотром',
          'TAXONOMY_CSV_REPLACE_CONFIRMATION_REQUIRED',
        );
      }
      const bytes = importBytes(input.csvBase64);
      return taxonomyRepository.withLock(
        (registry, assertHeld) => {
          journal.assertNoPending();
          if (!Number.isSafeInteger(input.registryRevision) || input.registryRevision < 0) {
            throw failure('Передайте версию справочника', 'INVALID_TAXONOMY_REVISION');
          }
          if (registry.revision !== input.registryRevision) {
            throw failure(
              'Справочник изменился. Обновите его и повторите предпросмотр импорта.',
              'TAXONOMY_REVISION_CONFLICT',
              409,
            );
          }
          const allSnapshots = readSnapshots(assertHeld);
          const { report, assignments } = buildInstructionTaxonomyCsvImport({
            bytes,
            fileName: input.fileName,
            registry,
            snapshots: allSnapshots,
            tagMode: input.tagMode,
            origin,
          });
          const action = {
            type: 'import-csv',
            tagMode: input.tagMode,
            fileName: report.file.name,
            fileSha256: report.file.sha256,
          };
          if (!assignments.length) {
            assertHeld();
            return structuredClone({
              previewId: null,
              kind: 'apply',
              registryRevision: registry.revision,
              action,
              counts: emptyCounts(),
              rows: [],
              importReport: report,
            });
          }
          const ids = uniqueIds(assignments.map(assignment => assignment.id));
          const snapshots = selectedSnapshots(allSnapshots, ids);
          validateRecords(snapshots, registry, assertHeld);
          const byId = new Map(assignments.map(assignment => [assignment.id, assignment]));
          const plan = journal.savePreview(createSlot => {
            const built = buildPlan({
              kind: 'apply',
              actor,
              registry,
              action,
              ids,
              snapshots,
              transform: snapshot => {
                const assignment = byId.get(snapshot.id);
                const tagIds =
                  input.tagMode === 'replace'
                    ? [...assignment.tagIds]
                    : [...new Set([...(snapshot.record.tagIds ?? []), ...assignment.tagIds])];
                return changedSelection(
                  snapshot.record,
                  { primaryCategoryId: assignment.sectionId, tagIds },
                  registry,
                  { categoryManual: true },
                );
              },
              createSlot,
              assertHeld,
            });
            built.importReport = report;
            built.importUrlFingerprint = fingerprintInstructionTaxonomyImportAddresses(
              allSnapshots,
              { origin },
            );
            assertHeld();
            return built;
          });
          assertHeld();
          return previewDto(plan);
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
          const allSnapshots = readSnapshots(assertHeld);
          if (
            plan.importUrlFingerprint &&
            plan.importUrlFingerprint !==
              fingerprintInstructionTaxonomyImportAddresses(allSnapshots, { origin })
          ) {
            throw failure(
              'Адреса опубликованных инструкций изменились. Создайте новый предпросмотр импорта.',
              'TAXONOMY_BULK_PREVIEW_CONFLICT',
              409,
            );
          }
          const snapshots = selectedSnapshots(allSnapshots, plan.ids);
          assertInventory(plan, snapshots, assertHeld);
          validateRecords(snapshots, registry, assertHeld);
          const byKey = new Map(snapshots.map(snapshot => [key(snapshot), snapshot]));
          assertHeld();
          journal.begin(plan.id, { assertHeld });
          try {
            for (const slot of plan.slots) {
              assertHeld();
              store.writeBytes(byKey.get(key(slot)), journal.readSlotBytes(plan, slot, 'after'), {
                assertHeld,
              });
            }
            store.refresh();
            const state = stateForRecovery(plan, assertHeld);
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
          const snapshots = selectedSnapshots(readSnapshots(assertHeld), operation.ids);
          const beforeKeys = operation.inventory.map(key).sort();
          if (!isDeepStrictEqual(snapshots.map(key).sort(), beforeKeys))
            throw failure(
              'Состав опубликованных версий и черновиков изменился',
              'TAXONOMY_BULK_ROLLBACK_CONFLICT',
              409,
            );
          validateRecords(snapshots, registry, assertHeld);
          validateSlotBytes(operation, assertHeld);
          const slots = new Map(operation.slots.map(slot => [key(slot), slot]));
          const conflicts = [];
          const replacements = new Map();
          for (const snapshot of snapshots) {
            assertHeld();
            const slot = slots.get(key(snapshot));
            if (!slot) continue;
            const before = JSON.parse(
              new TextDecoder('utf-8', { fatal: true }).decode(
                journal.readSlotBytes(operation, slot, 'before'),
              ),
            );
            const after = JSON.parse(
              new TextDecoder('utf-8', { fatal: true }).decode(
                journal.readSlotBytes(operation, slot, 'after'),
              ),
            );
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
          const plan = journal.savePreview(createSlot =>
            buildPlan({
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
              createSlot,
              assertHeld,
            }),
          );
          assertHeld();
          return previewDto(plan);
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
