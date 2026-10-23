import assert from 'node:assert/strict';
import test from 'node:test';

import { getInstructionPublicPath } from '../src/shared/instructionDocument.js';
import { INSTRUCTION_TAXONOMY_CSV_HEADERS } from '../src/services/instructionTaxonomyCsvFormat.js';
import {
  buildInstructionTaxonomyCsvImport,
  fingerprintInstructionTaxonomyImportAddresses,
  MAX_INSTRUCTION_TAXONOMY_CSV_BYTES,
} from '../src/services/instructionTaxonomyCsvImport.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { getInstructionTaxonomyReviewSource } from '../src/services/instructionTaxonomyReviewSource.js';

const origin = 'https://boykovdocs.ru';
const url = slug => `${origin}${getInstructionPublicPath({ slug })}`;
const registry = () => getInstructionTaxonomyRegistrySeed();
const snapshot = (id = 'internal-id', overrides = {}, version = 'published') => ({
  id,
  version,
  record: {
    id,
    title: `Actual title ${id}`,
    slug: `manager-${id}-AbC`,
    slugAliases: [`old-${id}-XyZ`],
    primaryCategoryId: 'P10',
    tagIds: ['sosudy-pod-davleniem', 'T47'],
    revision: 5,
    status: version === 'draft' ? 'draft' : 'published',
    instructionContent: { type: 'doc', content: [] },
    seoTitle: 'Existing SEO title',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  },
});

function row(overrides = {}, state = registry()) {
  const sectionId = overrides.section_id || 'W02';
  const section = state.sections.find(item => item.code === sectionId);
  const catalog = state.catalogs.find(item => item.code === section?.parentCode);
  const tagIds =
    overrides.tags_ids === undefined
      ? ['T48']
      : overrides.tags_ids
          .split(',')
          .map(id => id.trim())
          .filter(Boolean);
  return {
    document_id: '7',
    url: url('manager-internal-id-AbC'),
    title_from_url_verify: 'Unconfirmed derived title',
    catalog: catalog?.name || '',
    section_id: sectionId,
    section_name: section?.name || '',
    tags_ids: tagIds.join(','),
    tags_names: tagIds.map(id => state.tags.find(item => item.code === id)?.name || id).join(', '),
    review_status: 'Предварительно классифицировано по смыслу заголовка',
    lastmod: '2026-08-27',
    notes: 'Source notes remain a report field only',
    ...overrides,
  };
}

