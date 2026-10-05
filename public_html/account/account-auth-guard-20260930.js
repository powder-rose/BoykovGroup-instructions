(() => {

  "use strict";


  const TOKEN_KEY =
    "boykovgroup_auth_token";


  const AUTH_URL =
    "/?auth=1&next=%2Faccount%2F";


  /*
   * Не показываем кабинет,
   * пока не проверили авторизацию.
   */
  document.documentElement.style.visibility =
    "hidden";


  function redirectToLogin() {

    window.location.replace(
      AUTH_URL
    );

  }


  function clearUserAuth() {

    try {

      localStorage.removeItem(
        TOKEN_KEY
      );


      if (
        sessionStorage.getItem(
          "boykovgroup_active_auth_role"
        ) === "user"
      ) {

        sessionStorage.removeItem(
          "boykovgroup_active_auth_role"
        );

      }

    }
    catch {
      /* no-op */
    }

  }


  let token = null;


  try {

    token =
      localStorage.getItem(
        TOKEN_KEY
      );

  }
  catch {

    redirectToLogin();
    return;

  }


  /*
   * Вообще нет пользовательской авторизации.
   */
  if (!token) {

    redirectToLogin();
    return;

  }


  fetch(
    "/api/auth/me",
    {
      headers: {
        Authorization:
          `Bearer ${token}`
      },

      cache:
        "no-store"
    }
  )
    .then(
      async response => {

        if (!response.ok) {

          const error =
            new Error(
              "AUTH_INVALID"
            );

          error.authInvalid =
            true;

          throw error;

        }


        const data =
          await response.json();


        if (
          data?.user?.role !==
          "user"
        ) {

          const error =
            new Error(
              "NOT_USER"
            );

          error.authInvalid =
            true;

          throw error;

        }


        /*
         * Всё хорошо.
         * Теперь разрешаем показать страницу.
         */
        document.documentElement.style.visibility =
          "";

      }
    )
    .catch(
      error => {

        if (
          error?.authInvalid
        ) {

          clearUserAuth();

          redirectToLogin();

          return;

        }


        /*
         * Если, например, временно упала сеть,
         * не устраиваем цикл редиректов.
         * Сам кабинет ниже покажет ошибку API.
         */
        document.documentElement.style.visibility =
          "";

      }
    );

})();
