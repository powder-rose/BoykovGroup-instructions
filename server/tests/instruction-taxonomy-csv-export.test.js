import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createInstructionTaxonomyBindingStore } from '../src/services/instructionTaxonomyBindingStore.js';
import {
  INSTRUCTION_TAXONOMY_CSV_HEADERS,
  createInstructionTaxonomyCsvExporter,
  exportInstructionTaxonomyCsv,
} from '../src/services/instructionTaxonomyCsvExport.js';
import { parseReclassificationCsv } from '../src/services/instructionReclassificationPreflight.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const origin = 'https://boykovdocs.ru';
const record = (overrides = {}) => ({
  id: 'stored-instruction',
  slug: 'Legacy-Instruction_Case-QxZ',
  title: 'Действительное название; «Инструкция»',
  primaryCategoryId: 'W01',
  tagIds: ['T47', 'T48', 'sosudy-pod-davleniem'],
  createdAt: '2026-10-23T12:00:00.000Z',
  ...overrides,
});

function csv(records, options = {}) {
  return exportInstructionTaxonomyCsv({
    records,
    registry: getInstructionTaxonomyRegistrySeed(),
    origin,
    ...options,
  });
}

test('published export has the exact BOM, eleven semicolon headers and current case-sensitive URLs', () => {
  const records = [
    record({
      slugAliases: ['old-alias', 'another-old-alias'],
      review_status: 'Ручная проверка',
      notes: 'Факт из записи',
      taxonomyMeta: { needsReview: false },
      instructionContent: { type: 'doc', content: [{ type: 'paragraph' }] },
      seoTitle: 'PRIVATE_SEO',
      updatedAt: '2025-03-04T12:00:00Z',
      modifiedAt: '2024-02-03T12:00:00Z',
    }),
    record({ id: 'draft', slug: 'draft-only', status: 'draft', title: 'PRIVATE_DRAFT' }),
    record({ id: 'seo-draft', slug: 'seo-draft-only', seoStatus: 'draft' }),
    record({
      id: 'published-noindex',
      slug: 'published-noindex',
      seoStatus: 'noindex',
      tagIds: [],
      taxonomyMeta: { needsReview: false },
    }),
  ];
  const before = structuredClone(records);
  const output = csv(records);
  assert.deepEqual([...Buffer.from(output).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(output.slice(1).split('\r\n')[0], INSTRUCTION_TAXONOMY_CSV_HEADERS.join(';'));
  assert.equal(
    INSTRUCTION_TAXONOMY_CSV_HEADERS.join(';'),
    'document_id;url;title_from_url_verify;catalog;section_id;section_name;tags_ids;tags_names;review_status;lastmod;notes',
  );
  assert.ok(output.endsWith('\r\n'));
  const rows = parseReclassificationCsv(output);
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0]), INSTRUCTION_TAXONOMY_CSV_HEADERS);
  assert.deepEqual(
    rows.map(row => row.document_id),
    ['1', '2'],
  );
  const exported = rows.find(row => row.url.endsWith('/Legacy-Instruction_Case-QxZ'));
  assert.ok(exported);
  assert.equal(exported.url, `${origin}/instrukciya-po-ohrane-truda/Legacy-Instruction_Case-QxZ`);
  assert.equal(exported.title_from_url_verify, records[0].title);
  assert.equal(exported.catalog, 'По видам работ');
  assert.equal(exported.section_id, 'W01');
  assert.equal(exported.section_name, 'Работы на высоте');
  assert.equal(exported.tags_ids, 'T47,T48,sosudy-pod-davleniem');
  assert.ok(exported.tags_names.includes('Газовые баллоны'));
  assert.ok(exported.tags_names.includes('Сосуды под давлением'));
  assert.equal(exported.review_status, 'Ручная проверка');
  assert.equal(exported.lastmod, '2025-03-04');
  assert.equal(exported.notes, 'Факт из записи');
  assert.equal(rows.find(row => row.url.endsWith('/published-noindex')).review_status, '');
  for (const privateText of ['old-alias', 'PRIVATE_DRAFT', 'PRIVATE_SEO', 'instructionContent']) {
    assert.equal(output.includes(privateText), false);
  }
  assert.deepEqual(records, before);
});

test('legacy assignments retain exact IDs, empty catalog and stored notes without inferred mappings', () => {
  const records = [
    record({
      primaryCategoryId: 'office',
      tagIds: ['sosudy-pod-davleniem'],
      notes: 'Сохранённое примечание',
      review_status: undefined,
      taxonomyMeta: { needsReview: false },
    }),
    record({ id: 'unclassified', slug: 'unclassified', primaryCategoryId: null, tagIds: [] }),
  ];
  const rows = parseReclassificationCsv(csv(records));
  const legacy = rows.find(row => row.section_id === 'office');
  assert.equal(legacy.catalog, '');
  assert.equal(legacy.section_name, 'Офис, ИТ и управление');
  assert.equal(legacy.tags_ids, 'sosudy-pod-davleniem');
  assert.equal(legacy.notes, 'Сохранённое примечание');
  assert.equal(legacy.review_status, '');
  const unclassified = rows.find(row => row.url.endsWith('/unclassified'));
  assert.equal(unclassified.catalog, '');
  assert.equal(unclassified.section_id, '');
  assert.equal(unclassified.notes, '');
});

