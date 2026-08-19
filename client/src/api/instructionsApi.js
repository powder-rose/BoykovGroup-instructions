const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  // Для FormData (загрузка файла) Content-Type нельзя проставлять вручную —
  // fetch сам должен посчитать multipart-границу (boundary).
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: isFormData ? { ...headers } : { "Content-Type": "application/json", ...headers },
    ...rest,
  });

  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // тело ответа могло быть пустым — оставляем сообщение по умолчанию
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Поиск инструкций — вся логика поиска выполняется на сервере,
 * клиент лишь передаёт текст запроса и номер страницы.
 */
export function searchInstructions({ query = "", page = 1, pageSize = 6 } = {}) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    pageSize: String(pageSize),
  });
  return request(`/api/instructions?${params.toString()}`);
}

export function getInstruction(id) {
  return request(`/api/instructions/${encodeURIComponent(id)}`);
}

/** Просит сервер сгенерировать недостающую инструкцию через YandexGPT. Только для админа. */
export function generateInstruction(profession, token) {
  return request(`/api/instructions/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ profession }),
  });
}

/**
 * Загружает собственную инструкцию админа — файлом (pdf/docx/txt/md) или
 * текстом вручную. formData должен содержать поля title, profession и
 * либо file, либо content. Только для админа.
 */
export function uploadInstruction(formData, token) {
  return request(`/api/instructions/upload`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

/** Удаляет инструкцию. Только для админа. */
export function deleteInstruction(id, token) {
  return request(`/api/instructions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
