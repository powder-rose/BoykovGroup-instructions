const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/instructions`;

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
      response.status === 401 || response.status === 403
        ? 'Административная сессия завершилась. Войдите снова; локальный черновик сохранён.'
        : data.message || data.error || `Ошибка запроса (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = data.code;
    error.details = data.details;
    throw error;
  }
  return data;
}

export function fetchEditorInstructions(token) {
  return request(token);
}
export function fetchInstructionTaxonomy(token) {
  return request(token, '/taxonomy');
}
export function fetchInstructionAssignmentTaxonomy(token) {
  return request(token, '/assignment-taxonomy');
}
export function fetchEditorInstruction(token, id) {
  return request(token, `/${encodeURIComponent(id)}`);
}
export function saveEditorInstruction(token, form, record) {
  return request(token, record?.id ? `/${encodeURIComponent(record.id)}` : '', {
    method: record?.id ? 'PUT' : 'POST',
    body: JSON.stringify({ ...form, ...(record?.id ? { revision: record.revision } : {}) }),
  });
}
export function deleteEditorInstruction(token, record) {
  return request(token, `/${encodeURIComponent(record.id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ revision: record.revision }),
  });
}
export function discardEditorDraft(token, record) {
  return request(token, `/${encodeURIComponent(record.id)}/draft`, {
    method: 'DELETE',
    body: JSON.stringify({ revision: record.revision }),
  });
}
export function unpublishEditorInstruction(token, record) {
  return request(token, `/${encodeURIComponent(record.id)}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({ revision: record.revision }),
  });
}
