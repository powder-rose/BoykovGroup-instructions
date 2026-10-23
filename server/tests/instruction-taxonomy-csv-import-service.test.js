import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createInstructionTaxonomyBindingStore } from '../src/services/instructionTaxonomyBindingStore.js';
import { createInstructionTaxonomyBulkJournal } from '../src/services/instructionTaxonomyBulkJournal.js';
import { createInstructionTaxonomyBulkService } from '../src/services/instructionTaxonomyBulkService.js';
import { INSTRUCTION_TAXONOMY_CSV_HEADERS } from '../src/services/instructionTaxonomyCsvExport.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const manualTag = 'sosudy-pod-davleniem';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-csv-service-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const draftsDirectory = path.join(directory, 'drafts');
  fs.mkdirSync(draftsDirectory);
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(directory, 'taxonomy.json'),
  });
  const store = createInstructionTaxonomyBindingStore({ repository, draftsDirectory });
  const journal = createInstructionTaxonomyBulkJournal({
    directory: taxonomyRepository.operationsDirectory,
  });
  const service = createInstructionTaxonomyBulkService({ taxonomyRepository, store, journal });
  function filename(id, version = 'published') {
    return version === 'draft'
      ? path.join(draftsDirectory, `${Buffer.from(id).toString('base64url')}.json`)
      : path.join(repository.dir, `${id}.json`);
  }
  function write(id, values = {}, version = 'published') {
    const record = {
      id,
      title: `Сохранённое название ${id}`,
      slug: `${id}-XyZ123`,
      slugAliases: [`old-${id}-AbC123`],
      status: version === 'draft' ? 'draft' : 'published',
      revision: 5,
      primaryCategoryId: 'P10',
      tagIds: [manualTag],
      taxonomyMeta: { categorySource: 'manual', tagsSource: 'manual', note: 'keep' },
      h1: 'Сохранённый H1',
      seoTitle: 'Сохранённый SEO Title',
      seoDescription: 'Сохранённое SEO-описание',
      instructionContent: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
      createdAt: '2026-01-02T00:00:00.000Z',
      publishedAt: '2026-02-03T00:00:00.000Z',
      updatedAt: '2026-03-04T00:00:00.000Z',
      contentHash: 'saved-hash',
      version: '2.4',
      review_status: 'Сохранённая ручная отметка',
      notes: 'Сохранённые заметки',
      ...values,
    };
    fs.writeFileSync(filename(id, version), `${JSON.stringify(record, null, 2)}\n`);
    return record;
  }
  function row(id, values = {}) {
    const registry = taxonomyRepository.read();
    const section = registry.sections.find(item => item.code === 'W02');
    const catalog = registry.catalogs.find(item => item.code === section.parentCode);
    const tag = registry.tags.find(item => item.code === 'T48');
    return {
      document_id: 'DOC-not-an-internal-id',
      url: `https://boykovdocs.ru/instrukciya-po-ohrane-truda/${id}-XyZ123`,
      title_from_url_verify: 'Восстановленное название нельзя сохранять',
      catalog: catalog.name,
      section_id: section.code,
      section_name: section.name,
      tags_ids: tag.code,
      tags_names: tag.name,
      review_status: 'Предварительно классифицировано по смыслу заголовка',
      lastmod: '2001-01-01',
      notes: 'Заметки из CSV нельзя сохранять',
      ...values,
    };
  }
  function csv(rows) {
    const cell = value => (/[;"\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
    return Buffer.from(
      `\uFEFF${INSTRUCTION_TAXONOMY_CSV_HEADERS.join(';')}\r\n${rows
        .map(value => INSTRUCTION_TAXONOMY_CSV_HEADERS.map(key => cell(value[key] ?? '')).join(';'))
        .join('\r\n')}\r\n`,
    );
  }
  function preview(rows, values = {}, actor = 'csv-admin') {
    return service.previewImport(
      {
        fileName: 'assignments.csv',
        csvBase64: csv(rows).toString('base64'),
        registryRevision: taxonomyRepository.read().revision,
        includeDrafts: true,
        tagMode: 'add',
        replaceConfirmed: false,
        ...values,
      },
      actor,
    );
  }
  const read = (id, version) => JSON.parse(fs.readFileSync(filename(id, version), 'utf8'));
  const bytes = () =>
    Object.fromEntries(
      store
        .read()
        .map(snapshot => [`${snapshot.id}/${snapshot.version}`, snapshot.bytes.toString('base64')]),
    );
  const apply = previewId => service.apply({ previewId, confirmed: true }, 'csv-admin');
  return {
    directory,
    repository,
    draftsDirectory,
    taxonomyRepository,
    store,
    journal,
    service,
    write,
    row,
    csv,
    preview,
    read,
    bytes,
    apply,
  };
}

function contentFields(record) {
  const {
    primaryCategoryId: _primaryCategoryId,
    tagIds: _tagIds,
    taxonomyMeta: _taxonomyMeta,
    revision: _revision,
    ...rest
  } = record;
  return rest;
}

test('CSV import matches an exact alias, preserves per-version tags and changes only assignments in both siblings', t => {
  const f = fixture(t);
  const published = f.write('first');
  const draft = f.write('first', { revision: 3, tagIds: ['T47'] }, 'draft');
  const before = f.bytes();
  const value = f.preview([
    f.row('first', {
      url: 'https://boykovdocs.ru/instrukciya-po-ohrane-truda/old-first-AbC123/',
    }),
  ]);
  assert.equal(value.action.type, 'import-csv');
  assert.equal(value.action.tagMode, 'add');
  assert.equal(value.importReport.counts.matched, 1);
  assert.equal(value.importReport.records[0].existingId, 'first');
  assert.deepEqual(value.counts, {
    selectedDocuments: 1,
    changedDocuments: 1,
    changedVersions: 2,
    updatedVersions: 2,
    unchangedDocuments: 0,
  });
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.journal.read(value.previewId).importReport.file.sha256, value.action.fileSha256);
  const result = f.apply(value.previewId);
  assert.equal(result.status, 'committed');
  for (const [version, original] of [
    ['published', published],
    ['draft', draft],
  ]) {
    const current = f.read('first', version);
    assert.deepEqual(contentFields(current), contentFields(original));
    assert.equal(current.primaryCategoryId, 'W02');
    assert.deepEqual(current.tagIds, [...original.tagIds, 'T48']);
    assert.equal(current.taxonomyMeta.note, 'keep');
    assert.equal(current.revision, original.revision + 1);
  }
  assert.ok(f.read('first', 'draft').revision < f.read('first').revision);
  assert.deepEqual(f.service.history().items[0].importSummary, {
    file: value.importReport.file,
    tagMode: 'add',
    counts: value.importReport.counts,
  });
  const committed = f.bytes();
  assert.deepEqual(f.apply(value.previewId), result);
  assert.deepEqual(f.bytes(), committed);
});

