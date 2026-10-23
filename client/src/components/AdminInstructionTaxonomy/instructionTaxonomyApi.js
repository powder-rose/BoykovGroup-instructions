const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/instruction-taxonomy`;

async function request(token, path = '', options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? 'Административная сессия завершилась. Войдите снова. Изменения в открытой форме пока не сохранены.'
        : data.message || data.error || `Ошибка запроса (${response.status})`,
    );
    error.status = response.status;
    error.code = data.code;
    error.details = data.details;
    throw error;
  }
  return data;
}

function entityPath(kind, code) {
  return `/${encodeURIComponent(kind)}/${encodeURIComponent(code)}`;
}

export function fetchInstructionTaxonomyRegistry(token) {
  return request(token);
}

export function fetchInstructionTaxonomyUsage(token, kind, code) {
  return request(token, `${entityPath(kind, code)}/usage`);
}

export function createInstructionTaxonomyEntity(token, kind, entity, expectedRevision) {
  return request(token, `/${encodeURIComponent(kind)}`, {
    method: 'POST',
    body: JSON.stringify({ entity, expectedRevision }),
  });
}

export function updateInstructionTaxonomyEntity(token, kind, code, patch, expectedRevision) {
  return request(token, entityPath(kind, code), {
    method: 'PUT',
    body: JSON.stringify({ patch, expectedRevision }),
  });
}

export function deleteInstructionTaxonomyEntity(token, kind, code, expectedRevision) {
  return request(token, entityPath(kind, code), {
    method: 'DELETE',
    body: JSON.stringify({ expectedRevision }),
  });
}
