import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionTaxonomyOperationsRouter } from '../src/routes/adminInstructionTaxonomyOperations.js';
import { createAdminInstructionTaxonomyRouter } from '../src/routes/adminInstructionTaxonomy.js';
import { createInstructionTaxonomyBindingStore } from '../src/services/instructionTaxonomyBindingStore.js';
import { createInstructionTaxonomyBulkJournal } from '../src/services/instructionTaxonomyBulkJournal.js';
import { createInstructionTaxonomyBulkService } from '../src/services/instructionTaxonomyBulkService.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { getInstructionTaxonomyReviewSource } from '../src/services/instructionTaxonomyReviewSource.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const origin = 'https://boykovdocs.ru';
const prefix = `${origin}/instrukciya-po-ohrane-truda/`;
const legacyTag = 'sosudy-pod-davleniem';
const headers = [
  'document_id',
  'url',
  'title_from_url_verify',
  'catalog',
  'section_id',
  'section_name',
  'tags_ids',
  'tags_names',
  'review_status',
  'lastmod',
  'notes',
];

function document(id, overrides = {}) {
  return {
    id,
    slug: `instruction-${id}-AbC123`,
    slugAliases: [`old-${id}-XyZ789`],
    title: `Сохранённая инструкция ${id}`,
    h1: `Сохранённый H1 ${id}`,
    intro: 'Сохранённое введение.',
    webIntro: 'Сохранённое введение страницы.',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Сохранённый текст.' }] }],
    },
    explanationContent: { type: 'doc', content: [] },
    sections: [{ title: 'Требования', paragraphs: ['Сохранённый текст.'] }],
    seoTitle: `Сохранённый SEO Title ${id}`,
    seoDescription: 'Сохранённое SEO-описание.',
    editorialMeta: {
      seoReady: true,
      seoAuthor: 'Редактор',
      seoUpdatedAt: '2026-08-20T09:00:00.000Z',
    },
    createdAt: '2026-08-01T09:00:00.000Z',
    publishedAt: '2026-08-02T09:00:00.000Z',
    updatedAt: '2026-08-20T09:00:00.000Z',
    modifiedAt: '2026-08-19T09:00:00.000Z',
    contentHash: `original-content-hash-${id}`,
    version: '2.4',
    versions: [{ version: '2.3', contentHash: 'previous-hash' }],
    files: [{ name: 'instruction.pdf', path: `/documents/${id}.pdf` }],
    review_status: 'Сохранённый внутренний статус',
    notes: 'Сохранённое примечание',
    revision: 5,
    status: 'published',
    primaryCategoryId: 'P10',
    tagIds: [legacyTag, 'T47'],
    taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual', retainedNote: 'keep' },
    ...overrides,
  };
}

function nonTaxonomyFields(record) {
  const {
    primaryCategoryId: _primaryCategoryId,
    tagIds: _tagIds,
    taxonomyMeta: _taxonomyMeta,
    revision: _revision,
    ...other
  } = record;
  return other;
}

