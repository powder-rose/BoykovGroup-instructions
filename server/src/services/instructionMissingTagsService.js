import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { getInstructionDocument, getInstructionPublicPath } from '../shared/instructionDocument.js';
import { createInstructionTaxonomyBindingStore } from './instructionTaxonomyBindingStoreCore.js';
import {
  assertNoPendingTaxonomyBulkOperation,
  createInstructionTaxonomyBulkJournal,
} from './instructionTaxonomyBulkJournal.js';
import { createInstructionTaxonomyBulkService } from './instructionTaxonomyBulkCore.js';
import {
  normalizeInstructionTaxonomyEntity,
  validateInstructionTaxonomyRegistry,
} from './instructionTaxonomyRegistryModel.js';
import { createInstructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';

const ACTOR = 'reviewed-missing-tags-cli';
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha256(JSON.stringify(value));

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function fields(value, allowed) {
  requireValue(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).every(key => allowed.includes(key)),
    'Unexpected input fields',
  );
}

function readJson(file) {
  const stat = fs.lstatSync(file);
  requireValue(
    stat.isFile() && stat.size <= MAX_JSON_BYTES,
    'Expected a regular bounded JSON file',
  );
  const bytes = fs.readFileSync(file);
  return {
    value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u, '')),
    sha256: sha256(bytes),
  };
}

function writeJson(file, value) {
  const descriptor = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function context(sourceRoot) {
  const root = fs.realpathSync(sourceRoot);
  const published = path.join(root, 'server/src/data/instructions');
  requireValue(
    fs.lstatSync(published).isDirectory(),
    'Source must contain server/src/data/instructions',
  );
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(root, 'server/data/instruction-taxonomy.json'),
  });
  // The CLI is offline. Metadata scans read each full record at most once at a time;
  // no application, cache loader, HTTP server or background workers are started.
  const store = createInstructionTaxonomyBindingStore({
    repository: { dir: published, getPublicReferencesFresh() {} },
    draftsDirectory: path.join(root, 'server/src/data/instruction-drafts'),
  });
  return { root, taxonomyRepository, store };
}

function outsideSource(root, directory) {
  const resolved = path.join(fs.realpathSync(path.dirname(directory)), path.basename(directory));
  const relative = path.relative(root, resolved);
  requireValue(
    relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative),
    'Output must be outside the source',
  );
  return resolved;
}

function validateBundle(bundle) {
  fields(bundle, ['schemaVersion', 'sourceCsvSha256', 'tags', 'assignments']);
  requireValue(
    bundle.schemaVersion === 1 && /^[a-f0-9]{64}$/u.test(bundle.sourceCsvSha256),
    'Invalid bundle provenance',
  );
  requireValue(Array.isArray(bundle.tags) && bundle.tags.length <= 500, 'Invalid tag definitions');
  for (const tag of bundle.tags) {
    fields(tag, ['code', 'name', 'slug']);
    normalizeInstructionTaxonomyEntity('tag', tag);
  }
  requireValue(
    Array.isArray(bundle.assignments) &&
      bundle.assignments.length > 0 &&
      bundle.assignments.length <= 5000,
    'Expected 1 to 5000 reviewed assignments',
  );
  const ids = new Set();
  for (const item of bundle.assignments) {
    fields(item, ['id', 'url', 'title', 'primaryCategoryId', 'documentSha256', 'tagIds']);
    requireValue(
      typeof item.id === 'string' &&
        item.id.length > 0 &&
        item.id.length <= 512 &&
        !ids.has(item.id) &&
        typeof item.title === 'string' &&
        typeof item.url === 'string' &&
        (item.primaryCategoryId === null || typeof item.primaryCategoryId === 'string') &&
        /^[a-f0-9]{64}$/u.test(item.documentSha256) &&
        Array.isArray(item.tagIds) &&
        item.tagIds.length > 0 &&
        item.tagIds.length <= 500 &&
        item.tagIds.every(id => typeof id === 'string' && id.length <= 64) &&
        new Set(item.tagIds).size === item.tagIds.length,
      'Invalid or duplicate reviewed assignment',
    );
    ids.add(item.id);
    const url = new URL(item.url);
    requireValue(
      url.origin === 'https://boykovdocs.ru' && !url.search && !url.hash,
      'Unexpected instruction URL',
    );
  }
}

