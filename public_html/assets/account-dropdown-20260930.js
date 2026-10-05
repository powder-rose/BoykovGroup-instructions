(() => {

  "use strict";


  const USER_TOKEN_KEY =
    "boykovgroup_auth_token";


  function getUserToken() {

    try {

      return localStorage.getItem(
        USER_TOKEN_KEY
      );

    }
    catch {

      return null;

    }

  }


  function closeAllMenus(
    except = null
  ) {

    document
      .querySelectorAll(
        ".boykovAccountMenu"
      )
      .forEach(
        menu => {

          if (
            except &&
            menu === except
          ) {
            return;
          }


          menu.hidden =
            true;


          const wrapper =
            menu.closest(
              ".boykovAccountDropdown"
            );


          wrapper
            ?.querySelector(
              ".boykovAccountTrigger"
            )
            ?.setAttribute(
              "aria-expanded",
              "false"
            );

        }
      );

  }


  function createMenu(
    wrapper,
    badge,
    logoutButton
  ) {

    if (
      wrapper.dataset
        .boykovAccountDropdown ===
        "1"
    ) {
      return;
    }


    const badgeText =
      String(
        badge.textContent ||
        ""
      ).trim();


    /*
     * Админскую панель сейчас
     * не переделываем.
     */
    if (
      badgeText
        .toLowerCase()
        .includes(
          "админ:"
        )
    ) {
      return;
    }


    const token =
      getUserToken();


    if (!token) {
      return;
    }


    const email =
      badgeText
        .replace(
          /^\[\s*/,
          ""
        )
        .replace(
          /\s*\]$/,
          ""
        )
        .trim();


    wrapper.dataset
      .boykovAccountDropdown =
        "1";


    wrapper.classList.add(
      "boykovAccountDropdown"
    );


    /*
     * Оригинальный React badge оставляем
     * в DOM, но визуально скрываем.
     */
    badge.classList.add(
      "boykovAccountOriginalBadge"
    );


    /*
     * Оригинальную кнопку logout тоже
     * не удаляем — через неё продолжает
     * работать штатный Redux logout.
     */
    logoutButton.classList.add(
      "boykovAccountOriginalLogout"
    );


    const trigger =
      document.createElement(
        "button"
      );


    trigger.type =
      "button";

    trigger.className =
      "boykovAccountTrigger";

    trigger.setAttribute(
      "aria-haspopup",
      "menu"
    );

    trigger.setAttribute(
      "aria-expanded",
      "false"
    );


    const triggerEmail =
      document.createElement(
        "span"
      );


    triggerEmail.className =
      "boykovAccountTrigger__email";

    triggerEmail.textContent =
      `[ ${email} ]`;


    const chevron =
      document.createElement(
        "span"
      );


    chevron.className =
      "boykovAccountTrigger__chevron";

    chevron.setAttribute(
      "aria-hidden",
      "true"
    );

    chevron.textContent =
      "▾";


    trigger.append(
      triggerEmail,
      chevron
    );


    const menu =
      document.createElement(
        "div"
      );


    menu.className =
      "boykovAccountMenu";

    menu.hidden =
      true;

    menu.setAttribute(
      "role",
      "menu"
    );


    const head =
      document.createElement(
        "div"
      );


    head.className =
      "boykovAccountMenu__head";


    const label =
      document.createElement(
        "div"
      );


    label.className =
      "boykovAccountMenu__label";

    label.textContent =
      "АККАУНТ";


    const accountEmail =
      document.createElement(
        "div"
      );


    accountEmail.className =
      "boykovAccountMenu__email";

    accountEmail.textContent =
      email;


    head.append(
      label,
      accountEmail
    );


    const divider =
      document.createElement(
        "div"
      );


    divider.className =
      "boykovAccountMenu__divider";


    const accountLink =
      document.createElement(
        "a"
      );


    accountLink.href =
      "/account/";

    accountLink.className =
      "boykovAccountMenu__item";

    accountLink.setAttribute(
      "role",
      "menuitem"
    );


    const accountText =
      document.createElement(
        "span"
      );


    accountText.textContent =
      "Личный кабинет";


    const arrow =
      document.createElement(
        "span"
      );


    arrow.className =
      "boykovAccountMenu__arrow";

    arrow.textContent =
      "→";


    accountLink.append(
      accountText,
      arrow
    );


    const logout =
      document.createElement(
        "button"
      );


    logout.type =
      "button";

    logout.className =
      "boykovAccountMenu__item boykovAccountMenu__logout";

    logout.setAttribute(
      "role",
      "menuitem"
    );

    logout.textContent =
      "Выйти";


    trigger.addEventListener(
      "click",
      event => {

        event.stopPropagation();


        const willOpen =
          menu.hidden;


        closeAllMenus(
          menu
        );


        menu.hidden =
          !willOpen;


        trigger.setAttribute(
          "aria-expanded",
          willOpen
            ? "true"
            : "false"
        );

      }
    );


    menu.addEventListener(
      "click",
      event => {

        event.stopPropagation();

      }
    );


    logout.addEventListener(
      "click",
      () => {

        closeAllMenus();


        /*
         * Используем штатную React-кнопку,
         * поэтому очистка Redux/localStorage
         * остаётся ровно той же, что была.
         */
        logoutButton.click();

      }
    );


    menu.append(
      head,
      divider,
      accountLink,
      logout
    );


    wrapper.append(
      trigger,
      menu
    );

  }


  function scan() {

    /*
     * Текущий production AuthControls:
     *
     * ._wrapper_1190d_1
     *   ._badge_1190d_7
     *   button "выйти"
     */

    document
      .querySelectorAll(
        "._wrapper_1190d_1"
      )
      .forEach(
        wrapper => {

          const badge =
            wrapper.querySelector(
              "._badge_1190d_7"
            );


          const logoutButton =
            Array.from(
              wrapper.querySelectorAll(
                "button"
              )
            )
            .find(
              button =>
                String(
                  button.textContent ||
                  ""
                )
                .trim()
                .toLowerCase() ===
                  "выйти"
            );


          if (
            !badge ||
            !logoutButton
          ) {
            return;
          }


          createMenu(
            wrapper,
            badge,
            logoutButton
          );

        }
      );

  }


  document.addEventListener(
    "click",
    () => {

      closeAllMenus();

    }
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {

        closeAllMenus();

      }

    }
  );


  if (
    document.readyState ===
      "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      scan,
      {
        once: true
      }
    );

  }
  else {

    scan();

  }


  /*
   * AuthControls появляется после
   * восстановления Redux-сессии,
   * поэтому отслеживаем React rerender.
   */
  const observer =
    new MutationObserver(
      scan
    );


  observer.observe(
    document.documentElement,
    {
      childList:
        true,

      subtree:
        true
    }
  );

})();