function csv(rows, { bom = true } = {}) {
  const cell = value => {
    const text = String(value ?? '');
    return /[;"\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return Buffer.from(
    `${bom ? '\uFEFF' : ''}${[headers.join(';'), ...rows.map(row => headers.map(field => cell(row[field])).join(';'))].join('\r\n')}\r\n`,
    'utf8',
  );
}

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-csv-flow-'));
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
        throw new Error('Injected interrupted CSV import and compensation');
      }
      return bindingStore.writeBytes(snapshot, bytes, options);
    },
  };
  const service = createInstructionTaxonomyBulkService({
    taxonomyRepository,
    store,
    journal,
    origin,
  });
  const taxonomy = createInstructionTaxonomyRegistryService({
    repository: taxonomyRepository,
    getInstructions: () => bindingStore.read().map(snapshot => snapshot.record),
  });
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use((req, _res, next) => {
    req.user = { role: 'admin', sub: 'csv-flow-admin' };
    next();
  });
  app.use(
    '/operations',
    createAdminInstructionTaxonomyOperationsRouter({ service, exportProvider: () => '' }),
  );
  app.use('/taxonomy', createAdminInstructionTaxonomyRouter({ service: taxonomy }));
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
    return version === 'draft'
      ? path.join(draftsDirectory, `${Buffer.from(id).toString('base64url')}.json`)
      : path.join(publishedDirectory, `${id}.json`);
  }
  function write(record, version = 'published') {
    fs.writeFileSync(filename(record.id, version), `${JSON.stringify(record, null, 2)}\n`);
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
  function row(ordinal, url, sectionId = 'W02', tagIds = ['T48'], overrides = {}) {
    const registry = taxonomyRepository.read();
    const section = registry.sections.find(item => item.code === sectionId);
    const catalog = registry.catalogs.find(item => item.code === section?.parentCode);
    return {
      document_id: String(ordinal),
      url,
      title_from_url_verify: 'Название из CSV не должно заменять название документа',
      catalog: catalog?.name ?? '',
      section_id: sectionId,
      section_name: section?.name ?? '',
      tags_ids: tagIds.join(','),
      tags_names: tagIds
        .map(id => registry.tags.find(item => item.code === id)?.name ?? id)
        .join(', '),
      review_status: 'Предварительно классифицировано по смыслу заголовка',
      lastmod: '2099-01-01',
      notes: 'Примечание из CSV не должно заменять примечание документа',
      ...overrides,
    };
  }
  function preview(rows, overrides = {}) {
    return request('/operations/import-preview', 'POST', {
      fileName: 'classification.csv',
      csvBase64: csv(rows).toString('base64'),
      registryRevision: taxonomyRepository.read().revision,
      includeDrafts: true,
      tagMode: 'add',
      replaceConfirmed: false,
      ...overrides,
    });
  }
  function apply(previewId) {
    return request('/operations/apply', 'POST', { previewId, confirmed: true });
  }
  return {
    directory,
    taxonomyRepository,
    bindingStore,
    journal,
    faults,
    request,
    filename,
    write,
    read,
    bytes,
    row,
    preview,
    apply,
  };
}

test('CSV HTTP import matches exact current, alias and internal-ID URLs without using the source ordinal as an instruction ID', async t => {
  const f = await fixture(t);
  f.write(document('alpha'));
  f.write(
    document('alpha', {
      status: 'draft',
      revision: 3,
      primaryCategoryId: 'W03',
      tagIds: [legacyTag, 'T48'],
    }),
    'draft',
  );
  f.write(document('beta'));
  f.write(document('gamma'));
  f.write(document('17'));
  const sourceRows = [
    f.row(17, `${prefix}instruction-alpha-AbC123/`),
    f.row(18, `${prefix}old-beta-XyZ789`, 'P02', []),
    f.row(19, `${prefix}gamma`, 'W03', ['T47']),
  ];
  const before = f.bindingStore.read();
  const initial = f.bytes();
  const preview = await f.preview(sourceRows);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.importReport.counts.matched, 3);
  assert.equal(preview.body.importReport.counts.eligibleRows, 3);
  assert.deepEqual(preview.body.counts, {
    selectedDocuments: 3,
    changedDocuments: 3,
    changedVersions: 4,
    updatedVersions: 4,
    unchangedDocuments: 0,
  });
  assert.deepEqual(f.bytes(), initial);
  assert.equal(f.faults.writes, 0);
  assert.equal((await f.apply(preview.body.previewId)).status, 200);
  for (const snapshot of before) {
    const current = f.read(snapshot.id, snapshot.version);
    assert.deepEqual(nonTaxonomyFields(current), nonTaxonomyFields(snapshot.record));
    assert.equal(current.taxonomyMeta.retainedNote, 'keep');
  }
  assert.equal(f.bytes()['17:published'], initial['17:published']);
  assert.equal(f.read('alpha').primaryCategoryId, 'W02');
  assert.deepEqual(f.read('alpha').tagIds, [legacyTag, 'T47', 'T48']);
  assert.deepEqual(f.read('alpha', 'draft').tagIds, [legacyTag, 'T48']);
  assert.ok(f.read('alpha', 'draft').revision < f.read('alpha').revision);
  assert.deepEqual(f.read('beta').tagIds, [legacyTag, 'T47']);
  assert.equal(f.read('gamma').primaryCategoryId, 'W03');
  const committed = f.bytes();
  const repeated = await f.preview(sourceRows);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.counts.changedDocuments, 0);
  assert.equal(repeated.body.counts.updatedVersions, 0);
  assert.equal((await f.apply(repeated.body.previewId)).status, 200);
  assert.deepEqual(f.bytes(), committed);
});

