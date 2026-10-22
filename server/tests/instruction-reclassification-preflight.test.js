import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInstructionReclassificationReport,
  parseReclassificationCsv,
} from '../src/services/instructionReclassificationPreflight.js';

const origin = 'https://boykovdocs.ru';
const url = slug => `${origin}/instrukciya-po-ohrane-truda/${slug}`;
const dictionary = {
  catalogs: [{ code: 'H01', name: 'По профессиям', url: `${origin}/professions/` }],
  sections: [
    {
      code: 'P01',
      catalogCode: 'H01',
      name: 'Руководители',
      url: `${origin}/professions/managers/`,
    },
  ],
  tags: [{ code: 'T01', name: 'Руководители', url: `${origin}/topics/managers/` }],
  issues: [{ code: 'url-decision-pending' }],
};
const row = (overrides = {}) => ({
  document_id: '7',
  url: url('manager-XaBc'),
  catalog: 'По профессиям',
  section_id: 'P01',
  section_name: 'Руководители',
  tags_ids: 'T01',
  tags_names: 'Руководители',
  review_status: 'Предварительно классифицировано по смыслу заголовка',
  ...overrides,
});
const instruction = (overrides = {}) => ({
  id: 'internal-record-id',
  slug: 'manager-XaBc',
  slugAliases: ['old-address-Zz'],
  primaryCategoryId: 'legacy-category',
  tagIds: ['legacy-tag'],
  title: 'Preserved actual title',
  seoTitle: 'Preserved SEO',
  revision: 9,
  instructionContent: { type: 'doc', content: [] },
  ...overrides,
});
const report = (options = {}) =>
  buildInstructionReclassificationReport({ importRows: [row()], dictionary, ...options });
const reference = (overrides = {}) => ({
  ID: 'DOC-7',
  URL: url('manager-XaBc'),
  'Стало ID': 'P01',
  'Стало название': 'Руководители',
  ...overrides,
});

test('CSV preserves strings, BOM, Cyrillic, quoted delimiters, escaped quotes and multiline text', () => {
  assert.deepEqual(
    parseReclassificationCsv(
      '\uFEFFid;name;notes\r\n007;"Тема; детали";"Первая\r\nВторая ""цитата"""\r\n',
      { requiredColumns: ['id', 'name'] },
    ),
    [{ id: '007', name: 'Тема; детали', notes: 'Первая\r\nВторая "цитата"' }],
  );
  assert.deepEqual(parseReclassificationCsv('a;b\n1;\n\n'), [{ a: '1', b: '' }]);
});

test('CSV rejects malformed quoting, duplicate/empty headers and missing/extra fields', () => {
  for (const csv of [
    'a;a\n1;2',
    'a;\n1;2',
    'a;b\n1',
    'a;b\n1;2;3',
    'a\n"unclosed',
    'a\nvalue"x',
    'a\n"closed" x',
  ])
    assert.throws(() => parseReclassificationCsv(csv), /CSV/u, csv);
  assert.throws(
    () => parseReclassificationCsv('a\n1', { requiredColumns: ['b'] }),
    /column is missing/u,
  );
  assert.throws(() => parseReclassificationCsv(''), /header is missing/u);
});

test('source-only mode never claims a live match or application readiness', () => {
  const result = report();
  assert.equal(result.mode, 'source-only');
  assert.equal(result.liveDataChecked, false);
  assert.equal(result.applySupported, false);
  assert.equal(result.counts.candidates, 0);
  assert.equal(result.counts.matched, 0);
  assert.equal(result.records[0].status, 'source-valid');
  assert.deepEqual(result.dictionaryIssues, dictionary.issues);
  assert.notEqual(result.dictionaryIssues, dictionary.issues);
});

test('URL matching preserves instruction content and legacy assignments and ignores registry ID', () => {
  const current = instruction();
  const before = structuredClone(current);
  const result = report({ instructions: [current] });
  assert.equal(result.records[0].status, 'candidate');
  assert.deepEqual(result.records[0].existing, {
    id: current.id,
    primaryCategoryId: 'legacy-category',
    tagIds: ['legacy-tag'],
  });
  assert.deepEqual(result.records[0].proposed, { sectionCode: 'P01', tagCodes: ['T01'] });
  assert.deepEqual(current, before);
  assert.equal(
    report({
      importRows: [row({ document_id: current.id, url: url('missing') })],
      instructions: [current],
    }).records[0].match,
    'not-found',
  );
});

