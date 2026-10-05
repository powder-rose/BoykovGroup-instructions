const API_ROOT =
  "/api/promo-codes/admin";


async function request(
  path,
  token,
  options = {}
) {

  if (!token) {

    throw new Error(
      "Нет административной сессии."
    );

  }


  const headers =
    new Headers(
      options.headers || {}
    );


  headers.set(
    "Authorization",
    `Bearer ${token}`
  );


  if (
    options.body &&
    !headers.has(
      "Content-Type"
    )
  ) {

    headers.set(
      "Content-Type",
      "application/json"
    );

  }


  const response =
    await fetch(
      path,
      {
        ...options,

        headers,

        cache:
          "no-store"
      }
    );


  const data =
    await response
      .json()
      .catch(
        () => ({})
      );


  if (!response.ok) {

    throw new Error(
      data?.error ||
      `Ошибка запроса (${response.status})`
    );

  }


  return data;

}


export function getPromoCodes(
  token
) {

  return request(
    API_ROOT,
    token
  );

}


export function createPromoCode(
  payload,
  token
) {

  return request(
    API_ROOT,
    token,
    {
      method:
        "POST",

      body:
        JSON.stringify(
          payload
        )
    }
  );

}


export function updatePromoCode(
  id,
  payload,
  token
) {

  return request(
    `${API_ROOT}/${encodeURIComponent(id)}`,
    token,
    {
      method:
        "PATCH",

      body:
        JSON.stringify(
          payload
        )
    }
  );

}


export function deletePromoCode(
  id,
  token
) {

  return request(
    `${API_ROOT}/${encodeURIComponent(id)}`,
    token,
    {
      method:
        "DELETE"
    }
  );

}
