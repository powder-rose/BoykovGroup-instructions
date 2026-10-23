import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionsRouter } from '../src/routes/adminInstructions.js';
import { createAdminInstructionTaxonomyOperationsRouter } from '../src/routes/adminInstructionTaxonomyOperations.js';
import { createAdminInstructionTaxonomyRouter } from '../src/routes/adminInstructionTaxonomy.js';
import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import { getInstructionTaxonomyAssignmentCatalog } from '../src/services/instructionTaxonomyAssignmentCatalog.js';
import { createInstructionTaxonomyBindingStore } from '../src/services/instructionTaxonomyBindingStore.js';
import { createInstructionTaxonomyBulkJournal } from '../src/services/instructionTaxonomyBulkJournal.js';
import { createInstructionTaxonomyBulkService } from '../src/services/instructionTaxonomyBulkService.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const legacyTag = 'sosudy-pod-davleniem';
const allIds = ['active', 'obsolete', 'draft-only', 'unchanged'];

function record(id, overrides = {}) {
  return {
    id,
    title: `Инструкция ${id}`,
    h1: `Сохранённый H1 ${id}`,
    slug: `instruction-${id}-AbC123`,
    slugAliases: [`old-${id}-XyZ789`],
    profession: 'Электромонтёр',
    source: 'manual',
    intro: 'Исходное введение.',
    webIntro: 'Введение для страницы.',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Исходный текст.' }] }],
    },
    explanationContent: { type: 'doc', content: [] },
    sections: [{ title: 'Общие требования', paragraphs: ['Исходный текст.'] }],
    seoTitle: `SEO ${id}`,
    seoDescription: 'Исходное SEO-описание.',
    contentHash: `existing-content-hash-${id}`,
    createdAt: '2026-08-27T09:00:00.000Z',
    publishedAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-09-03T11:00:00.000Z',
    version: '2.4',
    versions: [{ version: '2.3', contentHash: 'previous-content-hash' }],
    files: [{ name: 'instruction.pdf', path: `/documents/${id}.pdf` }],
    editorialMeta: {
      seoReady: true,
      seoAuthor: 'Редактор',
      seoUpdatedAt: '2026-09-02T08:00:00.000Z',
    },
    revision: 5,
    status: 'published',
    primaryCategoryId: 'P10',
    tagIds: [legacyTag, 'T47'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual', retainedNote: 'keep' },
    ...overrides,
  };
}

