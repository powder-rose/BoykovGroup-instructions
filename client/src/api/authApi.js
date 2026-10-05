const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

async function request(
  path,
  options = {}
) {
  const {
    headers,
    ...rest
  } = options;

  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        headers: {
          "Content-Type":
            "application/json",
          ...headers
        },
        ...rest
      }
    );

  if (!response.ok) {
    let message =
      `Ошибка запроса (${response.status})`;

    try {
      const data =
        await response.json();

      if (data?.error) {
        message =
          data.error;
      }
    } catch {
      // Оставляем стандартное сообщение.
    }

    throw new Error(
      message
    );
  }

  if (
    response.status === 204
  ) {
    return null;
  }

  return response.json();
}


/*
 * Вход:
 * - администратор — по существующему логину;
 * - пользователь — по email.
 */
export function login(
  loginValue,
  password
) {
  return request(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        login:
          loginValue,
        password
      })
    }
  );
}


/*
 * Регистрация обычного пользователя.
 */
export function register({
  name,
  phone,
  email,
  password,
  userAgreementAccepted,
  personalDataConsentAccepted,
  advertisingConsentAccepted
}) {
  return request(
    "/api/auth/register",
    {
      method: "POST",

      body:
        JSON.stringify({
          name,
          phone,
          email,
          password,
          userAgreementAccepted,
          personalDataConsentAccepted,
          advertisingConsentAccepted
        })
    }
  );
}


/*
 * Проверка сохранённого JWT.
 */
export function fetchMe(
  token
) {
  return request(
    "/api/auth/me",
    {
      headers: {
        Authorization:
          `Bearer ${token}`
      }
    }
  );
}
