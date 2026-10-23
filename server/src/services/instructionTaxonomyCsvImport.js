import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

import { getInstructionPublicPath } from '../shared/instructionDocument.js';
import { InstructionEditorError } from './instructionEditorError.js';
import {
  buildReclassificationLiveIndex,
  getReclassificationUrlKey,
  parseReclassificationCsv,
} from './instructionReclassificationPreflight.js';
import { validateInstructionTaxonomyAssignment } from './instructionTaxonomyAssignmentCatalog.js';
import {
  INSTRUCTION_TAXONOMY_CSV_HEADERS,
  instructionTaxonomyCsvOrigin,
} from './instructionTaxonomyCsvFormat.js';
import { validateInstructionTaxonomyRegistry } from './instructionTaxonomyRegistryModel.js';
import { getInstructionTaxonomyReviewSource } from './instructionTaxonomyReviewSource.js';

export const MAX_INSTRUCTION_TAXONOMY_CSV_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 5000;
const SOURCE_PRELIMINARY_STATUS = 'Предварительно классифицировано по смыслу заголовка';

function requiresReview(status) {
  return status !== '' && status !== SOURCE_PRELIMINARY_STATUS;
}

function invalid(message, cause) {
  return new InstructionEditorError(message, {
    code: 'INVALID_TAXONOMY_CSV_IMPORT',
    cause,
  });
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function publishedRecords(snapshots) {
  if (!Array.isArray(snapshots)) throw invalid('Передайте снимки инструкций для CSV');
  return snapshots
    .filter(snapshot => snapshot.version === 'published')
    .map(snapshot => snapshot.record)
    .filter(
      record =>
        String(record?.status || '').toLowerCase() !== 'draft' &&
        String(record?.seoStatus || '').toLowerCase() !== 'draft',
    );
}

function checkedRecords(snapshots) {
  const records = publishedRecords(snapshots);
  for (const record of records) {
    if (
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      typeof record.id !== 'string' ||
      !record.id.trim() ||
      (record.slug !== undefined && record.slug !== null && typeof record.slug !== 'string') ||
      (record.slugAliases !== undefined &&
        record.slugAliases !== null &&
        (!Array.isArray(record.slugAliases) ||
          record.slugAliases.some(alias => typeof alias !== 'string' || !alias.trim())))
    ) {
      throw new InstructionEditorError('Не удалось однозначно проверить текущие URL инструкций', {
        code: 'TAXONOMY_CSV_LIVE_CONFLICT',
        status: 409,
      });
    }
  }
  return records;
}

export function fingerprintInstructionTaxonomyImportAddresses(
  snapshots,
  { origin = process.env.SITE_URL || 'https://boykovdocs.ru' } = {},
) {
  const base = instructionTaxonomyCsvOrigin(origin);
  const records = checkedRecords(snapshots)
    .map(record => ({
      id: record.id,
      currentUrl: getInstructionPublicPath(record),
      status: String(record.status || '').toLowerCase(),
      seoStatus: String(record.seoStatus || '').toLowerCase(),
      addresses: [...new Set([record.slug || record.id, record.id, ...(record.slugAliases ?? [])])]
        .map(slug =>
          getReclassificationUrlKey(`${base}${getInstructionPublicPath({ slug })}`, base, true),
        )
        .sort(),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return hash(Buffer.from(JSON.stringify({ origin: base, records }), 'utf8'));
}

function csvRows(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    !bytes.length ||
    bytes.length > MAX_INSTRUCTION_TAXONOMY_CSV_BYTES
  ) {
    throw invalid('CSV должен быть непустым файлом размером не более 4 МиБ');
  }
  if (bytes[0] !== 0xef || bytes[1] !== 0xbb || bytes[2] !== 0xbf) {
    throw invalid('CSV должен иметь кодировку UTF-8 с BOM');
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const rows = parseReclassificationCsv(text, {
      requiredColumns: INSTRUCTION_TAXONOMY_CSV_HEADERS,
      allowedColumns: INSTRUCTION_TAXONOMY_CSV_HEADERS,
    });
    if (!rows.length || rows.length > MAX_ROWS)
      throw new Error('CSV must contain between 1 and 5000 records');
    return rows;
  } catch (cause) {
    throw invalid(`Не удалось прочитать CSV: ${cause.message}`, cause);
  }
}

function add(index, key, value) {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(value);
}

function sourceReviewIndex(manualReferences, live, instructions) {
  if (!Array.isArray(manualReferences))
    throw invalid('Не удалось прочитать список ручной проверки');
  const byUrl = new Map();
  const byId = new Map();
  for (const reference of manualReferences) {
    let key;
    try {
      const sourceOrigin = instructionTaxonomyCsvOrigin(new URL(reference.url).origin);
      key = getReclassificationUrlKey(reference.url, sourceOrigin, true);
    } catch (cause) {
      throw new InstructionEditorError(
        'Исходный список ручной проверки содержит некорректный URL',
        {
          code: 'TAXONOMY_CSV_REVIEW_SOURCE_ERROR',
          status: 500,
          cause,
        },
      );
    }
    const reason = reference.reason || 'Запись включена в исходный список ручной проверки';
    add(byUrl, key, reason);
    for (const index of live.addresses.get(key) ?? []) add(byId, instructions[index].id, reason);
  }
  return { byUrl, byId };
}

export function buildInstructionTaxonomyCsvImport({
  bytes,
  fileName,
  registry,
  snapshots,
  tagMode = 'add',
  origin = process.env.SITE_URL || 'https://boykovdocs.ru',
  manualReferences = getInstructionTaxonomyReviewSource().records,
}) {
  if (
    typeof fileName !== 'string' ||
    !fileName.trim() ||
    fileName.length > 200 ||
    /[\\/]/u.test(fileName) ||
    [...fileName].some(
      character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
    )
  ) {
    throw invalid('Передайте имя CSV без пути и управляющих символов');
  }
  if (!['add', 'replace'].includes(tagMode))
    throw invalid('Выберите режим добавления или замены тегов');
  validateInstructionTaxonomyRegistry(registry);
  const base = instructionTaxonomyCsvOrigin(origin);
  const rows = csvRows(bytes);
  const instructions = checkedRecords(snapshots);
  const liveErrors = [];
  const live = buildReclassificationLiveIndex(instructions, base, liveErrors);
  const review = sourceReviewIndex(manualReferences, live, instructions);
  const sections = new Map(registry.sections.map(section => [section.code, section]));
  const catalogs = new Map(registry.catalogs.map(catalog => [catalog.code, catalog]));
  const tags = new Map(registry.tags.map(tag => [tag.code, tag]));
  const byDocumentId = new Map();
  const byUrl = new Map();
  const byTarget = new Map();
  const unknownSectionIds = new Set();
  const unknownTagIds = new Set();
  const versions = new Map();
  for (const snapshot of snapshots) add(versions, snapshot.id, snapshot);
  const records = rows.map((input, index) => {
    const rawTags = input.tags_ids.trim();
    const tagIds = rawTags
      ? rawTags
          .split(',')
          .map(value => value.trim())
          .filter(Boolean)
      : [];
    const record = {
      row: index + 2,
      documentId: input.document_id,
      url: input.url,
      titleFromUrlVerify: input.title_from_url_verify,
      existingId: null,
      currentUrl: null,
      match: 'not-found',
      status: 'not-found',
      manualReview: requiresReview(input.review_status),
      reviewReasons: requiresReview(input.review_status) ? [input.review_status] : [],
      proposed: { sectionId: input.section_id, tagIds },
      errors: [],
    };
    const fail = (code, message) => record.errors.push({ code, message });
    if (!input.document_id.trim())
      fail('missing-document-id', 'Не указан порядковый номер строки реестра');
    else add(byDocumentId, input.document_id, record);
    let key;
    try {
      if (
        input.url !== input.url.trim() ||
        [...input.url].some(
          character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
        )
      )
        throw new Error('URL contains whitespace or control characters');
      key = getReclassificationUrlKey(input.url, base, true);
      add(byUrl, key, record);
      const matches = live.addresses.get(key) ?? [];
      record.match =
        matches.length === 0 ? 'not-found' : matches.length > 1 ? 'ambiguous' : 'matched';
      if (matches.length === 1) {
        const instruction = instructions[matches[0]];
        record.existingId = instruction.id;
        record.currentUrl = `${base}${getInstructionPublicPath(instruction)}`;
        add(byTarget, instruction.id, record);
        if (live.invalidRecords.has(matches[0]))
          fail(
            'invalid-current-assignment',
            'Текущая запись содержит неоднозначный ID или некорректные назначения',
          );
        for (const snapshot of versions.get(instruction.id) ?? []) {
          try {
            validateInstructionTaxonomyAssignment(
              {
                primaryCategoryId: snapshot.record.primaryCategoryId ?? null,
                tagIds: snapshot.record.tagIds ?? [],
              },
              { registry },
            );
            const revision = snapshot.record.revision ?? 0;
            if (
              !Number.isSafeInteger(revision) ||
              revision < 0 ||
              revision === Number.MAX_SAFE_INTEGER
            )
              throw new Error('Invalid revision');
          } catch {
            fail(
              'invalid-current-assignment',
              `Некорректные назначения или ревизия версии ${snapshot.version}`,
            );
          }
        }
      } else
        fail(
          `instruction-${record.match}`,
          'По URL должна находиться ровно одна опубликованная инструкция',
        );
    } catch (cause) {
      record.match = 'invalid-url';
      fail('invalid-instruction-url', cause.message);
    }
    const reasons = [
      ...(review.byUrl.get(key) ?? []),
      ...(review.byId.get(record.existingId) ?? []),
    ];
    if (reasons.length) record.manualReview = true;
    record.reviewReasons = [...new Set([...record.reviewReasons, ...reasons])];
    const section = sections.get(input.section_id);
    if (!section) {
      fail('unknown-section', input.section_id || 'Не указан раздел');
      if (input.section_id) unknownSectionIds.add(input.section_id);
    } else {
      if (input.section_name !== section.name)
        fail('section-name-mismatch', `Ожидается: ${section.name}`);
      const catalog = catalogs.get(section.parentCode);
      if (!catalog || input.catalog !== catalog.name)
        fail('catalog-name-mismatch', `Ожидается: ${catalog?.name || section.parentCode}`);
    }
    if (rawTags && rawTags.split(',').some(value => !value.trim()))
      fail('invalid-tag-list', 'Список тегов содержит пустое значение');
    if (new Set(tagIds).size !== tagIds.length)
      fail('duplicate-tag-code', 'Коды тегов не должны повторяться');
    for (const id of tagIds)
      if (!tags.has(id)) {
        unknownTagIds.add(id);
        fail('unknown-tag', id);
      }
    if (tagIds.every(id => tags.has(id))) {
      const expected = tagIds.map(id => tags.get(id).name).join(', ');
      if (input.tags_names.trim() !== expected) fail('tag-name-mismatch', `Ожидается: ${expected}`);
    }
    return record;
  });
  for (const [kind, values] of [
    ['document-id', byDocumentId],
    ['instruction-url', byUrl],
    ['live-target', byTarget],
  ]) {
    for (const [value, matches] of values)
      if (matches.length > 1) {
        for (const record of matches)
          record.errors.push({ code: `duplicate-${kind}`, message: value });
      }
  }
  for (const record of records) {
    record.status =
      record.match !== 'matched'
        ? record.match
        : record.errors.length
          ? 'source-error'
          : record.manualReview
            ? 'review'
            : 'candidate';
  }
  const eligible = records.filter(record => record.status === 'candidate');
  const unknownSections = [...unknownSectionIds].sort();
  const unknownTags = [...unknownTagIds].sort();
  return {
    report: {
      file: { name: fileName, sha256: hash(bytes), bytes: bytes.length },
      tagMode,
      registryRevision: registry.revision,
      unknownSectionIds: unknownSections,
      unknownTagIds: unknownTags,
      counts: {
        rows: records.length,
        matched: records.filter(record => record.match === 'matched').length,
        notFound: records.filter(record => record.match === 'not-found').length,
        ambiguous: records.filter(record => record.match === 'ambiguous').length,
        invalidUrl: records.filter(record => record.match === 'invalid-url').length,
        manualReview: records.filter(record => record.manualReview).length,
        sourceInvalid: records.filter(record => record.errors.length > 0).length,
        unknownSections: unknownSections.length,
        unknownTags: unknownTags.length,
        eligibleRows: eligible.length,
        selectedDocuments: eligible.length,
        skippedRows: records.length - eligible.length,
      },
      records,
    },
    assignments: eligible.map(record => ({
      id: record.existingId,
      sectionId: record.proposed.sectionId,
      tagIds: [...record.proposed.tagIds],
    })),
  };
}