function unchangedFields(value) {
  const {
    revision: _revision,
    primaryCategoryId: _primaryCategoryId,
    tagIds: _tagIds,
    taxonomyMeta: _taxonomyMeta,
    ...other
  } = value;
  return other;
}

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-bulk-flow-'));
  const publishedDirectory = path.join(directory, 'published');
  const draftsDirectory = path.join(directory, 'drafts');
  fs.mkdirSync(draftsDirectory);
  const repository = new InstructionsRepository(publishedDirectory);
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(directory, 'taxonomy.json'),
  });
  const bindingStore = createInstructionTaxonomyBindingStore({ repository, draftsDirectory });
  const journal = createInstructionTaxonomyBulkJournal({
    directory: taxonomyRepository.operationsDirectory,
  });
  const faults = { writes: 0, failAfterFirstWrite: false };
  const store = {
    ...bindingStore,
    writeBytes(snapshot, bytes, options) {
      faults.writes += 1;
      if (faults.failAfterFirstWrite && faults.writes > 1) {
        throw new Error('Injected interrupted batch and recovery write');
      }
      return bindingStore.writeBytes(snapshot, bytes, options);
    },
  };
  const service = createInstructionTaxonomyBulkService({ taxonomyRepository, store, journal });
  const editor = createInstructionEditorService({
    repository,
    taxonomyRepository,
    draftsDirectory,
    saveSnapshot: () => {},
  });
  const taxonomy = createInstructionTaxonomyRegistryService({
    repository: taxonomyRepository,
    getInstructions: () => bindingStore.read().map(snapshot => snapshot.record),
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { role: 'admin', sub: 'bulk-integration-admin' };
    next();
  });
  app.use(
    '/operations',
    createAdminInstructionTaxonomyOperationsRouter({ service, exportProvider: () => '' }),
  );
  app.use('/taxonomy', createAdminInstructionTaxonomyRouter({ service: taxonomy }));
  app.use(
    '/editor',
    createAdminInstructionsRouter({
      service: editor,
      getAssignmentCatalog: () =>
        getInstructionTaxonomyAssignmentCatalog(taxonomyRepository.read()),
    }),
  );
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.message, code: error.code });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + route, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  function filename(id, version) {
    return version === 'published'
      ? path.join(publishedDirectory, `${id}.json`)
      : path.join(draftsDirectory, `${Buffer.from(id).toString('base64url')}.json`);
  }
  function write(value, version = 'published') {
    fs.writeFileSync(filename(value.id, version), `${JSON.stringify(value, null, 2)}\n`);
  }
  function read(id, version = 'published') {
    return JSON.parse(fs.readFileSync(filename(id, version), 'utf8'));
  }
  function bytes() {
    return Object.fromEntries(
      bindingStore
        .read()
        .map(snapshot => [`${snapshot.id}:${snapshot.version}`, snapshot.bytes.toString('base64')]),
    );
  }
  async function preview(ids, action) {
    return request('/operations/preview', 'POST', {
      ids,
      registryRevision: taxonomyRepository.read().revision,
      includeDrafts: true,
      action,
    });
  }
  async function apply(previewId) {
    return request('/operations/apply', 'POST', { previewId, confirmed: true });
  }
  function seed() {
    write(record('active'));
    write(
      record('active', {
        status: 'draft',
        revision: 7,
        primaryCategoryId: 'W02',
        tagIds: [legacyTag, 'T48'],
      }),
      'draft',
    );
    write(record('obsolete', { revision: 8, tagIds: ['T47'] }));
    write(
      record('obsolete', {
        status: 'draft',
        revision: 6,
        primaryCategoryId: 'W02',
        tagIds: ['T47'],
      }),
      'draft',
    );
    write(record('draft-only', { status: 'draft', revision: 2, tagIds: [] }), 'draft');
    write(record('unchanged', { revision: 3, primaryCategoryId: 'W02', tagIds: ['T48'] }));
  }
  return {
    directory,
    repository,
    taxonomyRepository,
    bindingStore,
    journal,
    faults,
    request,
    filename,
    write,
    read,
    bytes,
    preview,
    apply,
    seed,
  };
}

test('HTTP bulk changes preserve both draft orderings, exact tags and every non-taxonomy document field', async t => {
  const f = await fixture(t);
  f.seed();
  const before = f.bindingStore.read();
  const initialBytes = f.bytes();
  const preview = await f.preview(allIds, { type: 'set-section', sectionId: 'W02' });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.body.counts, {
    selectedDocuments: 4,
    changedDocuments: 3,
    changedVersions: 3,
    updatedVersions: 5,
    unchangedDocuments: 1,
  });
  assert.deepEqual(f.bytes(), initialBytes);
  assert.equal(f.faults.writes, 0);

  const unconfirmed = await f.request('/operations/apply', 'POST', {
    previewId: preview.body.previewId,
    confirmed: false,
  });
  assert.equal(unconfirmed.status, 400);
  assert.deepEqual(f.bytes(), initialBytes);

  const applied = await f.apply(preview.body.previewId);
  assert.equal(applied.status, 200);
  assert.equal(applied.body.status, 'committed');
  for (const snapshot of before) {
    const current = f.read(snapshot.id, snapshot.version);
    assert.deepEqual(unchangedFields(current), unchangedFields(snapshot.record));
    assert.equal(current.taxonomyMeta.retainedNote, 'keep');
    assert.equal(current.primaryCategoryId, 'W02');
    assert.deepEqual(current.tagIds, snapshot.record.tagIds);
    assert.equal(
      current.revision,
      snapshot.record.revision + (snapshot.id === 'unchanged' ? 0 : 1),
    );
  }
  assert.ok(f.read('active', 'draft').revision > f.read('active').revision);
  assert.ok(f.read('obsolete', 'draft').revision < f.read('obsolete').revision);
  const committedBytes = f.bytes();
  const writes = f.faults.writes;
  const repeated = await f.apply(preview.body.previewId);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.operationId, applied.body.operationId);
  assert.deepEqual(f.bytes(), committedBytes);
  assert.equal(f.faults.writes, writes);

  const usage = await f.request('/taxonomy/section/P10/usage');
  assert.deepEqual(usage.body.usage, { references: 0, publishedInstructions: 0 });
  const removed = await f.request('/taxonomy/section/P10', 'DELETE', { expectedRevision: 0 });
  assert.equal(removed.status, 200);
  assert.deepEqual(f.bytes(), committedBytes);
  assert.equal(f.bindingStore.read().length, 6);

  const additions = await f.preview(allIds, { type: 'add-tags', tagIds: ['T47', 'T48'] });
  assert.equal(additions.status, 200);
  assert.equal((await f.apply(additions.body.previewId)).status, 200);
  for (const snapshot of f.bindingStore.read()) {
    assert.ok(snapshot.record.tagIds.includes('T47'));
    assert.ok(snapshot.record.tagIds.includes('T48'));
    assert.equal(new Set(snapshot.record.tagIds).size, snapshot.record.tagIds.length);
    assert.equal(snapshot.record.tagIds.includes(legacyTag), snapshot.id === 'active');
  }
  const removals = await f.preview(allIds, {
    type: 'remove-tags',
    tagIds: ['T47', legacyTag],
  });
  assert.equal(removals.status, 200);
  assert.equal((await f.apply(removals.body.previewId)).status, 200);
  for (const snapshot of f.bindingStore.read()) {
    assert.deepEqual(snapshot.record.tagIds, ['T48']);
    const original = before.find(
      item => item.id === snapshot.id && item.version === snapshot.version,
    );
    assert.deepEqual(unchangedFields(snapshot.record), unchangedFields(original.record));
  }
});