test('CSV HTTP import permanently holds original manual-review identities even through a current URL with cleared source status', async t => {
  const f = await fixture(t);
  const reference = getInstructionTaxonomyReviewSource().records[0];
  const originalSlug = decodeURIComponent(new URL(reference.url).pathname.split('/').at(-1));
  f.write(document('held', { slug: 'held-current-XyZ123', slugAliases: [originalSlug] }));
  f.write(document('new-review'));
  f.write(document('eligible'));
  const initial = f.bytes();
  const held = f.row(1, `${prefix}held-current-XyZ123`, 'W02', ['T48'], { review_status: '' });
  const flagged = f.row(2, `${prefix}instruction-new-review-AbC123`, 'W02', ['T48'], {
    review_status: 'Проверить вручную — неоднозначное назначение',
  });
  const preview = await f.preview([
    held,
    flagged,
    f.row(3, `${prefix}instruction-eligible-AbC123`),
  ]);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.importReport.counts.manualReview, 2);
  assert.equal(preview.body.importReport.counts.eligibleRows, 1);
  assert.equal(preview.body.counts.selectedDocuments, 1);
  for (const id of ['held', 'new-review']) {
    const row = preview.body.importReport.records.find(item => item.existingId === id);
    assert.equal(row.manualReview, true);
    assert.equal(row.status, 'review');
  }
  assert.equal((await f.apply(preview.body.previewId)).status, 200);
  assert.equal(f.bytes()['held:published'], initial['held:published']);
  assert.equal(f.bytes()['new-review:published'], initial['new-review:published']);
  assert.equal(f.read('eligible').primaryCategoryId, 'W02');
  const historyBefore = f.journal.list().total;
  const reportOnly = await f.preview([held, flagged]);
  assert.equal(reportOnly.status, 200);
  assert.equal(reportOnly.body.previewId, null);
  assert.equal(reportOnly.body.importReport.counts.eligibleRows, 0);
  assert.equal(f.journal.list().total, historyBefore);
});

test('CSV HTTP report excludes unknown, mismatched, missing, ambiguous and duplicate targets while allowing only valid rows', async t => {
  const f = await fixture(t);
  for (const id of [
    'valid',
    'bad-section',
    'bad-tag',
    'bad-name',
    'duplicate',
    'same-target',
    'case',
  ])
    f.write(document(id));
  f.write(document('collision-one', { slugAliases: ['reserved-collision-XyZ123'] }));
  f.write(document('collision-two', { slugAliases: ['reserved-collision-XyZ123'] }));
  const initial = f.bytes();
  const sourceRows = [
    f.row(1, `${prefix}instruction-valid-AbC123`),
    f.row(2, `${prefix}instruction-bad-section-AbC123`, 'W99'),
    f.row(3, `${prefix}instruction-bad-tag-AbC123`, 'W02', ['T99']),
    f.row(4, `${prefix}instruction-bad-name-AbC123`, 'W02', ['T48'], {
      section_name: 'Несовпадающее название',
    }),
    f.row(5, `${prefix}missing-AbC123`),
    f.row(6, `${prefix}reserved-collision-XyZ123`),
    f.row(7, `${prefix}instruction-duplicate-AbC123`),
    f.row(8, `${prefix}instruction-duplicate-AbC123/`),
    f.row(9, `${prefix}same-target`),
    f.row(10, `${prefix}old-same-target-XyZ789`),
    f.row(11, `${prefix}instruction-case-abc123`),
    f.row(12, 'https://other.example/instrukciya-po-ohrane-truda/instruction-valid-AbC123'),
  ];
  const preview = await f.preview(sourceRows);
  assert.equal(preview.status, 200);
  const { counts, records } = preview.body.importReport;
  assert.equal(counts.rows, 12);
  assert.equal(counts.matched, 8);
  assert.equal(counts.notFound, 2);
  assert.equal(counts.ambiguous, 1);
  assert.equal(counts.invalidUrl, 1);
  assert.equal(counts.unknownSections, 1);
  assert.equal(counts.unknownTags, 1);
  assert.equal(counts.eligibleRows, 1);
  assert.equal(counts.skippedRows, 11);
  assert.deepEqual(
    records.filter(item => item.status === 'candidate').map(item => item.existingId),
    ['valid'],
  );
  assert.equal((await f.apply(preview.body.previewId)).status, 200);
  for (const [key, bytes] of Object.entries(initial)) {
    if (key !== 'valid:published') assert.equal(f.bytes()[key], bytes, key);
  }
  assert.equal(f.read('valid').primaryCategoryId, 'W02');
});

