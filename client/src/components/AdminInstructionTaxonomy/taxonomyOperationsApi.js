import { MAX_TAXONOMY_CSV_BYTES } from './taxonomyImportReport.js';

const API_ROOT = `${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/instruction-taxonomy-operations`;

async function request(token, path, options = {}, blob = false) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  if (response.ok && blob) return response.blob();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? 'Административная сессия завершилась. Войдите снова. Выбор на экране пока не применён.'
        : data.message || data.error || `Ошибка запроса (${response.status})`,
    );
    error.status = response.status;
    error.code = data.code;
    error.details = data.details;
    throw error;
  }
  return data;
}

function queryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== '' && value !== undefined && value !== null) params.set(key, String(value));
  }
  return params.toString();
}

export function fetchTaxonomyBindings(token, filters) {
  return request(token, `/bindings?${queryString(filters)}`);
}

export function fetchTaxonomyOperationHistory(token, page, pageSize) {
  return request(token, `/history?${queryString({ page, pageSize })}`);
}

export function fetchTaxonomyOperationStatus(token) {
  return request(token, '/status');
}

export function previewTaxonomyOperation(token, input) {
  return request(token, '/preview', { method: 'POST', body: JSON.stringify(input) });
}

export async function previewTaxonomyCsvImport(token, file, input) {
  if (!file || !file.size || file.size > MAX_TAXONOMY_CSV_BYTES) {
    throw new Error('Выберите непустой CSV-файл размером не больше 4 МиБ.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_TAXONOMY_CSV_BYTES) {
    throw new Error('Выберите непустой CSV-файл размером не больше 4 МиБ.');
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return request(token, '/import-preview', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      csvBase64: btoa(binary),
      registryRevision: input.registryRevision,
      includeDrafts: input.includeDrafts,
      tagMode: input.tagMode,
      replaceConfirmed: input.replaceConfirmed,
    }),
  });
}

export function applyTaxonomyOperation(token, previewId) {
  return request(token, '/apply', {
    method: 'POST',
    body: JSON.stringify({ previewId, confirmed: true }),
  });
}

export function previewTaxonomyRollback(token, operationId) {
  return request(token, `/history/${encodeURIComponent(operationId)}/rollback-preview`, {
    method: 'POST',
  });
}

export function recoverTaxonomyOperation(token, operationId) {
  return request(token, '/recover', {
    method: 'POST',
    body: JSON.stringify({ operationId, confirmed: true }),
  });
}

export function exportPublishedTaxonomyAssignments(token) {
  return request(token, '/export', {}, true);
}

export function downloadTaxonomyFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