test('matching respects mixed-case slugs, trailing slash, internal-ID URLs and aliases', () => {
  for (const slug of ['manager-XaBc', 'manager-XaBc/', 'internal-record-id', 'old-address-Zz'])
    assert.equal(
      report({ importRows: [row({ url: url(slug) })], instructions: [instruction()] }).records[0]
        .match,
      'matched',
    );
  assert.equal(
    report({ importRows: [row({ url: url('manager-xabc') })], instructions: [instruction()] })
      .records[0].match,
    'not-found',
  );
});

test('foreign URLs, credentials, parameters, fragments and invalid paths never match', () => {
  for (const address of [
    'https://other.example/instrukciya-po-ohrane-truda/manager-XaBc',
    'https://user:password@boykovdocs.ru/instrukciya-po-ohrane-truda/manager-XaBc',
    `${url('manager-XaBc')}?q=1`,
    `${url('manager-XaBc')}#text`,
    `${origin}/wrong/manager-XaBc`,
    url('%GG'),
    '/relative',
  ]) {
    const record = report({ importRows: [row({ url: address })], instructions: [instruction()] })
      .records[0];
    assert.equal(record.match, 'invalid-url', address);
    assert.equal(record.status, 'source-error', address);
  }
});

test('duplicate registry IDs, duplicate normalized URLs and aliases targeting one record are held', () => {
  for (const duplicate of [
    row({ url: url('other') }),
    row({ document_id: '8', url: `${url('manager-XaBc')}/` }),
    row({ document_id: '8', url: url('old-address-Zz') }),
  ]) {
    const result = report({ importRows: [row(), duplicate], instructions: [instruction()] });
    assert.equal(result.counts.candidates, 0);
    assert.equal(result.counts.sourceInvalid, 2);
  }
});

test('ambiguous live addresses and duplicate live IDs produce explicit errors', () => {
  const result = report({ instructions: [instruction(), instruction({ id: 'other-id' })] });
  assert.equal(result.records[0].match, 'ambiguous');
  assert.equal(result.counts.candidates, 0);
  assert.ok(result.errors.some(error => error.code === 'duplicate-live-url'));
  assert.ok(
    report({
      instructions: [instruction(), instruction({ slug: 'other', slugAliases: [] })],
    }).errors.some(error => error.code === 'duplicate-live-id'),
  );
});

test('either main review marker or separate manual list holds the assignment', () => {
  for (const options of [
    { importRows: [row({ review_status: 'Проверить вручную: неоднозначная тема' })] },
    { manualRows: [reference()] },
  ]) {
    const result = report({ ...options, instructions: [instruction()] });
    assert.equal(result.counts.manualReview, 1);
    assert.equal(result.counts.candidates, 0);
    assert.equal(result.records[0].status, 'review');
  }
});

test('manual and changed references cannot silently override the authoritative target', () => {
  for (const source of ['manualRows', 'changedRows']) {
    const mismatch = report({
      [source]: [reference({ 'Стало ID': 'W21' })],
      instructions: [instruction()],
    });
    assert.equal(mismatch.records[0].status, 'source-error');
    assert.ok(mismatch.errors.some(error => error.code === 'reference-target-mismatch'));
    assert.ok(
      report({ [source]: [reference({ URL: url('missing') })] }).errors.some(
        error => error.code === 'reference-import-match',
      ),
    );
    assert.ok(
      report({ [source]: [reference(), reference()] }).errors.some(
        error => error.code === 'duplicate-reference-url',
      ),
    );
  }
});

