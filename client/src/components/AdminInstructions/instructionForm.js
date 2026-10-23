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
    seoReady: instruction.editorialMeta?.seoReady === true,
    seoAuthor: instruction.editorialMeta?.seoAuthor || '',
    contentAuthor: instruction.editorialMeta?.contentAuthor || '',
    primaryCategoryId: instruction.primaryCategoryId ?? null,
    tagIds: Array.isArray(instruction.tagIds) ? [...instruction.tagIds] : [],
    taxonomyPatch: {},
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
export function validateInstructionForm(
  form,
  status,
  originalSlug = '',
  { requireSection = false, taxonomy = null } = {},
) {
  if (!form.title.trim()) return 'Укажите заголовок инструкции.';
  if (form.slug && form.slug !== originalSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug))
    return 'В URL используйте строчные латинские буквы, цифры и дефисы.';
  if (status === 'published' && (!form.seoTitle.trim() || !form.seoDescription.trim()))
    return 'Для публикации заполните SEO Title и SEO Description.';
  const patch = form.taxonomyPatch || {};
  const hasTaxonomyChanges = Boolean(patch.category || patch.tags);
  if ((requireSection || hasTaxonomyChanges) && !taxonomy)
    return 'Загрузите справочник разделов и тегов перед сохранением.';
  if (patch.category?.mode === 'manual' && patch.category.id !== form.primaryCategoryId)
    return 'Повторно выберите основной тематический раздел: данные локального черновика расходятся.';
  if (
    (requireSection || patch.category?.mode === 'manual') &&
    (!taxonomy.sections.some(section => section.id === form.primaryCategoryId) ||
      (requireSection && patch.category?.mode !== 'manual'))
  )
    return 'Выберите один основной тематический раздел из нового справочника.';
  if (patch.tags?.mode === 'manual') {
    if (JSON.stringify(patch.tags.ids) !== JSON.stringify(form.tagIds))
      return 'Повторно выберите теги: данные локального черновика расходятся.';
    const knownTags = new Set([...taxonomy.tags, ...taxonomy.legacyTags].map(tag => tag.id));
    if (form.tagIds.some(id => !knownTags.has(id)))
      return 'В выбранных тегах есть недоступные значения. Удалите или замените их вручную.';
  }
  if (hasTaxonomyChanges && patch.registryRevision !== taxonomy.revision)
    return 'Справочник обновился. Проверьте раздел и теги, затем подтвердите выбор по обновлённому справочнику.';
  return '';
}
