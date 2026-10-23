const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || ''}/api/instruction-taxonomy`;

async function request(path, { signal } = {}) {
  const response = await fetch(`${API_ROOT}${path}`, { signal, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'Не удалось загрузить структуру инструкций.');
    error.status = response.status;
    throw error;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Не удалось загрузить структуру инструкций.');
  }
  return data;
}

function invalidResponse() {
  return new Error('Не удалось загрузить структуру инструкций.');
}

function localPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

function seo(value) {
  if (
    !value ||
    !['title', 'description', 'canonicalUrl', 'robots'].every(key => typeof value[key] === 'string')
  )
    return false;
  try {
    return ['http:', 'https:'].includes(new URL(value.canonicalUrl).protocol);
  } catch {
    return false;
  }
}

function navigationItem(item) {
  return (
    item &&
    typeof item.code === 'string' &&
    typeof item.name === 'string' &&
    localPath(item.path) &&
    Number.isSafeInteger(item.count) &&
    item.count >= 0
  );
}

function siteUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === value;
  } catch {
    return false;
  }
}

export async function fetchTaxonomyNavigation(options) {
  const data = await request('/navigation', options);
  if (
    !Array.isArray(data.catalogs) ||
    !Array.isArray(data.tags) ||
    data.catalogs.some(
      item =>
        !navigationItem(item) ||
        !Array.isArray(item.sections) ||
        !item.sections.every(navigationItem),
    ) ||
    !data.tags.every(navigationItem) ||
    (data.root !== null &&
      (!data.root ||
        typeof data.root.h1 !== 'string' ||
        !localPath(data.root.path) ||
        !seo(data.root.seo) ||
        !siteUrl(data.root.siteUrl)))
  )
    throw invalidResponse();
  return data;
}

export async function fetchTaxonomyPage(pathname, search, options) {
  const params = new URLSearchParams({ path: pathname });
  for (const [key, value] of new URLSearchParams(search)) params.append(key, value);
  const data = await request(`/page?${params}`, options);
  if (Object.hasOwn(data, 'redirect')) {
    if (!localPath(data.redirect)) throw invalidResponse();
    return data;
  }
  if (
    !localPath(data.path) ||
    !siteUrl(data.siteUrl) ||
    typeof data.h1 !== 'string' ||
    !seo(data.seo) ||
    typeof data.query !== 'string' ||
    !['title', 'newest'].includes(data.sort) ||
    ![data.total, data.page, data.pageSize, data.totalPages].every(Number.isSafeInteger) ||
    data.total < 0 ||
    data.page < 1 ||
    data.totalPages < 1 ||
    data.pageSize !== 24 ||
    !Array.isArray(data.breadcrumbs) ||
    data.breadcrumbs.some(
      item =>
        !item || typeof item.name !== 'string' || (item.path !== null && !localPath(item.path)),
    ) ||
    !Array.isArray(data.sections) ||
    !data.sections.every(navigationItem) ||
    !Array.isArray(data.items) ||
    data.items.some(
      item => !item || typeof item.id !== 'string' || typeof item.title !== 'string',
    ) ||
    !Array.isArray(data.pagination) ||
    data.pagination.some(
      item => !item || !Number.isSafeInteger(item.page) || !localPath(item.path),
    ) ||
    (data.previousPath !== null && !localPath(data.previousPath)) ||
    (data.nextPath !== null && !localPath(data.nextPath))
  )
    throw invalidResponse();
  return data;
}