function expandedRegistry(before, bundle) {
  const after = structuredClone(before);
  for (const tag of bundle.tags) {
    const existing = after.tags.find(
      item => item.code === tag.code || item.slug === tag.slug || item.name === tag.name,
    );
    if (existing) {
      requireValue(
        existing.code === tag.code &&
          existing.slug === tag.slug &&
          existing.name === tag.name &&
          existing.status === 'published' &&
          existing.indexingEnabled === false,
        `Tag collision: ${tag.code} / ${tag.name}`,
      );
      continue;
    }
    after.tags.push(
      normalizeInstructionTaxonomyEntity('tag', {
        ...tag,
        status: 'published',
        indexingEnabled: false,
        sortOrder: after.tags.length,
      }),
    );
  }
  if (after.tags.length !== before.tags.length) after.revision += 1;
  validateInstructionTaxonomyRegistry(after);
  return after;
}

function reviewedIds(bundle, store) {
  const snapshots = store.read({ metadataOnly: true });
  const published = new Map(
    snapshots.filter(item => item.version === 'published').map(item => [item.id, item]),
  );
  const skipped = [];
  const ids = [];
  for (const item of bundle.assignments) {
    const snapshot = published.get(item.id);
    requireValue(snapshot, `Published instruction is missing: ${item.id}`);
    requireValue(
      String(snapshot.record.status || '').toLowerCase() !== 'draft' &&
        String(snapshot.record.seoStatus || '').toLowerCase() !== 'draft',
      `Instruction is not public: ${item.id}`,
    );
    if (snapshot.record.tagIds?.length) {
      skipped.push({ id: item.id, reason: 'already-tagged' });
      continue;
    }
    const record = JSON.parse(
      store
        .readBytes(snapshot)
        .toString('utf8')
        .replace(/^\uFEFF/u, ''),
    );
    requireValue(
      record.title === item.title &&
        getInstructionPublicPath(record) === new URL(item.url).pathname &&
        (record.primaryCategoryId ?? null) === item.primaryCategoryId &&
        digest(getInstructionDocument(record)) === item.documentSha256,
      `Instruction differs from the reviewed source: ${item.id}`,
    );
    ids.push(item.id);
  }
  requireValue(ids.length > 0, 'No remaining untagged published instructions in this bundle');
  return { ids: ids.sort(), skipped };
}

