(() => {

  "use strict";


  const TOKEN_KEY =
    "boykovgroup_auth_token";

  const NEXT_KEY =
    "boykovdocs_auth_next_v1";


  const params =
    new URLSearchParams(
      window.location.search
    );


  if (
    params.get(
      "auth"
    ) !== "1"
  ) {
    return;
  }


  /*
   * Разрешаем переход только внутри boykovdocs.ru.
   * Никаких внешних redirect URL.
   */
  function safeNext(
    value
  ) {

    try {

      const target =
        new URL(
          String(
            value || "/account/"
          ),
          window.location.origin
        );


      if (
        target.origin !==
        window.location.origin
      ) {

        return "/account/";

      }


      return (
        target.pathname +
        target.search +
        target.hash
      );

    }
    catch {

      return "/account/";

    }

  }


  const next =
    safeNext(
      params.get(
        "next"
      )
    );


  try {

    sessionStorage.setItem(
      NEXT_KEY,
      next
    );

  }
  catch {
    /* no-op */
  }


  async function verifyUserToken(
    token
  ) {

    if (!token) {
      return false;
    }


    try {

      const response =
        await fetch(
          "/api/auth/me",
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            },

            cache:
              "no-store"
          }
        );


      if (!response.ok) {
        return false;
      }


      const data =
        await response.json();


      return (
        data?.user?.role ===
        "user"
      );

    }
    catch {

      return false;

    }

  }


  function getUserToken() {

    try {

      return localStorage.getItem(
        TOKEN_KEY
      );

    }
    catch {

      return null;

    }

  }


  function clearBrokenUserToken() {

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


  function goNext() {

    let destination =
      next;


    try {

      destination =
        safeNext(
          sessionStorage.getItem(
            NEXT_KEY
          ) || next
        );


      sessionStorage.removeItem(
        NEXT_KEY
      );

    }
    catch {
      /* no-op */
    }


    window.location.replace(
      destination
    );

  }


  /*
   * Ищем именно существующую кнопку React.
   * Никакой второй формы авторизации.
   */
  function findLoginButton() {

    const buttons =
      Array.from(
        document.querySelectorAll(
          "button"
        )
      );


    return buttons.find(
      button => {

        const text =
          String(
            button.textContent ||
            ""
          )
          .replace(
            /\s+/g,
            " "
          )
          .trim()
          .toLowerCase();


        return (
          text.includes(
            "войти"
          ) &&
          text.includes(
            "регистрац"
          )
        );

      }
    ) || null;

  }


  async function start() {

    /*
     * Например человек уже вошёл,
     * а потом вручную открыл ссылку auth=1.
     */
    const currentToken =
      getUserToken();


    if (
      currentToken &&
      await verifyUserToken(
        currentToken
      )
    ) {

      goNext();
      return;

    }


    if (currentToken) {

      clearBrokenUserToken();

    }


    /*
     * React ещё может не успеть отрисовать кнопку,
     * поэтому ждём её появления.
     */
    let opened =
      false;


    const openTimer =
      window.setInterval(
        () => {

          if (opened) {
            return;
          }


          const button =
            findLoginButton();


          if (!button) {
            return;
          }


          opened =
            true;


          window.clearInterval(
            openTimer
          );


          button.click();

        },
        100
      );


    /*
     * После успешного login/register основной React
     * сам кладёт JWT в boykovgroup_auth_token.
     *
     * Мы ничего не вмешиваем в саму авторизацию —
     * только замечаем успешный результат.
     */
    let checkingToken =
      null;


    const authTimer =
      window.setInterval(
        async () => {

          const token =
            getUserToken();


          if (
            !token ||
            token ===
              checkingToken
          ) {
            return;
          }


          checkingToken =
            token;


          const valid =
            await verifyUserToken(
              token
            );


          if (valid) {

            window.clearInterval(
              authTimer
            );


            window.clearInterval(
              openTimer
            );


            goNext();

            return;

          }


          checkingToken =
            null;

        },
        250
      );


    /*
     * Не держим таймер бесконечно,
     * если человек просто закрыл окно входа.
     */
    window.setTimeout(
      () => {

        window.clearInterval(
          authTimer
        );

        window.clearInterval(
          openTimer
        );

      },
      15 * 60 * 1000
    );

  }


  start();

})();
