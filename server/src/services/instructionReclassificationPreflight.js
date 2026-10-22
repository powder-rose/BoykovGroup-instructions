import { getInstructionPublicPath } from '../shared/instructionDocument.js';

export function parseReclassificationCsv(text, { requiredColumns = [] } = {}) {
  if (typeof text !== 'string') throw new TypeError('CSV input must be a string');
  const input = text.replace(/^\uFEFF/u, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const finishField = () => {
    row.push(field);
    field = '';
    closed = false;
  };
  const finishRow = () => {
    finishField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quoted) {
      if (character !== '"') field += character;
      else if (input[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (character === ';') finishField();
    else if (character === '\n' || character === '\r') {
      finishRow();
      if (character === '\r' && input[index + 1] === '\n') index++;
    } else if (character === '"' && !field && !closed) quoted = true;
    else {
      if (closed || character === '"') throw new Error('Malformed quoted CSV field');
      field += character;
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (field || row.length || closed) finishRow();
  if (!rows.length) throw new Error('CSV header is missing');

  const headers = rows.shift().map(value => value.trim());
  if (headers.some(value => !value) || new Set(headers).size !== headers.length) {
    throw new Error('CSV headers must be nonempty and unique');
  }
  for (const column of requiredColumns) {
    if (!headers.includes(column)) throw new Error(`CSV column is missing: ${column}`);
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV record ${index + 2} has ${values.length} fields; expected ${headers.length}`,
      );
    }
    return Object.fromEntries(headers.map((header, position) => [header, values[position]]));
  });
}

function urlKey(value, origin, instructionOnly = false) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('URL is missing');
  const url = new URL(value);
  if (url.origin !== origin || url.username || url.password || url.search || url.hash) {
    throw new Error('URL must use the configured origin without credentials, query or fragment');
  }
  const pathname = url.pathname.replace(/\/+$/u, '') || '/';
  if (instructionOnly && !/^\/instrukciya-po-ohrane-truda\/[^/]+$/u.test(pathname)) {
    throw new Error('URL is not an existing instruction URL');
  }
  decodeURIComponent(pathname);
  return pathname;
}

function addIndex(index, key, value) {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(value);
}

function uniqueDictionary(items, kind, errors) {
  const index = new Map();
  for (const item of items || []) {
    if (!item || typeof item.code !== 'string' || !item.code || !item.name) {
      errors.push({
        code: 'invalid-dictionary-entry',
        source: kind,
        message: 'Code and name are required',
      });
      continue;
    }
    addIndex(index, item.code, item);
  }
  for (const [code, matches] of index) {
    if (matches.length > 1) {
      errors.push({ code: 'duplicate-dictionary-code', source: kind, message: code });
      index.delete(code);
    }
  }
  return new Map([...index].map(([code, matches]) => [code, matches[0]]));
}

function liveIndex(instructions, origin, errors) {
  const addresses = new Map();
  const ids = new Map();
  const invalidRecords = new Set();
  for (const [index, instruction] of instructions.entries()) {
    if (!instruction || typeof instruction.id !== 'string' || !instruction.id) {
      errors.push({
        code: 'invalid-live-record',
        source: 'instructions',
        row: index + 1,
        message: 'ID is required',
      });
      continue;
    }
    addIndex(ids, instruction.id, index);
    if (
      (instruction.tagIds !== undefined &&
        instruction.tagIds !== null &&
        (!Array.isArray(instruction.tagIds) ||
          instruction.tagIds.some(id => typeof id !== 'string'))) ||
      (instruction.primaryCategoryId !== undefined &&
        instruction.primaryCategoryId !== null &&
        typeof instruction.primaryCategoryId !== 'string')
    ) {
      errors.push({
        code: 'invalid-live-taxonomy',
        source: 'instructions',
        row: index + 1,
        message: instruction.id,
      });
      invalidRecords.add(index);
    }
    const aliases = instruction.slugAliases ?? [];
    if (!Array.isArray(aliases) || aliases.some(alias => typeof alias !== 'string' || !alias)) {
      errors.push({
        code: 'invalid-live-aliases',
        source: 'instructions',
        row: index + 1,
        message: instruction.id,
      });
      continue;
    }
    const paths = new Set([
      getInstructionPublicPath(instruction),
      ...[instruction.id, ...aliases].map(slug => getInstructionPublicPath({ slug })),
    ]);
    for (const pathname of paths)
      addIndex(addresses, urlKey(`${origin}${pathname}`, origin), index);
  }
  for (const [id, matches] of ids) {
    if (matches.length > 1) {
      errors.push({ code: 'duplicate-live-id', source: 'instructions', message: id });
      for (const index of matches) invalidRecords.add(index);
    }
  }
  for (const [pathname, matches] of addresses) {
    if (matches.length > 1)
      errors.push({
        code: 'duplicate-live-url',
        source: 'instructions',
        url: `${origin}${pathname}`,
        message: 'Several instructions reserve this URL',
      });
  }
  return { addresses, invalidRecords };
}

export function buildInstructionReclassificationReport({
  importRows,
  manualRows = [],
  changedRows = [],
  dictionary,
  instructions = null,
  origin = 'https://boykovdocs.ru',
}) {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.origin !== origin) throw new Error('Origin must contain only scheme and host');
  if (
    !Array.isArray(importRows) ||
    !Array.isArray(manualRows) ||
    !Array.isArray(changedRows) ||
    !dictionary ||
    (instructions !== null && !Array.isArray(instructions))
  ) {
    throw new TypeError('Import rows, dictionary and optional instruction array are required');
  }
  if (['catalogs', 'sections', 'tags'].some(key => !Array.isArray(dictionary[key]))) {
    throw new TypeError('Dictionary catalogs, sections and tags must be arrays');
  }
  const errors = [];
  const catalogs = uniqueDictionary(dictionary.catalogs, 'catalogs', errors);
  const sections = uniqueDictionary(dictionary.sections, 'sections', errors);
  const tags = uniqueDictionary(dictionary.tags, 'tags', errors);
  const allCodes = new Map();
  for (const [kind, entries] of [
    ['catalogs', catalogs],
    ['sections', sections],
    ['tags', tags],
  ]) {
    for (const code of entries.keys()) addIndex(allCodes, code, kind);
  }
  for (const [code, kinds] of allCodes) {
    if (kinds.length > 1) {
      errors.push({
        code: 'duplicate-dictionary-code',
        source: 'dictionary',
        message: `${code}: ${kinds.join(', ')}`,
      });
      for (const index of [catalogs, sections, tags]) index.delete(code);
    }
  }
  for (const section of sections.values()) {
    if (!catalogs.has(section.catalogCode))
      errors.push({
        code: 'unknown-parent-catalog',
        source: 'dictionary',
        message: `${section.code}: ${section.catalogCode}`,
      });
  }
  const live = instructions === null ? null : liveIndex(instructions, origin, errors);
  const addresses = live?.addresses;
  const dictionaryPaths = new Map();
  for (const item of [...catalogs.values(), ...sections.values(), ...tags.values()]) {
    try {
      const key = urlKey(item.url, origin);
      addIndex(dictionaryPaths, key, item.code);
      if (addresses?.has(key))
        errors.push({
          code: 'dictionary-live-url-conflict',
          source: 'dictionary',
          message: item.code,
          url: item.url,
        });
    } catch (error) {
      errors.push({
        code: 'invalid-dictionary-url',
        source: 'dictionary',
        message: `${item.code}: ${error.message}`,
      });
    }
  }
  for (const [pathname, codes] of dictionaryPaths) {
    if (codes.length > 1)
      errors.push({
        code: 'duplicate-dictionary-url',
        source: 'dictionary',
        url: `${origin}${pathname}`,
        message: codes.join(', '),
      });
  }
  const byUrl = new Map();
  const byId = new Map();
  const records = importRows.map((input, index) => {
    const tagCodes = String(input.tags_ids || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const record = {
      row: index + 2,
      documentId: input.document_id,
      url: input.url,
      proposed: { sectionCode: input.section_id, tagCodes },
      existing: null,
      match: 'not-checked',
      manualReview: /ручн|неоднознач|спорн/iu.test(input.review_status || ''),
      errors: [],
    };
    const fail = (code, message) => record.errors.push({ code, message });
    if (!input.document_id) fail('missing-document-id', 'Registry document_id is required');
    else addIndex(byId, input.document_id, record);
    try {
      const key = urlKey(input.url, origin, true);
      addIndex(byUrl, key, record);
      if (addresses) {
        const matches = addresses.get(key) || [];
        record.match =
          matches.length === 0 ? 'not-found' : matches.length > 1 ? 'ambiguous' : 'matched';
        if (matches.length === 1) {
          const instruction = instructions[matches[0]];
          record.existing = {
            id: instruction.id,
            primaryCategoryId: instruction.primaryCategoryId ?? null,
            tagIds: Object.hasOwn(instruction, 'tagIds') ? structuredClone(instruction.tagIds) : [],
          };
          if (live.invalidRecords.has(matches[0]))
            fail(
              'invalid-live-record',
              'Matched instruction has an invalid or duplicated ID or taxonomy',
            );
        }
      }
    } catch (error) {
      record.match = 'invalid-url';
      fail('invalid-instruction-url', error.message);
    }
    const section = sections.get(input.section_id);
    if (!section) fail('unknown-section', input.section_id || 'Section code is missing');
    else {
      if (input.section_name !== section.name)
        fail('section-name-mismatch', `Expected ${section.name}`);
      const catalog = catalogs.get(section.catalogCode);
      if (!catalog)
        fail('unknown-parent-catalog', section.catalogCode || 'Parent catalog is missing');
      else if (input.catalog !== catalog.name)
        fail('catalog-name-mismatch', `Expected ${catalog.name}`);
    }
    if (new Set(tagCodes).size !== tagCodes.length)
      fail('duplicate-tag-code', 'Tag codes must not repeat');
    for (const code of tagCodes) {
      if (!tags.has(code)) fail('unknown-tag', code);
    }
    if (tagCodes.every(code => tags.has(code))) {
      const expected = tagCodes.map(code => tags.get(code).name).join(', ');
      if (String(input.tags_names || '').trim() !== expected)
        fail('tag-name-mismatch', `Expected ${expected}`);
    }
    return record;
  });
  for (const [kind, index] of [
    ['document-id', byId],
    ['instruction-url', byUrl],
  ]) {
    for (const [key, matches] of index) {
      if (matches.length > 1) {
        for (const record of matches)
          record.errors.push({ code: `duplicate-${kind}`, message: key });
      }
    }
  }

  for (const [source, rows] of [
    ['manual', manualRows],
    ['changed', changedRows],
  ]) {
    const seen = new Set();
    for (const [index, input] of rows.entries()) {
      let key;
      try {
        key = urlKey(input.URL, origin, true);
      } catch (error) {
        errors.push({
          code: 'invalid-reference-url',
          source,
          row: index + 2,
          message: error.message,
        });
        continue;
      }
      const matches = byUrl.get(key) || [];
      if (seen.has(key))
        errors.push({
          code: 'duplicate-reference-url',
          source,
          row: index + 2,
          url: input.URL,
          message: 'URL repeats in this reference file',
        });
      seen.add(key);
      if (matches.length !== 1) {
        errors.push({
          code: 'reference-import-match',
          source,
          row: index + 2,
          url: input.URL,
          message: `Expected one import row; found ${matches.length}`,
        });
      }
      for (const record of matches) {
        if (source === 'manual') record.manualReview = true;
        const section = sections.get(record.proposed.sectionCode);
        if (
          input['Стало ID'] !== record.proposed.sectionCode ||
          input['Стало название'] !== section?.name
        ) {
          const issue = {
            code: 'reference-target-mismatch',
            source,
            row: index + 2,
            url: input.URL,
            message: 'Reference target differs from the authoritative import CSV',
          };
          errors.push(issue);
          record.errors.push(issue);
        }
        if (
          source === 'changed' &&
          Object.hasOwn(input, 'Каталог') &&
          input['Каталог'] !== catalogs.get(section?.catalogCode)?.name
        ) {
          const issue = {
            code: 'reference-catalog-mismatch',
            source,
            row: index + 2,
            url: input.URL,
            message: 'Reference catalog differs from the authoritative import CSV',
          };
          errors.push(issue);
          record.errors.push(issue);
        }
      }
    }
  }
  if (instructions) {
    const targets = new Map();
    for (const record of records) {
      if (record.match === 'matched') addIndex(targets, record.existing.id, record);
    }
    for (const [id, matches] of targets) {
      if (matches.length > 1) {
        for (const record of matches)
          record.errors.push({ code: 'duplicate-live-target', message: id });
      }
    }
  }
  for (const record of records) {
    record.status = record.errors.length
      ? 'source-error'
      : record.manualReview
        ? 'review'
        : record.match === 'not-checked'
          ? 'source-valid'
          : record.match === 'matched'
            ? 'candidate'
            : record.match;
    for (const error of record.errors)
      errors.push({ ...error, source: error.source || 'import', row: record.row, url: record.url });
    if (record.match === 'not-found' || record.match === 'ambiguous')
      errors.push({
        code: `instruction-${record.match}`,
        source: 'instructions',
        row: record.row,
        url: record.url,
        message: 'Expected exactly one live instruction for this URL',
      });
  }
  const count = predicate => records.filter(predicate).length;
  return {
    mode: instructions === null ? 'source-only' : 'snapshot',
    applySupported: false,
    liveDataChecked: instructions !== null,
    counts: {
      rows: records.length,
      professions: count(record => record.proposed.sectionCode?.startsWith('P')),
      work: count(record => record.proposed.sectionCode?.startsWith('W')),
      manualReview: count(record => record.manualReview),
      manualReferenceRows: manualRows.length,
      changedReferenceRows: changedRows.length,
      sourceValid: count(record => !record.errors.length),
      sourceInvalid: count(record => record.errors.length),
      matched: count(record => record.match === 'matched'),
      notFound: count(record => record.match === 'not-found'),
      ambiguous: count(record => record.match === 'ambiguous'),
      unmatchedOrInvalid: count(
        record =>
          record.match === 'not-found' || record.match === 'ambiguous' || record.errors.length,
      ),
      candidates: count(record => record.status === 'candidate'),
    },
    dictionaryIssues: structuredClone(dictionary.issues || []),
    errors,
    records,
  };
}