function actionFor(bundle, ids) {
  const selected = new Set(ids);
  return {
    type: 'assign-missing-tags',
    assignments: bundle.assignments
      .filter(item => selected.has(item.id))
      .map(({ id, tagIds }) => ({ id, tagIds }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function signature(plan) {
  return digest({
    ids: plan.ids,
    action: plan.action,
    counts: plan.counts,
    inventory: plan.inventory
      .map(item => ({ ...item }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    slots: plan.slots.map(({ id, version, beforeHash, afterHash }) => ({
      id,
      version,
      beforeHash,
      afterHash,
    })),
  });
}

export function previewMissingInstructionTags({ sourceRoot, bundleFile, outputDirectory }) {
  const { root, store, taxonomyRepository } = context(sourceRoot);
  const output = outsideSource(root, path.resolve(outputDirectory));
  requireValue(!fs.existsSync(output), 'Preview output must be a new directory');
  const loaded = readJson(bundleFile);
  validateBundle(loaded.value);
  assertNoPendingTaxonomyBulkOperation(taxonomyRepository.operationsDirectory);
  const before = taxonomyRepository.read();
  const after = expandedRegistry(before, loaded.value);
  const { ids, skipped } = reviewedIds(loaded.value, store);
  fs.mkdirSync(output, { mode: 0o700 });
  const journal = createInstructionTaxonomyBulkJournal({ directory: path.join(output, 'journal') });
  const repository = { withLock: callback => callback(structuredClone(after), () => {}) };
  const service = createInstructionTaxonomyBulkService({
    taxonomyRepository: repository,
    store,
    journal,
  });
  const preview = service.preview(
    {
      ids,
      registryRevision: after.revision,
      includeDrafts: true,
      action: actionFor(loaded.value, ids),
    },
    ACTOR,
  );
  requireValue(
    isDeepStrictEqual(before, taxonomyRepository.read()),
    'Registry changed during preview',
  );
  const review = {
    schemaVersion: 1,
    bundleSha256: loaded.sha256,
    registryBefore: before,
    registryAfter: after,
    previewId: preview.previewId,
    planSignature: signature(journal.read(preview.previewId)),
    ids,
    skipped,
    counts: preview.counts,
  };
  writeJson(path.join(output, 'review.json'), review);
  writeJson(path.join(output, 'preview.json'), preview);
  fs.copyFileSync(bundleFile, path.join(output, 'assignments.json'), fs.constants.COPYFILE_EXCL);
  fs.chmodSync(path.join(output, 'assignments.json'), 0o600);
  return {
    status: 'preview',
    writesToSource: false,
    outputDirectory: output,
    newTags: after.tags.length - before.tags.length,
    skipped: skipped.length,
    ...preview.counts,
  };
}

export function applyMissingInstructionTags({
  sourceRoot,
  previewDirectory,
  writersStopped = false,
}) {
  requireValue(
    writersStopped === true,
    'Stop every source writer and acknowledge --writers-stopped',
  );
  const { root, store, taxonomyRepository } = context(sourceRoot);
  const output = outsideSource(root, fs.realpathSync(previewDirectory));
  const review = readJson(path.join(output, 'review.json')).value;
  const loaded = readJson(path.join(output, 'assignments.json'));
  validateBundle(loaded.value);
  requireValue(
    review.schemaVersion === 1 && loaded.sha256 === review.bundleSha256,
    'Reviewed bundle checksum mismatch',
  );
  requireValue(
    isDeepStrictEqual(expandedRegistry(review.registryBefore, loaded.value), review.registryAfter),
    'Reviewed registry mismatch',
  );
  const savedJournal = createInstructionTaxonomyBulkJournal({
    directory: path.join(output, 'journal'),
  });
  const saved = savedJournal.read(review.previewId);
  requireValue(signature(saved) === review.planSignature, 'Reviewed preview mismatch');
  requireValue(
    isDeepStrictEqual(saved.ids, review.ids) &&
      isDeepStrictEqual(saved.action, actionFor(loaded.value, review.ids)),
    'Reviewed selection mismatch',
  );
  const journal = createInstructionTaxonomyBulkJournal({
    directory: taxonomyRepository.operationsDirectory,
  });
  const service = createInstructionTaxonomyBulkService({ taxonomyRepository, store, journal });
  const receiptFile = path.join(output, 'operation.json');
  if (fs.existsSync(receiptFile)) {
    const receipt = readJson(receiptFile).value;
    const operation = journal.read(receipt.operationId);
    requireValue(
      operation.actor === ACTOR && signature(operation) === review.planSignature,
      'Operation receipt mismatch',
    );
    // Existing service recovery rules handle committed, pending and failed operations.
    return service.apply({ previewId: operation.id, confirmed: true }, ACTOR);
  }
  journal.assertNoPending();
  const current = taxonomyRepository.read();
  requireValue(
    isDeepStrictEqual(current, review.registryBefore) ||
      isDeepStrictEqual(current, review.registryAfter),
    'Registry changed since preview',
  );
  const currentSelection = reviewedIds(loaded.value, store);
  requireValue(
    isDeepStrictEqual(currentSelection.ids, review.ids),
    'Selection changed since preview; create a new preview',
  );
  const snapshots = store.read({ metadataOnly: true }).filter(item => review.ids.includes(item.id));
  const inventory = snapshots.map(({ id, version, fingerprint }) => ({ id, version, fingerprint }));
  requireValue(
    isDeepStrictEqual(
      inventory.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      [...saved.inventory].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ),
    'Instruction versions changed since preview',
  );
  savedJournal.validateSlotBytes(saved);
  if (!isDeepStrictEqual(current, review.registryAfter)) {
    taxonomyRepository.update(() => structuredClone(review.registryAfter), {
      expectedRevision: current.revision,
    });
  }
  const preview = service.preview(
    {
      ids: review.ids,
      registryRevision: review.registryAfter.revision,
      includeDrafts: true,
      action: actionFor(loaded.value, review.ids),
    },
    ACTOR,
  );
  const operation = journal.read(preview.previewId);
  requireValue(
    signature(operation) === review.planSignature,
    'Prepared operation differs from reviewed preview',
  );
  writeJson(receiptFile, { operationId: operation.id });
  const result = service.apply({ previewId: operation.id, confirmed: true }, ACTOR);
  writeJson(path.join(output, 'result.json'), result);
  return result;
}

export function recoverMissingInstructionTags({ sourceRoot, operationId, writersStopped = false }) {
  requireValue(
    writersStopped === true,
    'Stop every source writer and acknowledge --writers-stopped',
  );
  const { store, taxonomyRepository } = context(sourceRoot);
  const journal = createInstructionTaxonomyBulkJournal({
    directory: taxonomyRepository.operationsDirectory,
  });
  const operation = journal.read(operationId);
  const source = operation.kind === 'rollback' ? journal.read(operation.rollbackOf) : operation;
  requireValue(
    source.action.type === 'assign-missing-tags',
    'This CLI only recovers missing-tag operations',
  );
  return createInstructionTaxonomyBulkService({ taxonomyRepository, store, journal }).recover(
    { operationId, confirmed: true },
    ACTOR,
  );
}