test('unknown codes, mismatched names and duplicate tags fail while empty tag sets are valid', () => {
  for (const overrides of [
    { section_id: 'P99' },
    { section_name: 'Wrong' },
    { catalog: 'Wrong' },
    { tags_ids: 'T99' },
    { tags_names: 'Wrong' },
    { tags_ids: 'T01,T01', tags_names: 'Руководители, Руководители' },
  ])
    assert.equal(report({ importRows: [row(overrides)] }).records[0].status, 'source-error');
  assert.equal(
    report({ importRows: [row({ tags_ids: '', tags_names: '' })] }).counts.sourceInvalid,
    0,
  );
});

test('duplicate dictionary codes and route conflicts are explicit errors', () => {
  const duplicateCode = structuredClone(dictionary);
  duplicateCode.sections.push({ ...duplicateCode.sections[0] });
  const result = report({ dictionary: duplicateCode });
  assert.ok(result.errors.some(error => error.code === 'duplicate-dictionary-code'));
  assert.equal(result.records[0].status, 'source-error');
  const duplicateRoute = structuredClone(dictionary);
  duplicateRoute.tags[0].url = duplicateRoute.sections[0].url;
  assert.ok(
    report({ dictionary: duplicateRoute }).errors.some(
      error => error.code === 'duplicate-dictionary-url',
    ),
  );
  const liveConflict = structuredClone(dictionary);
  liveConflict.tags[0].url = url('manager-XaBc');
  assert.ok(
    report({ dictionary: liveConflict, instructions: [instruction()] }).errors.some(
      error => error.code === 'dictionary-live-url-conflict',
    ),
  );
});

test('new classification preview has no old five-tag cap', () => {
  const expanded = structuredClone(dictionary);
  expanded.tags = Array.from({ length: 8 }, (_, index) => ({
    code: `T${index + 1}`,
    name: `Тема ${index + 1}`,
    url: `${origin}/topic-${index + 1}`,
  }));
  const result = report({
    dictionary: expanded,
    importRows: [
      row({
        tags_ids: expanded.tags.map(tag => tag.code).join(','),
        tags_names: expanded.tags.map(tag => tag.name).join(', '),
      }),
    ],
  });
  assert.equal(result.counts.sourceInvalid, 0);
  assert.equal(result.records[0].proposed.tagCodes.length, 8);
});

test('invalid dictionary collections, cross-kind code reuse and unused orphan sections fail clearly', () => {
  assert.throws(() => report({ dictionary: { ...dictionary, tags: {} } }), /must be arrays/u);
  const duplicate = structuredClone(dictionary);
  duplicate.tags[0].code = 'P01';
  assert.ok(
    report({ dictionary: duplicate }).errors.some(
      error => error.code === 'duplicate-dictionary-code',
    ),
  );
  const orphan = structuredClone(dictionary);
  orphan.sections.push({
    code: 'P99',
    name: 'Unused',
    url: `${origin}/unused`,
    catalogCode: 'missing',
  });
  assert.ok(
    report({ dictionary: orphan }).errors.some(error => error.code === 'unknown-parent-catalog'),
  );
});

test('duplicate internal IDs block otherwise unique addresses and malformed live tags remain visible', () => {
  const duplicated = report({
    instructions: [instruction(), instruction({ slug: 'other', slugAliases: [] })],
  });
  assert.equal(duplicated.counts.candidates, 0);
  assert.ok(duplicated.records[0].errors.some(error => error.code === 'invalid-live-record'));
  const malformed = report({ instructions: [instruction({ tagIds: 'broken-list' })] });
  assert.equal(malformed.counts.candidates, 0);
  assert.equal(malformed.records[0].existing.tagIds, 'broken-list');
  assert.ok(malformed.errors.some(error => error.code === 'invalid-live-taxonomy'));
});

test('not-found and ambiguous matches are present in the downloadable errors', () => {
  assert.ok(
    report({ instructions: [] }).errors.some(error => error.code === 'instruction-not-found'),
  );
  assert.ok(
    report({ instructions: [instruction(), instruction({ id: 'other-id' })] }).errors.some(
      error => error.code === 'instruction-ambiguous',
    ),
  );
  assert.ok(
    report({ changedRows: [reference({ Каталог: 'Wrong catalog' })] }).errors.some(
      error => error.code === 'reference-catalog-mismatch',
    ),
  );
});
