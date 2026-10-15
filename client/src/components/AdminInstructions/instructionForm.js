import { getInstructionDocument } from '../../../../server/src/shared/instructionDocument.js';

export const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] };

export function instructionToForm(instruction = {}) {
  return {
    title: instruction.title || '',
    slug: instruction.slug || instruction.id || '',
    webIntro: instruction.webIntro || '',
    instructionContent: getInstructionDocument(instruction),
    explanationContent: instruction.explanationContent || EMPTY_DOCUMENT,
    seoTitle: instruction.seoTitle || '',
    seoDescription: instruction.seoDescription || '',
  };
}

export function getDraftKey(identity, id) {
  return `boykovdocs-instruction-draft:${encodeURIComponent(identity)}:${id || 'new'}`;
}
export function readInstructionDraft(key) {
  try {
    const draft = JSON.parse(window.localStorage.getItem(key));
    if (
      !draft?.form ||
      typeof draft.form.title !== 'string' ||
      draft.form.instructionContent?.type !== 'doc'
    )
      return null;
    return draft;
  } catch {
    return null;
  }
}
export function removeInstructionDraft(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Server saving remains available when browser storage is unavailable.
  }
}
export function validateInstructionForm(form, status, originalSlug = '') {
  if (!form.title.trim()) return 'Укажите заголовок инструкции.';
  if (form.slug && form.slug !== originalSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug))
    return 'В URL используйте строчные латинские буквы, цифры и дефисы.';
  if (status === 'published' && (!form.seoTitle.trim() || !form.seoDescription.trim()))
    return 'Для публикации заполните SEO Title и SEO Description.';
  return '';
}