function csv(rows, headers = INSTRUCTION_TAXONOMY_CSV_HEADERS) {
  const cell = value =>
    /[;"\r\n]/u.test(String(value ?? ''))
      ? `"${String(value ?? '').replaceAll('"', '""')}"`
      : String(value ?? '');
  return Buffer.from(
    `\uFEFF${headers.join(';')}\r\n${rows.map(value => headers.map(header => cell(value[header])).join(';')).join('\r\n')}\r\n`,
    'utf8',
  );
}

function plan(options = {}) {
  return buildInstructionTaxonomyCsvImport({
    bytes: csv([row()]),
    fileName: 'assignments.csv',
    registry: registry(),
    snapshots: [snapshot()],
    origin,
    manualReferences: [],
    ...options,
  });
}

test('CSV planning matches by URL and returns assignment-only proposals without changing source data', () => {
  const state = registry();
  const snapshots = [snapshot(), snapshot('internal-id', { revision: 7 }, 'draft')];
  const before = structuredClone({ state, snapshots });
  const bytes = csv([
    row({ document_id: 'another-ordinal', title_from_url_verify: 'Different; title\n"quoted"' }),
  ]);
  const result = plan({ bytes, snapshots, registry: state });
  assert.deepEqual(result.assignments, [{ id: 'internal-id', sectionId: 'W02', tagIds: ['T48'] }]);
  assert.equal(result.report.file.name, 'assignments.csv');
  assert.equal(result.report.file.bytes, bytes.length);
  assert.match(result.report.file.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.report.records[0].titleFromUrlVerify, 'Different; title\n"quoted"');
  assert.equal(result.report.records[0].currentUrl, url('manager-internal-id-AbC'));
  assert.equal(result.report.counts.matched, 1);
  assert.equal(result.report.counts.eligibleRows, 1);
  assert.deepEqual({ state, snapshots }, before);
  const missing = plan({ bytes: csv([row({ document_id: 'internal-id', url: url('missing') })]) });
  assert.equal(missing.report.records[0].match, 'not-found');
  assert.deepEqual(missing.assignments, []);
});

test('the eleven header names are exact while their order and quoted UTF-8 values remain supported', () => {
  assert.equal(
    plan({ bytes: csv([row()], [...INSTRUCTION_TAXONOMY_CSV_HEADERS].reverse()) }).assignments
      .length,
    1,
  );
  for (const headers of [
    [...INSTRUCTION_TAXONOMY_CSV_HEADERS, 'extra'],
    INSTRUCTION_TAXONOMY_CSV_HEADERS.slice(1),
    [...INSTRUCTION_TAXONOMY_CSV_HEADERS.slice(1), 'url'],
  ])
    assert.throws(() => plan({ bytes: csv([row()], headers) }), {
      code: 'INVALID_TAXONOMY_CSV_IMPORT',
    });
});

test('invalid UTF-8, missing BOM, malformed CSV and oversized or empty inputs fail before planning', () => {
  const header = Buffer.from('\uFEFFa;b\r\n', 'utf8');
  for (const bytes of [
    Buffer.from('document_id;url\n1;value'),
    Buffer.from([0xef, 0xbb, 0xbf, 0xc3, 0x28]),
    Buffer.from('\uFEFFa;b\n"unclosed'),
    Buffer.alloc(0),
    Buffer.alloc(MAX_INSTRUCTION_TAXONOMY_CSV_BYTES + 1),
    header,
    csv([]),
  ])
    assert.throws(() => plan({ bytes }), { code: 'INVALID_TAXONOMY_CSV_IMPORT' });
  assert.throws(
    () =>
      plan({
        bytes: csv(
          Array.from({ length: 5001 }, (_, index) => row({ document_id: String(index + 1) })),
        ),
      }),
    { code: 'INVALID_TAXONOMY_CSV_IMPORT' },
  );
  for (const fileName of ['', '../source.csv', 'folder\\source.csv', 'bad\nname.csv']) {
    assert.throws(() => plan({ fileName }), { code: 'INVALID_TAXONOMY_CSV_IMPORT' });
  }
});

test('filenames accept at most two hundred characters before journal validation', () => {
  assert.equal(plan({ fileName: `${'a'.repeat(196)}.csv` }).assignments.length, 1);
  assert.throws(() => plan({ fileName: `${'a'.repeat(197)}.csv` }), {
    code: 'INVALID_TAXONOMY_CSV_IMPORT',
  });
});

test('matching preserves slug case and accepts current, trailing-slash, ID and reserved alias URLs', () => {
  for (const slug of ['manager-internal-id-AbC', 'internal-id', 'old-internal-id-XyZ']) {
    for (const suffix of ['', '/'])
      assert.equal(
        plan({ bytes: csv([row({ url: `${url(slug)}${suffix}` })]) }).assignments[0].id,
        'internal-id',
      );
  }
  assert.equal(
    plan({ bytes: csv([row({ url: url('manager-internal-id-abc') })]) }).report.counts.notFound,
    1,
  );
});

test('foreign, relative, credentialed, queried, fragmented and malformed instruction URLs are excluded', () => {
  for (const address of [
    'https://other.example/instrukciya-po-ohrane-truda/manager-internal-id-AbC',
    'https://user:secret@boykovdocs.ru/instrukciya-po-ohrane-truda/manager-internal-id-AbC',
    `${url('manager-internal-id-AbC')}?q=1`,
    `${url('manager-internal-id-AbC')}#text`,
    'https://boykovdocs.ru/other/manager-internal-id-AbC',
    'https://boykovdocs.ru/instrukciya-po-ohrane-truda/%GG',
    '/instrukciya-po-ohrane-truda/manager-internal-id-AbC',
    ` ${url('manager-internal-id-AbC')}`,
  ]) {
    const result = plan({ bytes: csv([row({ url: address })]) });
    assert.equal(result.report.counts.invalidUrl, 1, address);
    assert.deepEqual(result.assignments, []);
  }
});

test('ambiguous live URLs and duplicate CSV addresses, ordinals or target IDs are never eligible', () => {
  const ambiguous = plan({
    snapshots: [snapshot(), snapshot('other', { slug: 'manager-internal-id-AbC' })],
  });
  assert.equal(ambiguous.report.counts.ambiguous, 1);
  assert.deepEqual(ambiguous.assignments, []);
  for (const second of [
    row({ document_id: '8', url: `${url('manager-internal-id-AbC')}/` }),
    row({ document_id: '8', url: url('old-internal-id-XyZ') }),
    row({ url: url('manager-other-AbC') }),
  ]) {
    const result = plan({
      bytes: csv([row(), second]),
      snapshots: [snapshot(), snapshot('other')],
    });
    assert.equal(result.report.counts.sourceInvalid, 2);
    assert.equal(result.report.counts.skippedRows, 2);
    assert.deepEqual(result.assignments, []);
  }
});

test('draft-only and nonpublished records do not match a public CSV URL or create sibling ambiguity', () => {
  const result = plan({
    bytes: csv([
      row(),
      row({ document_id: '8', url: url('manager-draft-AbC') }),
      row({ document_id: '9', url: url('manager-seodraft-AbC') }),
    ]),
    snapshots: [
      snapshot(),
      snapshot('internal-id', { revision: 7 }, 'draft'),
      snapshot('draft', { status: 'draft' }),
      snapshot('seodraft', { seoStatus: 'draft' }),
    ],
  });
  assert.equal(result.report.counts.matched, 1);
  assert.equal(result.report.counts.notFound, 2);
  assert.deepEqual(
    result.assignments.map(item => item.id),
    ['internal-id'],
  );
  assert.equal(
    plan({ snapshots: [snapshot('internal-id', {}, 'draft')] }).report.counts.notFound,
    1,
  );
});

test('all source manual-review URLs remain held through aliases even after the uploaded status is cleared', () => {
  const references = getInstructionTaxonomyReviewSource().records;
  const state = registry();
  const snapshots = references.map((reference, index) =>
    snapshot(`review-${index}`, {
      slug: `new-review-${index}-AbC`,
      slugAliases: [
        decodeURIComponent(new URL(reference.url).pathname.split('/').at(-1)),
        `alternate-review-${index}-XyZ`,
      ],
    }),
  );
  const rows = references.map((reference, index) =>
    row(
      {
        document_id: String(index + 1),
        url: url(`alternate-review-${index}-XyZ`),
        section_id: reference.sectionCode,
        review_status: '',
      },
      state,
    ),
  );
  const result = plan({
    bytes: csv(rows),
    snapshots,
    registry: state,
    manualReferences: references,
  });
  assert.equal(result.report.counts.matched, 63);
  assert.equal(result.report.counts.manualReview, 63);
  assert.equal(result.report.counts.eligibleRows, 0);
  assert.deepEqual(result.assignments, []);
  for (const [index, record] of result.report.records.entries()) {
    assert.equal(record.status, 'review');
    assert.ok(record.reviewReasons.includes(references[index].reason));
  }
});

test('new manual flags hold rows independently of the original source list and remain visible with errors', () => {
  for (const review_status of [
    'Проверить вручную — неоднозначное назначение',
    'manual review',
    'approved',
    'Неизвестный статус',
    'Предварительно классифицировано по смыслу загловка',
  ]) {
    const result = plan({ bytes: csv([row({ review_status })]) });
    assert.equal(result.report.counts.manualReview, 1);
    assert.equal(result.report.records[0].status, 'review');
    assert.deepEqual(result.assignments, []);
  }
  const result = plan({
    bytes: csv([row({ review_status: 'Проверить вручную', section_id: 'P99' })]),
  });
  assert.equal(result.report.counts.manualReview, 1);
  assert.equal(result.report.counts.sourceInvalid, 1);
  assert.equal(result.report.records[0].status, 'source-error');
});

test('unknown code counts are distinct and invalid names or duplicate tags exclude only their rows', () => {
  const result = plan({
    bytes: csv([
      row({ section_id: 'P99', tags_ids: 'T99' }),
      row({ document_id: '8', url: url('manager-other-AbC'), section_id: 'P99', tags_ids: 'T99' }),
      row({ document_id: '9', url: url('manager-good-AbC'), tags_ids: '' }),
    ]),
    snapshots: [snapshot(), snapshot('other'), snapshot('good')],
  });
  assert.equal(result.report.counts.unknownSections, 1);
  assert.equal(result.report.counts.unknownTags, 1);
  assert.deepEqual(result.report.unknownSectionIds, ['P99']);
  assert.deepEqual(result.report.unknownTagIds, ['T99']);
  assert.equal(result.report.counts.sourceInvalid, 2);
  assert.deepEqual(result.assignments, [{ id: 'good', sectionId: 'W02', tagIds: [] }]);
  for (const overrides of [
    { section_name: 'Wrong' },
    { catalog: 'Wrong' },
    { tags_names: 'Wrong' },
    { tags_ids: 'T47,T47' },
    { tags_ids: 'T47,,T48' },
  ])
    assert.deepEqual(plan({ bytes: csv([row(overrides)]) }).assignments, []);
});

test('unknown or malformed current assignments in any saved version are reported while other rows remain eligible', () => {
  for (const changes of [
    { tagIds: ['UNKNOWN'] },
    { primaryCategoryId: 'UNKNOWN' },
    { revision: Number.MAX_SAFE_INTEGER },
  ]) {
    const result = plan({
      bytes: csv([row(), row({ document_id: '8', url: url('manager-good-AbC') })]),
      snapshots: [snapshot(), snapshot('internal-id', changes, 'draft'), snapshot('good')],
    });
    assert.ok(
      result.report.records[0].errors.some(error => error.code === 'invalid-current-assignment'),
    );
    assert.deepEqual(
      result.assignments.map(item => item.id),
      ['good'],
    );
  }
});

test('empty tags are valid for both modes and the planner never maps legacy combined tags to T47 or T48', () => {
  for (const tagMode of ['add', 'replace']) {
    const result = plan({ bytes: csv([row({ tags_ids: '' })]), tagMode });
    assert.deepEqual(result.assignments, [{ id: 'internal-id', sectionId: 'W02', tagIds: [] }]);
    assert.equal(result.report.tagMode, tagMode);
  }
  const result = plan({ bytes: csv([row({ tags_ids: 'T47,T48' })]) });
  assert.deepEqual(result.assignments[0].tagIds, ['T47', 'T48']);
  assert.throws(() => plan({ tagMode: 'automatic' }), { code: 'INVALID_TAXONOMY_CSV_IMPORT' });
});

test('address fingerprints bind the origin and published namespace without depending on document content', () => {
  const snapshots = [snapshot()];
  const fingerprint = fingerprintInstructionTaxonomyImportAddresses(snapshots, { origin });
  assert.equal(
    fingerprintInstructionTaxonomyImportAddresses(
      [
        snapshot('internal-id', {
          title: 'Later title',
          revision: 99,
          seoTitle: 'New SEO',
          tagIds: ['T48'],
        }),
      ],
      { origin },
    ),
    fingerprint,
  );
  for (const value of [
    [snapshot('internal-id', { slug: 'new-current-AbC' })],
    [snapshot('internal-id', { slugAliases: ['new-alias-AbC'] })],
    [snapshot(), snapshot('unrelated')],
    [snapshot('internal-id', { status: 'draft' })],
  ])
    assert.notEqual(fingerprintInstructionTaxonomyImportAddresses(value, { origin }), fingerprint);
  assert.notEqual(
    fingerprintInstructionTaxonomyImportAddresses(snapshots, { origin: 'https://staging.example' }),
    fingerprint,
  );
  assert.equal(
    fingerprintInstructionTaxonomyImportAddresses(
      [...snapshots, snapshot('draft-only', {}, 'draft')],
      { origin },
    ),
    fingerprint,
  );
});

test('malformed live URL fields and malformed trusted references fail closed rather than being ignored', () => {
  for (const overrides of [{ slug: 5 }, { slugAliases: [''] }, { slugAliases: 'other' }]) {
    assert.throws(() => plan({ snapshots: [snapshot('internal-id', overrides)] }), {
      code: 'TAXONOMY_CSV_LIVE_CONFLICT',
      status: 409,
    });
  }
  assert.throws(() => plan({ manualReferences: [{ url: 'not-a-url' }] }), {
    code: 'TAXONOMY_CSV_REVIEW_SOURCE_ERROR',
    status: 500,
  });
});
