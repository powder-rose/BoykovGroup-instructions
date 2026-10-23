import { getInstructionPublicPath } from '../shared/instructionDocument.js';
import { InstructionEditorError } from './instructionEditorError.js';
import { getInstructionTaxonomyAssignmentCatalog } from './instructionTaxonomyAssignmentCatalog.js';
import { instructionTaxonomyBindingStore } from './instructionTaxonomyBindingStore.js';
import { validateInstructionTaxonomyFilters } from './instructionTaxonomyFilterService.js';
import { validateInstructionTaxonomyRegistry } from './instructionTaxonomyRegistryModel.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';

import {
  INSTRUCTION_TAXONOMY_CSV_HEADERS,
  instructionTaxonomyCsvOrigin,
} from './instructionTaxonomyCsvFormat.js';

export { INSTRUCTION_TAXONOMY_CSV_HEADERS };

const HUMAN_FIELDS = new Set([
  'title_from_url_verify',
  'catalog',
  'section_name',
  'tags_names',
  'review_status',
  'notes',
]);

function conflict(message, instructionId) {
  const error = new InstructionEditorError(message, {
    status: 409,
    code: 'TAXONOMY_EXPORT_CONFLICT',
  });
  if (instructionId) error.details = { instructionId };
  return error;
}

function storedText(value, field, id) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw conflict(`Некорректное поле инструкции: ${field}`, id);
  return value;
}

function csvCell(value, humanReadable = false) {
  let text = String(value ?? '');
  const firstCode = text.charCodeAt(0);
  if (humanReadable && (/^ *[=+\-@]/u.test(text) || firstCode < 0x20 || firstCode === 0x7f)) {
    text = `'${text}`;
  }
  return /[;"\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function dateModified(record) {
  const value =
    record.updatedAt ||
    record.modifiedAt ||
    record.createdAt ||
    record.generatedAt ||
    record.uploadedAt ||
    '';
  const result = String(value).slice(0, 10);
  if (result && !/^\d{4}-\d{2}-\d{2}$/u.test(result)) {
    throw conflict('Некорректная сохранённая дата инструкции для экспорта', record.id);
  }
  return result;
}

export function exportInstructionTaxonomyCsv({
  records,
  registry,
  origin = process.env.SITE_URL || 'https://boykovdocs.ru',
  query = '',
  section = '',
  tag = '',
}) {
  validateInstructionTaxonomyRegistry(registry);
  if (!Array.isArray(records)) throw conflict('Некорректный список опубликованных инструкций');
  if (typeof query !== 'string' || query.length > 200) {
    throw new InstructionEditorError('Некорректный поисковый запрос', {
      code: 'INVALID_TAXONOMY_BULK_REQUEST',
    });
  }
  const catalog = getInstructionTaxonomyAssignmentCatalog(registry);
  try {
    validateInstructionTaxonomyFilters({ category: section, tag }, { catalog });
  } catch (cause) {
    throw new InstructionEditorError('Некорректные фильтры раздела или тега', {
      code: 'INVALID_TAXONOMY_BULK_REQUEST',
      cause,
    });
  }
  const base = instructionTaxonomyCsvOrigin(origin, { code: 'TAXONOMY_EXPORT_ORIGIN_ERROR' });
  const sections = new Map(catalog.sections.map(item => [item.id, item]));
  const legacyCategories = new Map(catalog.legacyCategories.map(item => [item.id, item]));
  const catalogs = new Map(catalog.catalogs.map(item => [item.id, item]));
  const tags = new Map([...catalog.legacyTags, ...catalog.tags].map(item => [item.id, item]));
  const ids = new Set();
  const urls = new Set();
  const needle = query.trim().toLocaleLowerCase('ru');
  const rows = [];

  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw conflict('Некорректная опубликованная инструкция');
    }
    if (
      String(record.status || '').toLowerCase() === 'draft' ||
      String(record.seoStatus || '').toLowerCase() === 'draft'
    )
      continue;
    if (typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)) {
      throw conflict('Неоднозначный идентификатор опубликованной инструкции', record.id);
    }
    ids.add(record.id);
    if (record.slug !== undefined && record.slug !== null && typeof record.slug !== 'string') {
      throw conflict('Некорректный текущий URL опубликованной инструкции', record.id);
    }
    const url = `${base}${getInstructionPublicPath(record)}`;
    if (urls.has(url))
      throw conflict('Несколько инструкций используют один текущий URL', record.id);
    urls.add(url);
    if (section && record.primaryCategoryId !== section) continue;
    if (tag && (!Array.isArray(record.tagIds) || !record.tagIds.includes(tag))) continue;
    const title = storedText(record.title, 'title', record.id);
    if (needle && !`${title} ${record.id}`.toLocaleLowerCase('ru').includes(needle)) continue;

    const sectionId = record.primaryCategoryId ?? '';
    const selectedSection = sections.get(sectionId);
    const legacyCategory = legacyCategories.get(sectionId);
    if (typeof sectionId !== 'string' || (sectionId && !selectedSection && !legacyCategory)) {
      throw conflict('Основной раздел инструкции отсутствует в справочнике', record.id);
    }
    const tagIds = record.tagIds ?? [];
    if (
      !Array.isArray(tagIds) ||
      new Set(tagIds).size !== tagIds.length ||
      tagIds.some(id => typeof id !== 'string' || !tags.has(id))
    ) {
      throw conflict('Теги инструкции отсутствуют в справочнике или повторяются', record.id);
    }
    rows.push({
      url,
      title_from_url_verify: title,
      catalog: selectedSection ? catalogs.get(selectedSection.catalogId).label : '',
      section_id: sectionId,
      section_name: selectedSection?.label || legacyCategory?.label || '',
      tags_ids: tagIds.join(','),
      tags_names: tagIds.map(id => tags.get(id).label).join(', '),
      review_status: storedText(record.review_status, 'review_status', record.id),
      lastmod: dateModified(record),
      notes: storedText(record.notes, 'notes', record.id),
    });
  }
  rows.sort((left, right) => (left.url < right.url ? -1 : left.url > right.url ? 1 : 0));
  const lines = [INSTRUCTION_TAXONOMY_CSV_HEADERS.join(';')];
  for (const [index, row] of rows.entries()) {
    lines.push(
      INSTRUCTION_TAXONOMY_CSV_HEADERS.map(field =>
        csvCell(field === 'document_id' ? index + 1 : row[field], HUMAN_FIELDS.has(field)),
      ).join(';'),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function createInstructionTaxonomyCsvExporter({
  store = instructionTaxonomyBindingStore,
  registryRepository = instructionTaxonomyRegistryRepository,
  origin,
} = {}) {
  return (filters = {}) =>
    registryRepository.withLock(
      (registry, assertHeld) => {
        const records = store
          .read()
          .filter(snapshot => snapshot.version === 'published')
          .map(snapshot => snapshot.record);
        assertHeld();
        const csv = exportInstructionTaxonomyCsv({
          records,
          registry,
          origin,
          query: filters.query,
          section: filters.section,
          tag: filters.tag,
        });
        assertHeld();
        return csv;
      },
      { waitMs: 1000 },
    );
}

export const instructionTaxonomyCsvExport = createInstructionTaxonomyCsvExporter();