test('CSV tag replacement needs its own acknowledgement and preserves an explicitly empty tag list', t => {
  const f = fixture(t);
  f.write('first');
  f.write('first', { revision: 8, tagIds: ['T47', 'T48'] }, 'draft');
  const row = f.row('first', { tags_ids: '', tags_names: '' });
  const before = f.bytes();
  assert.throws(() => f.preview([row], { tagMode: 'replace' }), {
    code: 'TAXONOMY_CSV_REPLACE_CONFIRMATION_REQUIRED',
    status: 400,
  });
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.journal.list().total, 0);
  const value = f.preview([row], { tagMode: 'replace', replaceConfirmed: true });
  f.apply(value.previewId);
  assert.deepEqual(f.read('first').tagIds, []);
  assert.deepEqual(f.read('first', 'draft').tagIds, []);
  assert.ok(f.read('first', 'draft').revision > f.read('first').revision);
  const unchanged = f.preview([row], { tagMode: 'replace', replaceConfirmed: true });
  assert.equal(unchanged.counts.changedDocuments, 0);
  assert.equal(unchanged.counts.unchangedDocuments, 1);
  const current = f.bytes();
  f.apply(unchanged.previewId);
  assert.deepEqual(f.bytes(), current);
});

test('CSV report-only results create no operation when every row is held, invalid or unmatched', t => {
  const f = fixture(t);
  f.write('held');
  f.write('invalid');
  const before = f.bytes();
  const value = f.preview([
    f.row('held', {
      document_id: 'one',
      review_status: 'Проверить вручную — неоднозначное назначение',
    }),
    f.row('invalid', { document_id: 'two', section_id: 'W99' }),
    f.row('missing', { document_id: 'three' }),
  ]);
  assert.equal(value.previewId, null);
  assert.equal(value.importReport.counts.rows, 3);
  assert.equal(value.importReport.counts.manualReview, 1);
  assert.equal(value.importReport.counts.notFound, 1);
  assert.equal(value.importReport.counts.eligibleRows, 0);
  assert.deepEqual(value.rows, []);
  assert.equal(value.counts.selectedDocuments, 0);
  assert.equal(f.journal.list().total, 0);
  assert.equal(fs.existsSync(f.taxonomyRepository.operationsDirectory), false);
  assert.deepEqual(f.bytes(), before);
});