test('empty selection is rejected and a selected no-op leaves files and revisions unchanged', async t => {
  const f = await fixture(t);
  f.seed();
  const before = f.bytes();
  assert.equal((await f.preview([], { type: 'set-section', sectionId: 'W02' })).status, 400);
  const preview = await f.preview(['unchanged'], { type: 'add-tags', tagIds: ['T48'] });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.body.counts, {
    selectedDocuments: 1,
    changedDocuments: 0,
    changedVersions: 0,
    updatedVersions: 0,
    unchangedDocuments: 1,
  });
  assert.equal((await f.apply(preview.body.previewId)).status, 200);
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.faults.writes, 0);
});

test('changing one selected record after preview rejects the entire HTTP confirmation before any write', async t => {
  const f = await fixture(t);
  f.seed();
  const preview = await f.preview(['active', 'unchanged'], {
    type: 'set-section',
    sectionId: 'W01',
  });
  assert.equal(preview.status, 200);
  f.write({ ...f.read('unchanged'), seoTitle: 'Concurrent edit', revision: 4 });
  const concurrentBytes = f.bytes();
  const applied = await f.apply(preview.body.previewId);
  assert.equal(applied.status, 409);
  assert.deepEqual(f.bytes(), concurrentBytes);
  assert.equal(f.faults.writes, 0);
  assert.equal((await f.request('/operations/status')).body.blocked, false);
});

test('field-only HTTP rollback preserves newer body and SEO edits while restoring assignments with monotonic revisions', async t => {
  const f = await fixture(t);
  f.seed();
  const before = f.bindingStore.read();
  const preview = await f.preview(['active', 'draft-only'], {
    type: 'set-section',
    sectionId: 'W01',
  });
  const applied = await f.apply(preview.body.previewId);
  assert.equal(applied.status, 200);
  for (const snapshot of f.bindingStore.read().filter(item => item.id !== 'obsolete')) {
    if (!['active', 'draft-only'].includes(snapshot.id)) continue;
    f.write(
      {
        ...snapshot.record,
        title: `Поздний заголовок ${snapshot.version}`,
        seoTitle: 'Позднее SEO',
        instructionContent: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
        contentHash: 'late-content-hash',
        revision: snapshot.record.revision + 2,
        updatedAt: '2026-10-23T12:00:00.000Z',
      },
      snapshot.version,
    );
  }
  const late = f.bindingStore.read();
  const rollback = await f.request(
    `/operations/history/${applied.body.operationId}/rollback-preview`,
    'POST',
    {},
  );
  assert.equal(rollback.status, 200);
  assert.equal((await f.apply(rollback.body.previewId)).status, 200);
  for (const snapshot of late) {
    const current = f.read(snapshot.id, snapshot.version);
    const original = before.find(
      item => item.id === snapshot.id && item.version === snapshot.version,
    );
    assert.deepEqual(unchangedFields(current), unchangedFields(snapshot.record));
    assert.equal(current.primaryCategoryId, original.record.primaryCategoryId);
    assert.deepEqual(current.tagIds, original.record.tagIds);
    assert.equal(
      current.revision,
      snapshot.record.revision + (['active', 'draft-only'].includes(snapshot.id) ? 1 : 0),
    );
  }
});

