const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/articles`;

async function request(token, path = '', options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      response.status === 409 && data.code === 'ARTICLE_REVISION_CONFLICT'
        ? 'Статья уже изменена в другой вкладке. Скопируйте нужные изменения и откройте её заново.'
        : response.status === 401 || response.status === 403
          ? 'Административная сессия завершилась. Войдите снова; локальный черновик сохранён.'
          : data.message || data.error || `Ошибка запроса (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export function fetchAdminArticles(token) {
  return request(token);
}

export function fetchAdminArticle(token, id) {
  return request(token, `/${encodeURIComponent(id)}`);
}

export function saveAdminArticle(token, article, record) {
  return request(token, record?.id ? `/${encodeURIComponent(record.id)}` : '', {
    method: record?.id ? 'PUT' : 'POST',
    body: JSON.stringify({ ...article, ...(record?.id ? { revision: record.revision } : {}) }),
  });
}

export function removeAdminArticle(token, article) {
  return request(token, `/${encodeURIComponent(article.id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ revision: article.revision }),
  });
}
