import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { TextDecoder } from 'node:util';

const SOURCE_FILE = 'BOYKOVDOCS_CHECK_MANUALLY.csv';
const SOURCE_SHA256 = '5b271c8108b6ddfdd57ded13ddee8b20b5c30d401369c8eb908c9cee7ac822d4';
const RECORDS_SHA256 = '803a362cad0ac42100a328ed4c56524a31dd0271ec523899b1401e8ebc8c168d';
const RECORD_FIELDS = [
  'sourceId',
  'url',
  'sectionCode',
  'sectionName',
  'reason',
  'action',
  'title',
  'confidence',
  'previousSectionCode',
  'previousSectionName',
];

function exactFields(value, fields) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every(field => Object.hasOwn(value, field))
  );
}

function validate(source) {
  if (
    !exactFields(source, ['source', 'records']) ||
    !exactFields(source.source, ['file', 'sha256', 'rows']) ||
    source.source.file !== SOURCE_FILE ||
    source.source.sha256 !== SOURCE_SHA256 ||
    source.source.rows !== 63 ||
    !Array.isArray(source.records) ||
    source.records.length !== source.source.rows
  ) {
    throw new Error('Invalid instruction taxonomy manual-review source metadata');
  }

  const urls = new Set();
  const ids = new Set();
  for (const record of source.records) {
    if (
      !exactFields(record, RECORD_FIELDS) ||
      RECORD_FIELDS.some(field => typeof record[field] !== 'string' || !record[field].trim()) ||
      !/^DOC-[1-9]\d*$/u.test(record.sourceId) ||
      !/^[PW]\d{2}$/u.test(record.sectionCode) ||
      !/^[PW]\d{2}$/u.test(record.previousSectionCode) ||
      !/^\d+$/u.test(record.confidence)
    ) {
      throw new Error('Invalid instruction taxonomy manual-review record');
    }
    const url = new URL(record.url);
    if (
      url.origin !== 'https://boykovdocs.ru' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/instrukciya-po-ohrane-truda\/[^/]+$/u.test(url.pathname) ||
      record.url !== url.href ||
      urls.has(record.url) ||
      ids.has(record.sourceId)
    ) {
      throw new Error('Invalid or duplicated instruction taxonomy manual-review URL');
    }
    decodeURIComponent(url.pathname);
    urls.add(record.url);
    ids.add(record.sourceId);
    Object.freeze(record);
  }
  const normalized = source.records.map(record =>
    Object.fromEntries(RECORD_FIELDS.map(field => [field, record[field]])),
  );
  if (createHash('sha256').update(JSON.stringify(normalized)).digest('hex') !== RECORDS_SHA256) {
    throw new Error('Instruction taxonomy manual-review records differ from the supplied source');
  }
  Object.freeze(source.records);
  Object.freeze(source.source);
  return Object.freeze(source);
}

const file = new URL('../data/instructionTaxonomyReviewSource.json', import.meta.url);
if (!fs.lstatSync(file).isFile()) {
  throw new Error('Instruction taxonomy manual-review source must be a regular file');
}
const source = validate(
  JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file))),
);

export function getInstructionTaxonomyReviewSource() {
  return structuredClone(source);
}
