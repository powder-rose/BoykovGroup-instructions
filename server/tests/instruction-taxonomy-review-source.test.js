import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { getInstructionTaxonomyReviewSource } from '../src/services/instructionTaxonomyReviewSource.js';

const file = new URL('../src/data/instructionTaxonomyReviewSource.json', import.meta.url);
const recordsHash = '803a362cad0ac42100a328ed4c56524a31dd0271ec523899b1401e8ebc8c168d';

test('trusted manual-review source preserves all 63 original records and source provenance', () => {
  const source = getInstructionTaxonomyReviewSource();
  assert.deepEqual(source.source, {
    file: 'BOYKOVDOCS_CHECK_MANUALLY.csv',
    sha256: '5b271c8108b6ddfdd57ded13ddee8b20b5c30d401369c8eb908c9cee7ac822d4',
    rows: 63,
  });
  assert.equal(source.records.length, 63);
  assert.equal(new Set(source.records.map(record => record.url)).size, 63);
  assert.equal(new Set(source.records.map(record => record.sourceId)).size, 63);
  assert.equal(
    createHash('sha256').update(JSON.stringify(source.records)).digest('hex'),
    recordsHash,
  );
  assert.deepEqual(source.records[0], {
    sourceId: 'DOC-967',
    url: 'https://boykovdocs.ru/instrukciya-po-ohrane-truda/instruktsiya-po-ohrane-truda-dlya-pogruzochno-razgruzochnyh-rabot-bez-uchastiya-pogruzchika-7mKHEX',
    sectionCode: 'W05',
    sectionName: 'Погрузочно-разгрузочные и складские работы',
    reason: 'Пересекаются темы: W12(111)',
    action: 'Проверить фактический вид работ и выбрать одну из тем',
    title: 'Инструкция по охране труда для погрузочно разгрузочных работ без участийа погрузчика',
    confidence: '4',
    previousSectionCode: 'W05',
    previousSectionName: 'Погрузочно-разгрузочные и складские работы',
  });
  assert.ok(source.records.some(record => record.confidence === '0'));
  assert.ok(source.records.some(record => record.confidence === '115'));
  assert.ok(source.records.every(record => !Object.hasOwn(record, 'approved')));
});

test('callers receive independent clones without changing trusted review data or writing source files', () => {
  const bytes = fs.readFileSync(file);
  const modified = fs.statSync(file).mtimeMs;
  const a = getInstructionTaxonomyReviewSource();
  const b = getInstructionTaxonomyReviewSource();
  assert.notEqual(a, b);
  assert.notEqual(a.source, b.source);
  assert.notEqual(a.records, b.records);
  assert.notEqual(a.records[0], b.records[0]);
  a.source.rows = 0;
  a.records[0].url = 'https://other.example/';
  a.records.splice(1);
  assert.deepEqual(getInstructionTaxonomyReviewSource(), b);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(fs.statSync(file).mtimeMs, modified);
});

test('missing or corrupt trusted review data fails module loading instead of disabling manual holds', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-review-source-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const serviceDirectory = path.join(directory, 'services');
  const dataDirectory = path.join(directory, 'data');
  fs.mkdirSync(serviceDirectory);
  fs.mkdirSync(dataDirectory);
  fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
  const moduleFile = path.join(serviceDirectory, 'instructionTaxonomyReviewSource.js');
  fs.copyFileSync(
    new URL('../src/services/instructionTaxonomyReviewSource.js', import.meta.url),
    moduleFile,
  );
  const target = path.join(dataDirectory, 'instructionTaxonomyReviewSource.json');
  const reference = getInstructionTaxonomyReviewSource();
  const load = () =>
    spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(pathToFileURL(moduleFile).href)})`,
      ],
      { encoding: 'utf8' },
    );
  const mutated = mutator => {
    const value = structuredClone(reference);
    mutator(value);
    return Buffer.from(JSON.stringify(value));
  };
  fs.writeFileSync(target, JSON.stringify(reference));
  assert.equal(load().status, 0);
  const reordered = structuredClone(reference);
  reordered.records = reordered.records.map(record =>
    Object.fromEntries(Object.entries(record).reverse()),
  );
  fs.writeFileSync(target, JSON.stringify(reordered));
  assert.equal(
    load().status,
    0,
    'Equivalent record field order changed the trusted-source checksum',
  );
  const invalid = [
    null,
    Buffer.from('{invalid'),
    Buffer.from([0xff, 0xfe]),
    Buffer.from('null'),
    mutated(value => {
      value.records.pop();
    }),
    mutated(value => {
      value.source.sha256 = '0'.repeat(64);
    }),
    mutated(value => {
      value.records[1].url = value.records[0].url;
    }),
    mutated(value => {
      value.records[1].sourceId = value.records[0].sourceId;
    }),
    mutated(value => {
      value.records[0].url = 'https://other.example/instrukciya-po-ohrane-truda/test';
    }),
    mutated(value => {
      value.records[0].url =
        'https://boykovdocs.ru/instrukciya-po-ohrane-truda/a-valid-but-untrusted-address';
    }),
    mutated(value => {
      value.records[0].reason += ' Изменённое примечание';
    }),
  ];
  for (const [index, bytes] of invalid.entries()) {
    fs.rmSync(target, { force: true });
    if (bytes) fs.writeFileSync(target, bytes);
    const result = load();
    assert.notEqual(result.status, 0, `Invalid trusted source variant ${index} loaded`);
  }
});