test('CSV replacement requires its separate confirmation and can explicitly clear both versions without changing document data', async t => {
  const f = await fixture(t);
  f.write(document('replace', { tagIds: [legacyTag, 'T47', 'T48'] }));
  f.write(document('replace', { status: 'draft', revision: 8, tagIds: ['T48'] }), 'draft');
  const sourceRows = [f.row(1, `${prefix}instruction-replace-AbC123`, 'W02', [])];
  const initial = f.bindingStore.read();
  const bytes = f.bytes();
  const unconfirmed = await f.preview(sourceRows, { tagMode: 'replace', replaceConfirmed: false });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.body.code, 'TAXONOMY_CSV_REPLACE_CONFIRMATION_REQUIRED');
  assert.equal((await f.preview(sourceRows, { includeDrafts: false })).status, 400);
  assert.deepEqual(f.bytes(), bytes);
  const preview = await f.preview(sourceRows, { tagMode: 'replace', replaceConfirmed: true });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.action.tagMode, 'replace');
  assert.equal((await f.apply(preview.body.previewId)).status, 200);
  for (const snapshot of initial) {
    const current = f.read(snapshot.id, snapshot.version);
    assert.deepEqual(current.tagIds, []);
    assert.equal(current.primaryCategoryId, 'W02');
    assert.equal(current.revision, snapshot.record.revision + 1);
    assert.deepEqual(nonTaxonomyFields(current), nonTaxonomyFields(snapshot.record));
  }
});

test('CSV HTTP preview rejects invalid UTF-8, a missing BOM and noncanonical base64 without creating an operation', async t => {
  const f = await fixture(t);
  f.write(document('encoding'));
  const rows = [f.row(1, `${prefix}instruction-encoding-AbC123`)];
  const initial = f.bytes();
  const invalidInputs = [
    csv(rows, { bom: false }).toString('base64'),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from([0xc3, 0x28])]).toString('base64'),
    `${csv(rows).toString('base64')} `,
  ];
  for (const csvBase64 of invalidInputs) {
    assert.equal((await f.preview(rows, { csvBase64 })).status, 400);
    assert.deepEqual(f.bytes(), initial);
    assert.equal(f.journal.list().total, 0);
    assert.equal(f.faults.writes, 0);
  }
});

test('CSV apply rejects a new competing address after preview but allows an unrelated body edit', async t => {
  const f = await fixture(t);
  f.write(document('selected'));
  f.write(document('unrelated'));
  const rows = [f.row(1, `${prefix}instruction-selected-AbC123`)];
  const preview = await f.preview(rows);
  assert.equal(preview.status, 200);
  const selectedBefore = f.bytes()['selected:published'];
  f.write(document('intruder', { slugAliases: ['instruction-selected-AbC123'] }));
  const conflict = await f.apply(preview.body.previewId);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'TAXONOMY_BULK_PREVIEW_CONFLICT');
  assert.equal(f.faults.writes, 0);
  assert.equal(f.bytes()['selected:published'], selectedBefore);
  fs.unlinkSync(f.filename('intruder', 'published'));
  const fresh = await f.preview(rows);
  assert.equal(fresh.status, 200);
  f.write({
    ...f.read('unrelated'),
    title: 'Поздняя независимая правка',
    seoDescription: 'Независимое SEO',
  });
  assert.equal((await f.apply(fresh.body.previewId)).status, 200);
  assert.equal(f.read('selected').primaryCategoryId, 'W02');
  assert.equal(f.read('unrelated').title, 'Поздняя независимая правка');
});

