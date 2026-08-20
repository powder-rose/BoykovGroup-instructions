const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...headers },
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

/** Вход администратора по логину и паролю. Возвращает { token, user }. */
export function login(loginValue, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginValue, password }),
  });
}

/** Проверяет сохранённый токен и возвращает данные текущего пользователя. */
export function fetchMe(token) {
  return request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}