test('rollback refuses a later manual assignment and refuses changed version topology without recreating files', async t => {
  const f = await fixture(t);
  f.seed();
  const preview = await f.preview(['active', 'draft-only'], {
    type: 'set-section',
    sectionId: 'W01',
  });
  const applied = await f.apply(preview.body.previewId);
  assert.equal(applied.status, 200);
  const changed = { ...f.read('active'), primaryCategoryId: 'W03' };
  f.write(changed);
  const manualBytes = f.bytes();
  const manual = await f.request(
    `/operations/history/${applied.body.operationId}/rollback-preview`,
    'POST',
    {},
  );
  assert.equal(manual.status, 409);
  assert.deepEqual(f.bytes(), manualBytes);
  f.write({ ...changed, primaryCategoryId: 'W01' });
  fs.unlinkSync(f.filename('draft-only', 'draft'));
  const removedBytes = f.bytes();
  const topology = await f.request(
    `/operations/history/${applied.body.operationId}/rollback-preview`,
    'POST',
    {},
  );
  assert.equal(topology.status, 409);
  assert.deepEqual(f.bytes(), removedBytes);
  assert.equal(fs.existsSync(f.filename('draft-only', 'draft')), false);
});

async function interrupt(f) {
  const preview = await f.preview(['active', 'unchanged'], {
    type: 'set-section',
    sectionId: 'W01',
  });
  assert.equal(preview.status, 200);
  f.faults.failAfterFirstWrite = true;
  const interrupted = await f.apply(preview.body.previewId);
  assert.equal(interrupted.status, 409);
  assert.equal(interrupted.body.code, 'TAXONOMY_BULK_RECOVERY_REQUIRED');
  const status = await f.request('/operations/status');
  assert.equal(status.body.blocked, true);
  assert.ok(status.body.pendingOperation.operationId);
  const registry = f.taxonomyRepository.read();
  const metadata = await f.request('/taxonomy/tag/T47', 'PUT', {
    expectedRevision: registry.revision,
    patch: { name: 'Blocked while batch recovery is pending' },
  });
  assert.equal(metadata.status, 409);
  assert.deepEqual(f.taxonomyRepository.read(), registry);
  const bytes = f.bytes();
  const editorial = await f.request('/editor/active', 'PUT', {
    revision: f.read('active', 'draft').revision,
    status: 'draft',
    seoTitle: 'Blocked editorial write while batch recovery is pending',
  });
  assert.equal(editorial.status, 409);
  assert.deepEqual(f.bytes(), bytes);
  return status.body.pendingOperation.operationId;
}

test('an interrupted HTTP batch can recover known before/after bytes without leaving partial assignments', async t => {
  const f = await fixture(t);
  f.seed();
  const before = f.bytes();
  const operationId = await interrupt(f);
  assert.notDeepEqual(f.bytes(), before);
  f.faults.failAfterFirstWrite = false;
  const recovered = await f.request('/operations/recover', 'POST', {
    operationId,
    confirmed: true,
  });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.status, 'recovered');
  assert.deepEqual(f.bytes(), before);
  assert.equal((await f.request('/operations/status')).body.blocked, false);
});

test('recovery freezes on an unexpected current file and does not overwrite any sibling', async t => {
  const f = await fixture(t);
  f.seed();
  const operationId = await interrupt(f);
  f.faults.failAfterFirstWrite = false;
  f.write({ ...f.read('active'), seoDescription: 'Unexpected bytes after interruption' });
  const unexpected = f.bytes();
  const writes = f.faults.writes;
  const recovered = await f.request('/operations/recover', 'POST', {
    operationId,
    confirmed: true,
  });
  assert.equal(recovered.status, 409);
  assert.equal(recovered.body.code, 'TAXONOMY_BULK_RECOVERY_CONFLICT');
  assert.deepEqual(f.bytes(), unexpected);
  assert.equal(f.faults.writes, writes);
  assert.equal((await f.request('/operations/status')).body.blocked, true);
});
