import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function runScenario({ directory, modules, large }) {
  const [
    { default: assert },
    { createHash },
    { default: fs },
    { default: path },
    { createInstructionTaxonomyBindingStore },
    { createInstructionTaxonomyBulkJournal },
    { createInstructionTaxonomyBulkService },
    { createInstructionTaxonomyRegistryRepository },
    { getInstructionTaxonomyReviewSource },
    { InstructionsRepository },
    { INSTRUCTION_TAXONOMY_CSV_HEADERS },
  ] = await Promise.all([
    import('node:assert/strict'),
    import('node:crypto'),
    import('node:fs'),
    import('node:path'),
    ...modules.map(module => import(module)),
  ]);
  const publishedDirectory = path.join(directory, 'instructions');
  const draftsDirectory = path.join(directory, 'drafts');
  fs.mkdirSync(publishedDirectory);
  fs.mkdirSync(draftsDirectory);
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(directory, 'taxonomy.json'),
  });
  const registry = taxonomyRepository.read();
  const section = registry.sections.find(item => item.code === 'W02');
  const catalog = registry.catalogs.find(item => item.code === section.parentCode);
  const tag = registry.tags.find(item => item.code === 'T48');
  const references = getInstructionTaxonomyReviewSource().records;
  const count = large ? 2169 : 1;
  const held = large ? references.length : 0;
  const legacyTag = 'sosudy-pod-davleniem';
  const unit = 'Требования безопасности и порядок выполнения работы. ';
  const padding = unit.repeat(Math.ceil((64 * 1024) / Buffer.byteLength(unit)));
  const originals = [];
  const rows = [];
  let sourceBytes = 0;
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const filename = id => path.join(publishedDirectory, `${id}.json`);
  for (let index = 0; index < count; index += 1) {
    const id = `scale-${String(index).padStart(5, '0')}`;
    const slug =
      index < held
        ? decodeURIComponent(new URL(references[index].url).pathname.split('/').at(-1))
        : `csv-preview-memory-${index}`;
    const record = {
      id,
      slug,
      title: `Сохранённая инструкция ${index}`,
      status: 'published',
      revision: 2,
      primaryCategoryId: 'P10',
      tagIds: [legacyTag],
      seoTitle: `Сохранённое SEO ${index}`,
      seoDescription: 'Сохранённое описание инструкции',
      updatedAt: '2026-10-01T09:00:00.000Z',
      contentHash: `original-${id}`,
      instructionContent: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: `${id}: ${padding}` }] }],
      },
    };
    const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
    fs.writeFileSync(filename(id), bytes);
    originals.push({
      id,
      hash: digest(bytes),
      modified: fs.statSync(filename(id), { bigint: true }).mtimeNs.toString(),
    });
    sourceBytes += bytes.length;
    rows.push({
      document_id: `DOC-${index + 1}`,
      url: `https://boykovdocs.ru/instrukciya-po-ohrane-truda/${encodeURIComponent(slug)}`,
      title_from_url_verify: record.title,
      catalog: catalog.name,
      section_id: section.code,
      section_name: section.name,
      tags_ids: tag.code,
      tags_names: tag.name,
      review_status: 'Предварительно классифицировано по смыслу заголовка',
      lastmod: '2020-01-01',
      notes: '',
    });
  }

  // The running API already has the complete instruction catalog in its cache.
  const repository = new InstructionsRepository(publishedDirectory);
  assert.equal(repository.getAll().length, count);
  const store = createInstructionTaxonomyBindingStore({ repository, draftsDirectory });
  const journal = createInstructionTaxonomyBulkJournal({
    directory: taxonomyRepository.operationsDirectory,
  });
  const service = createInstructionTaxonomyBulkService({ taxonomyRepository, store, journal });
  const csvCell = value => `"${String(value).replaceAll('"', '""')}"`;
  const csv = Buffer.from(
    `\uFEFF${INSTRUCTION_TAXONOMY_CSV_HEADERS.join(';')}\r\n${rows
      .map(row => INSTRUCTION_TAXONOMY_CSV_HEADERS.map(key => csvCell(row[key])).join(';'))
      .join('\r\n')}\r\n`,
  );
  const preview = service.previewImport(
    {
      fileName: 'BOYKOVDOCS_IMPORT_2169_NEW_CATEGORIES.csv',
      csvBase64: csv.toString('base64'),
      registryRevision: registry.revision,
      includeDrafts: true,
      tagMode: 'add',
      replaceConfirmed: false,
    },
    'scale-admin',
  );
  assert.equal(preview.importReport.counts.rows, count);
  assert.equal(preview.importReport.counts.matched, count);
  assert.equal(preview.importReport.counts.manualReview, held);
  assert.equal(preview.importReport.counts.eligibleRows, count - held);
  assert.equal(preview.counts.changedDocuments, count - held);
  assert.equal(journal.getActive(), null);
  for (const original of originals) {
    assert.equal(digest(fs.readFileSync(filename(original.id))), original.hash);
    assert.equal(
      fs.statSync(filename(original.id), { bigint: true }).mtimeNs.toString(),
      original.modified,
    );
  }
  const plan = journal.read(preview.previewId);
  const manifestBytes = fs.statSync(
    path.join(taxonomyRepository.operationsDirectory, 'plans', `${plan.id}.json`),
  ).size;
  const payloadBytes = fs.statSync(
    path.join(taxonomyRepository.operationsDirectory, 'payloads', `${plan.id}.bin`),
  ).size;
  assert.ok(manifestBytes < 8 * 1024 * 1024, 'The preview manifest must stay small');
  assert.equal(plan.payloadBytes, payloadBytes);
  const firstChanged = originals[held];
  const slot = plan.slots.find(item => item.id === firstChanged.id);
  const beforeBytes = journal.readSlotBytes(plan, slot, 'before');
  const afterBytes = journal.readSlotBytes(plan, slot, 'after');
  assert.equal(digest(beforeBytes), firstChanged.hash);
  const before = JSON.parse(beforeBytes.toString('utf8'));
  const after = JSON.parse(afterBytes.toString('utf8'));
  assert.deepEqual(after.instructionContent, before.instructionContent);
  assert.equal(after.seoTitle, before.seoTitle);
  assert.equal(after.contentHash, before.contentHash);
  assert.equal(after.updatedAt, before.updatedAt);
  assert.equal(after.primaryCategoryId, section.code);
  assert.deepEqual(after.tagIds, [legacyTag, tag.code]);

  if (large) {
    assert.ok(sourceBytes > 128 * 1024 * 1024, 'Exercise a production-sized warm catalog');
    assert.ok(payloadBytes > 256 * 1024 * 1024, 'Exercise backups beyond the old inline limit');
    assert.ok(preview.importReport.records.slice(0, held).every(row => row.manualReview));
  } else {
    const committed = service.apply(
      { previewId: preview.previewId, confirmed: true },
      'scale-admin',
    );
    const applied = JSON.parse(fs.readFileSync(filename(firstChanged.id), 'utf8'));
    assert.deepEqual(applied.instructionContent, before.instructionContent);
    assert.equal(applied.seoTitle, before.seoTitle);
    assert.equal(applied.updatedAt, before.updatedAt);
    assert.equal(applied.primaryCategoryId, section.code);
    assert.deepEqual(applied.tagIds, [legacyTag, tag.code]);
    const newer = {
      ...applied,
      revision: applied.revision + 1,
      seoTitle: 'Редактор изменил SEO после импорта',
      updatedAt: '2026-10-26T12:00:00.000Z',
      instructionContent: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: `Новый текст: ${padding}` }] },
        ],
      },
    };
    fs.writeFileSync(filename(firstChanged.id), `${JSON.stringify(newer)}\n`);
    const rollback = service.previewRollback(committed.operationId, 'scale-admin');
    service.apply({ previewId: rollback.previewId, confirmed: true }, 'scale-admin');
    const restored = JSON.parse(fs.readFileSync(filename(firstChanged.id), 'utf8'));
    assert.deepEqual(restored.instructionContent, newer.instructionContent);
    assert.equal(restored.seoTitle, newer.seoTitle);
    assert.equal(restored.updatedAt, newer.updatedAt);
    assert.equal(restored.primaryCategoryId, before.primaryCategoryId);
    assert.deepEqual(restored.tagIds, before.tagIds);
    assert.equal(Object.hasOwn(restored, 'taxonomyMeta'), false);
    assert.equal(restored.revision, newer.revision + 1);
  }
  console.log(
    JSON.stringify({
      sourceBytes,
      manifestBytes,
      payloadBytes,
      documents: count,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
    }),
  );
}

function scenario(large) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-csv-preview-scale-'));
  const modules = [
    'instructionTaxonomyBindingStore',
    'instructionTaxonomyBulkJournal',
    'instructionTaxonomyBulkService',
    'instructionTaxonomyRegistryRepository',
    'instructionTaxonomyReviewSource',
    'instructionsRepository',
    'instructionTaxonomyCsvFormat',
  ].map(name => new URL(`../src/services/${name}.js`, import.meta.url).href);
  try {
    return spawnSync(
      process.execPath,
      [
        '--max-old-space-size=384',
        '--input-type=module',
        '-e',
        `(${runScenario.toString()})(${JSON.stringify({ directory, modules, large })}).catch(error => { console.error(error); process.exitCode = 1; });`,
      ],
      { encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('CSV preview handles 2169 large cached instructions within a constrained Node heap', t => {
  const result = scenario(true);
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  t.diagnostic(result.stdout.trim());
});

test('disk-backed CSV plans preserve full bodies and newer content during apply and rollback', () => {
  const result = scenario(false);
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