test('CSV preview rejects transport injection, missing scope and malformed bytes without writing data', t => {
  const f = fixture(t);
  f.write('first');
  const rows = [f.row('first')];
  const before = f.bytes();
  for (const extra of [
    { csvBase64: '' },
    { csvBase64: 'not-base64' },
    { csvBase64: `${f.csv(rows).toString('base64')}\n` },
    { csvBase64: Buffer.from('no UTF-8 BOM').toString('base64') },
    { csvBase64: Buffer.from([0xef, 0xbb, 0xbf, 0xff]).toString('base64') },
    { fileName: '../assignments.csv' },
    { includeDrafts: false },
    { replaceConfirmed: undefined },
    { tagMode: 'guess' },
    { actor: 'client-controlled' },
  ]) {
    assert.throws(() => f.preview(rows, extra), { status: 400 });
    assert.deepEqual(f.bytes(), before);
  }
  assert.equal(f.journal.list().total, 0);
});

test('CSV apply rejects newly introduced URL ownership but permits unrelated body-only edits', t => {
  const f = fixture(t);
  f.write('first');
  f.write('other');
  const value = f.preview([f.row('first')]);
  f.write('other', {
    instructionContent: { type: 'doc', content: [] },
    seoTitle: 'Новое SEO другого документа',
  });
  assert.equal(f.apply(value.previewId).status, 'committed');

  const second = f.preview([f.row('first', { tags_ids: '', tags_names: '' })], {
    tagMode: 'replace',
    replaceConfirmed: true,
  });
  f.write('new-collision', { slugAliases: ['first-XyZ123'] });
  const before = f.bytes();
  assert.throws(() => f.apply(second.previewId), {
    code: 'TAXONOMY_BULK_PREVIEW_CONFLICT',
    status: 409,
  });
  assert.deepEqual(f.bytes(), before);
  assert.equal(f.journal.read(second.previewId).status, 'preview');
});

test('CSV rollback uses the shared assignment-only transaction after newer text and SEO edits', t => {
  const f = fixture(t);
  const original = f.write('first');
  const value = f.preview([f.row('first')]);
  const operation = f.apply(value.previewId);
  const current = f.read('first');
  const newer = f.write('first', {
    ...current,
    revision: current.revision + 1,
    seoTitle: 'Новое SEO после импорта',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый текст' }] }],
    },
    updatedAt: '2026-10-23T12:00:00.000Z',
  });
  const rollback = f.service.previewRollback(operation.operationId, 'csv-admin');
  f.apply(rollback.previewId);
  const restored = f.read('first');
  assert.deepEqual(contentFields(restored), contentFields(newer));
  assert.equal(restored.primaryCategoryId, original.primaryCategoryId);
  assert.deepEqual(restored.tagIds, original.tagIds);
  assert.deepEqual(restored.taxonomyMeta, original.taxonomyMeta);
  assert.equal(restored.revision, newer.revision + 1);
});

test('stored CSV reports and address fingerprints cannot be injected into non-import actions', t => {
  const f = fixture(t);
  f.write('first');
  const preview = f.service.preview(
    {
      ids: ['first'],
      registryRevision: 0,
      includeDrafts: true,
      action: { type: 'set-section', sectionId: 'W02' },
    },
    'csv-admin',
  );
  const stored = f.journal.read(preview.previewId);
  const { id: _id, schemaVersion: _schemaVersion, status: _status, ...input } = stored;
  assert.throws(() => f.journal.savePreview({ ...input, importUrlFingerprint: 'a'.repeat(64) }), {
    status: 400,
  });
  assert.equal(f.journal.list().total, 1);
});
