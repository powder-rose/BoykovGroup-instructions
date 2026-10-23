import { InstructionEditorError } from './instructionEditorError.js';

export const INSTRUCTION_TAXONOMY_CSV_HEADERS = [
  'document_id',
  'url',
  'title_from_url_verify',
  'catalog',
  'section_id',
  'section_name',
  'tags_ids',
  'tags_names',
  'review_status',
  'lastmod',
  'notes',
];

export function instructionTaxonomyCsvOrigin(value, { code = 'TAXONOMY_CSV_ORIGIN_ERROR' } = {}) {
  const input = String(value || '').trim();
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    // Configuration errors share the explicit failure below.
  }
  if (
    !parsed ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/' ||
    /[\s\\?#]/u.test(input)
  ) {
    throw new InstructionEditorError('Для CSV нужен корректный адрес сайта HTTP или HTTPS', {
      status: 500,
      code,
    });
  }
  return parsed.origin;
}