test('CSV journal rollback restores assignments while retaining later body, SEO, notes and date edits', async t => {
  const f = await fixture(t);
  f.write(document('rollback'));
  const original = f.read('rollback');
  const preview = await f.preview([f.row(1, `${prefix}instruction-rollback-AbC123`)]);
  assert.equal(preview.status, 200);
  const applied = await f.apply(preview.body.previewId);
  assert.equal(applied.status, 200);
  const newer = {
    ...f.read('rollback'),
    title: 'Новое редакционное название',
    seoTitle: 'Новый SEO Title',
    seoDescription: 'Новое SEO-описание',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый текст.' }] }],
    },
    notes: 'Новое редакционное примечание',
    updatedAt: '2026-10-01T10:00:00.000Z',
    revision: 9,
  };
  f.write(newer);
  const rollback = await f.request(
    `/operations/history/${applied.body.operationId}/rollback-preview`,
    'POST',
    {},
  );
  assert.equal(rollback.status, 200);
  assert.equal((await f.apply(rollback.body.previewId)).status, 200);
  const restored = f.read('rollback');
  assert.equal(restored.primaryCategoryId, original.primaryCategoryId);
  assert.deepEqual(restored.tagIds, original.tagIds);
  assert.deepEqual(restored.taxonomyMeta, original.taxonomyMeta);
  assert.deepEqual(nonTaxonomyFields(restored), nonTaxonomyFields(newer));
  assert.equal(restored.revision, 10);
  const history = await f.request('/operations/history');
  const imported = history.body.items.find(item => item.operationId === applied.body.operationId);
  assert.equal(imported.action.type, 'import-csv');
  assert.equal(imported.action.fileName, 'classification.csv');
  assert.equal(imported.actor, 'csv-flow-admin');
  assert.equal(imported.importSummary.counts.rows, 1);
  assert.equal(Object.hasOwn(imported, 'slots'), false);
  assert.equal(Object.hasOwn(imported.importSummary, 'records'), false);
});

test('interrupted CSV apply uses the existing pending guard and recovers exact original bytes', async t => {
  const f = await fixture(t);
  f.write(document('first'));
  f.write(document('second'));
  const initial = f.bytes();
  const rows = [
    f.row(1, `${prefix}instruction-first-AbC123`),
    f.row(2, `${prefix}instruction-second-AbC123`),
  ];
  const preview = await f.preview(rows);
  assert.equal(preview.status, 200);
  f.faults.failAfterFirstWrite = true;
  const failed = await f.apply(preview.body.previewId);
  assert.equal(failed.status, 409);
  assert.equal(failed.body.code, 'TAXONOMY_BULK_RECOVERY_REQUIRED');
  const status = await f.request('/operations/status');
  assert.equal(status.body.blocked, true);
  assert.equal(status.body.pendingOperation.action.type, 'import-csv');
  const metadata = await f.request('/taxonomy/tag/T47', 'PUT', {
    expectedRevision: 0,
    patch: { name: 'Недопустимая правка во время восстановления' },
  });
  assert.equal(metadata.status, 409);
  assert.equal(metadata.body.code, 'TAXONOMY_BULK_PENDING');
  assert.equal((await f.preview(rows)).status, 409);
  f.faults.failAfterFirstWrite = false;
  const recovered = await f.request('/operations/recover', 'POST', {
    operationId: preview.body.previewId,
    confirmed: true,
  });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.status, 'recovered');
  assert.deepEqual(f.bytes(), initial);
  assert.equal((await f.request('/operations/status')).body.blocked, false);
});
