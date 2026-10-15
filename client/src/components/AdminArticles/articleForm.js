export function articleToForm(article = {}) {
  return {
    title: article.title || '',
    slug: article.slug || '',
    excerpt: article.excerpt || '',
    seoTitle: article.seoTitle || '',
    seoDescription: article.seoDescription || '',
    status: article.status || 'draft',
    content: article.content || { type: 'doc', content: [{ type: 'paragraph' }] },
  };
}

export function getDraftKey(identity, id) {
  return `boykovdocs-article-draft:${encodeURIComponent(identity)}:${id || 'new'}`;
}

export function readArticleDraft(key) {
  try {
    const draft = JSON.parse(window.localStorage.getItem(key));
    if (!draft?.form || typeof draft.form.title !== 'string' || draft.form.content?.type !== 'doc')
      return null;
    return draft;
  } catch {
    return null;
  }
}

export function removeArticleDraft(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Saving to the server remains possible when browser storage is unavailable.
  }
}

export function validateArticleForm(form, status) {
  if (!form.title.trim()) return 'Укажите заголовок статьи.';
  if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    return 'В URL используйте строчные латинские буквы, цифры и дефисы.';
  }
  if (status === 'published' && (!form.seoTitle.trim() || !form.seoDescription.trim())) {
    return 'Для публикации заполните SEO Title и SEO Description.';
  }
  return '';
}