test('CSV quotes separators, quotes and line breaks and protects human fields without changing stored IDs or URLs', () => {
  const registry = getInstructionTaxonomyRegistrySeed();
  registry.catalogs.find(item => item.code === 'H02').name = '+Каталог';
  registry.sections.find(item => item.code === 'W01').name = '@Раздел';
  registry.tags.find(item => item.code === 'T47').name = '-Тема';
  const source = record({
    title: '=HYPERLINK("https://example.com";"строка")\r\nПродолжение',
    tagIds: ['T47'],
    review_status: '\tПроверка',
    notes: 'Примечание; "кавычки"\nновая строка',
  });
  const before = structuredClone({ source, registry });
  const output = csv([source], { registry });
  const [row] = parseReclassificationCsv(output);
  assert.equal(row.title_from_url_verify, `'${source.title}`);
  assert.equal(row.catalog, "'+Каталог");
  assert.equal(row.section_name, "'@Раздел");
  assert.equal(row.tags_names, "'-Тема");
  assert.equal(row.review_status, "'\tПроверка");
  assert.equal(row.notes, source.notes);
  assert.equal(row.section_id, 'W01');
  assert.equal(row.tags_ids, 'T47');
  assert.equal(row.url, `${origin}/instrukciya-po-ohrane-truda/Legacy-Instruction_Case-QxZ`);
  assert.equal(output.includes('="'), false);
  assert.deepEqual({ source, registry }, before);
  for (const notes of ['=cmd()', '+cmd()', '-cmd()', '@cmd()', '\ncmd()', '\u0000cmd()']) {
    const [escaped] = parseReclassificationCsv(csv([record({ notes })]));
    assert.equal(escaped.notes, `'${notes}`);
  }
  const [leadingSpace] = parseReclassificationCsv(csv([record({ notes: ' Сохранённые пробелы' })]));
  assert.equal(leadingSpace.notes, ' Сохранённые пробелы');
});

test('filters apply exact published assignments and query text without using aliases', () => {
  const records = [
    record(),
    record({ id: 'legacy', slug: 'legacy', primaryCategoryId: 'office', tagIds: ['slesar'] }),
    record({ id: 'unassigned', slug: 'unassigned', primaryCategoryId: null, tagIds: [] }),
  ];
  assert.equal(parseReclassificationCsv(csv(records, { section: 'W01', tag: 'T47' })).length, 1);
  assert.equal(
    parseReclassificationCsv(csv(records, { section: 'office', tag: 'slesar' })).length,
    1,
  );
  assert.equal(parseReclassificationCsv(csv(records, { query: 'LEGACY' })).length, 1);
  assert.equal(parseReclassificationCsv(csv(records, { query: 'Газовые баллоны' })).length, 0);
  assert.equal(
    parseReclassificationCsv(
      csv([
        record({ slugAliases: ['current-alias'] }),
        record({ id: 'other-current', slug: 'current-alias' }),
      ]),
    ).length,
    2,
  );
  assert.equal(
    parseReclassificationCsv(csv([record({ id: 'fallback-current', slug: null })]))[0].url,
    `${origin}/instrukciya-po-ohrane-truda/fallback-current`,
  );
  for (const options of [
    { section: 'H02' },
    { section: 'w01' },
    { tag: 'Газовые баллоны' },
    { tag: 'T999' },
    { tag: ['T47'] },
    { query: {} },
  ])
    assert.throws(() => csv(records, options), {
      status: 400,
      code: 'INVALID_TAXONOMY_BULK_REQUEST',
    });
});

test('unknown assignments, duplicates and malformed source dates fail instead of dropping exported information', () => {
  for (const records of [
    [record({ primaryCategoryId: 'W99' })],
    [record({ tagIds: ['T99'] })],
    [record({ tagIds: ['T47', 'T47'] })],
    [record(), record({ id: 'duplicate-url' })],
    [record(), record({ slug: 'another-url' })],
    [record({ updatedAt: '=NOW()' })],
  ])
    assert.throws(() => csv(records), { status: 409, code: 'TAXONOMY_EXPORT_CONFLICT' });
  assert.throws(() => csv([record()], { origin: 'https://user:pass@boykovdocs.ru/' }), {
    status: 500,
    code: 'TAXONOMY_EXPORT_ORIGIN_ERROR',
  });
  assert.throws(() => csv([record()], { origin: 'https://boykovdocs.ru/path/' }), {
    code: 'TAXONOMY_EXPORT_ORIGIN_ERROR',
  });
});

test('export provider reads isolated published snapshots under the lease without persisting registry or journal files', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-export-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const saved = record();
  repository.save(saved);
  const draftDirectory = path.join(directory, 'drafts');
  fs.mkdirSync(draftDirectory);
  fs.writeFileSync(
    path.join(draftDirectory, `${Buffer.from(saved.id).toString('base64url')}.json`),
    JSON.stringify({ ...saved, title: 'PRIVATE_DRAFT', revision: 2, status: 'draft' }),
  );
  const filePath = path.join(directory, 'registry', 'taxonomy.json');
  const registryRepository = createInstructionTaxonomyRegistryRepository({ filePath });
  const exporter = createInstructionTaxonomyCsvExporter({
    store: createInstructionTaxonomyBindingStore({ repository, draftsDirectory: draftDirectory }),
    registryRepository,
    origin,
  });
  const publishedFile = path.join(repository.dir, `${saved.id}.json`);
  const before = fs.readFileSync(publishedFile);
  const output = exporter();
  assert.equal(parseReclassificationCsv(output).length, 1);
  assert.equal(output.includes('PRIVATE_DRAFT'), false);
  assert.equal(fs.existsSync(filePath), false);
  assert.equal(fs.existsSync(`${filePath}.lock`), false);
  assert.equal(fs.existsSync(registryRepository.operationsDirectory), false);
  assert.deepEqual(fs.readFileSync(publishedFile), before);
  assert.equal(registryRepository.read().revision, 0);
});
