(() => {

  "use strict";


  const URGENT_PATH =
    "/srochnaya-generaciya-instrukcii";

  const CONSENT_ROOT_ID =
    "boykov-payment-consents";


  let offerAccepted =
    false;

  let personalDataAccepted =
    false;


  /*
   * LEGACY ORDER STORAGE CLEANUP
   *
   * Заказы теперь принадлежат аккаунту.
   * sessionStorage для восстановления больше не используется.
   */
  if (
    window.location.pathname ===
      URGENT_PATH
  ) {

    try {

      window.sessionStorage.removeItem(
        "boykovgroup_urgent_generation_order_v1"
      );

      window.sessionStorage.removeItem(
        "boykovdocs_thanks_order_v1"
      );

    }
    catch {
      /* no-op */
    }

  }


  /*
   * Сохраняем оригинальный fetch.
   *
   * Наш слой касается только двух endpoint:
   *
   * POST /api/public-generation/orders
   * POST /api/public-generation/orders/:id/confirm-payment
   */
  const baseFetch =
    window.fetch.bind(
      window
    );


  function getUrl(
    input
  ) {

    if (
      typeof input ===
      "string"
    ) {
      return input;
    }


    if (
      input instanceof URL
    ) {
      return input.href;
    }


    if (
      input instanceof Request
    ) {
      return input.url;
    }


    return String(
      input ??
      ""
    );

  }


  function getPath(
    input
  ) {

    try {

      return new URL(
        getUrl(
          input
        ),
        window.location.origin
      ).pathname;

    }
    catch {

      return "";

    }

  }


  function getMethod(
    input,
    init
  ) {

    if (
      init?.method
    ) {

      return String(
        init.method
      ).toUpperCase();

    }


    if (
      input instanceof Request
    ) {

      return String(
        input.method ||
        "GET"
      ).toUpperCase();

    }


    return "GET";

  }


  function getHeaders(
    input,
    init
  ) {

    const headers =
      new Headers();


    if (
      input instanceof Request
    ) {

      for (
        const [
          key,
          value
        ]
        of input.headers.entries()
      ) {

        headers.set(
          key,
          value
        );

      }

    }


    if (
      init?.headers
    ) {

      const additional =
        new Headers(
          init.headers
        );


      for (
        const [
          key,
          value
        ]
        of additional.entries()
      ) {

        headers.set(
          key,
          value
        );

      }

    }


    return headers;

  }


  function getUserAuthToken() {

    try {

      const token =
        window.localStorage
          .getItem(
            "boykovgroup_auth_token"
          );


      return token
        ? String(
            token
          )
        : null;

    }
    catch {

      return null;

    }

  }


  function currentConsentsAccepted() {

    const root =
      document.getElementById(
        CONSENT_ROOT_ID
      );


    const offer =
      root?.querySelector(
        '[data-payment-consent="offer"]'
      );


    const personal =
      root?.querySelector(
        '[data-payment-consent="personal"]'
      );


    if (offer) {

      offerAccepted =
        offer.checked;

    }


    if (personal) {

      personalDataAccepted =
        personal.checked;

    }


    return (
      offerAccepted &&
      personalDataAccepted
    );

  }


  function syntheticConsentError() {

    return new Response(
      JSON.stringify({
        code:
          "PAYMENT_CONSENTS_REQUIRED",

        error:
          "Для оплаты необходимо принять публичную оферту и дать согласие на обработку персональных данных."
      }),

      {
        status:
          422,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  }


  window.fetch =
    async function(
      input,
      init = {}
    ) {

      const path =
        getPath(
          input
        );


      const method =
        getMethod(
          input,
          init
        );


      /*
       * ========================================================
       * ORDER CREATE
       * ========================================================
       */
      if (
        method ===
          "POST" &&
        path ===
          "/api/public-generation/orders"
      ) {

        if (
          !currentConsentsAccepted()
        ) {

          showConsentError();

          return syntheticConsentError();

        }


        let body = {};


        try {

          if (
            typeof init?.body ===
            "string"
          ) {

            body =
              JSON.parse(
                init.body
              );

          }

        }
        catch {

          body = {};

        }


        const headers =
          getHeaders(
            input,
            init
          );


        headers.set(
          "Content-Type",
          "application/json"
        );


        const userToken =
          getUserAuthToken();


        if (userToken) {

          headers.set(
            "Authorization",
            `Bearer ${userToken}`
          );

        }


        return baseFetch(
          input,

          {
            ...init,

            headers,

            body:
              JSON.stringify({
                ...body,

                offerAccepted:
                  true,

                personalDataConsentAccepted:
                  true
              })
          }
        );

      }


      /*
       * ========================================================
       * CONFIRM PAYMENT
       * ========================================================
       *
       * Переход на /thanks выполняется только после
       * успешного ответа SERVER confirm-payment.
       */
      if (
        method ===
          "POST" &&
        /^\/api\/public-generation\/orders\/[^/]+\/confirm-payment$/u
          .test(
            path
          )
      ) {

        const response =
          await baseFetch(
            input,
            init
          );


        if (!response.ok) {

          return response;

        }


        let data = {};


        try {

          data =
            await response
              .clone()
              .json();

        }
        catch {

          return response;

        }


        const confirmedStatuses =
          new Set([
            "paid",
            "generating",
            "generated",
            "published",
            "moderating",
            "manual_review",
            "test_paid"
          ]);


        if (
          confirmedStatuses.has(
            data?.status
          )
        ) {

          const match =
            path.match(
              /^\/api\/public-generation\/orders\/([^/]+)\/confirm-payment$/u
            );


          const orderId =
            match
              ? decodeURIComponent(
                  match[1]
                )
              : null;


          if (orderId) {

            /*
             * Старые sessionStorage-ключи больше
             * не участвуют в checkout.
             *
             * Удаляем их у пользователей,
             * которые заходят после обновления.
             */
            try {

              window.sessionStorage.removeItem(
                "boykovgroup_urgent_generation_order_v1"
              );

              window.sessionStorage.removeItem(
                "boykovdocs_thanks_order_v1"
              );

            }
            catch {
              /* no-op */
            }


            window.location.replace(
              `/thanks/?orderId=${encodeURIComponent(orderId)}`
            );

          }

        }


        return response;

      }


      return baseFetch(
        input,
        init
      );

    };


  function findPaymentForm() {

    if (
      window.location.pathname !==
      URGENT_PATH
    ) {

      return null;

    }


    return (
      Array
        .from(
          document.querySelectorAll(
            "form"
          )
        )
        .find(
          form =>
            form.textContent
              ?.includes(
                "Сумма оплаты"
              )
        )
      ||
      null
    );

  }


  function findSubmitButton(
    form
  ) {

    return (
      form?.querySelector(
        'button[type="submit"]'
      )
      ||
      null
    );

  }


  function syncSubmitButton(
    form
  ) {

    const button =
      findSubmitButton(
        form
      );


    if (!button) {
      return;
    }


    const accepted =
      currentConsentsAccepted();


    if (!accepted) {

      if (
        !button.disabled
      ) {

        button.disabled =
          true;

        button.dataset
          .consentForcedDisabled =
          "1";

      }


      return;

    }


    /*
     * Снимаем disabled только если
     * именно наш consent-layer его установил.
     *
     * disabled от React во время оплаты
     * не трогаем.
     */
    if (
      button.dataset
        .consentForcedDisabled ===
      "1"
    ) {

      button.disabled =
        false;

      delete button.dataset
        .consentForcedDisabled;

    }

  }


  function showConsentError() {

    const root =
      document.getElementById(
        CONSENT_ROOT_ID
      );


    const error =
      root?.querySelector(
        ".boykovPaymentConsent__error"
      );


    if (!error) {
      return;
    }


    error.hidden =
      false;


    error.textContent =
      "Для перехода к оплате отметьте оба обязательных согласия.";

  }


  function clearConsentError() {

    const root =
      document.getElementById(
        CONSENT_ROOT_ID
      );


    const error =
      root?.querySelector(
        ".boykovPaymentConsent__error"
      );


    if (error) {

      error.hidden =
        true;

      error.textContent =
        "";

    }

  }


  function createConsentRow({
    type,
    textBefore,
    linkText,
    href,
    textAfter
  }) {

    const label =
      document.createElement(
        "label"
      );


    label.className =
      "boykovPaymentConsent__row";


    const input =
      document.createElement(
        "input"
      );


    input.type =
      "checkbox";

    input.className =
      "boykovPaymentConsent__checkbox";

    input.dataset.paymentConsent =
      type;

    input.checked =
      type === "offer"
        ? offerAccepted
        : personalDataAccepted;


    const visual =
      document.createElement(
        "span"
      );


    visual.className =
      "boykovPaymentConsent__box";


    const content =
      document.createElement(
        "span"
      );


    content.className =
      "boykovPaymentConsent__text";


    content.append(
      document.createTextNode(
        textBefore
      )
    );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      href;

    link.target =
      "_blank";

    link.rel =
      "noopener";

    link.textContent =
      linkText;


    link.addEventListener(
      "click",
      event =>
        event.stopPropagation()
    );


    content.appendChild(
      link
    );


    if (textAfter) {

      content.append(
        document.createTextNode(
          textAfter
        )
      );

    }


    input.addEventListener(
      "change",
      () => {

        if (
          type ===
          "offer"
        ) {

          offerAccepted =
            input.checked;

        }
        else {

          personalDataAccepted =
            input.checked;

        }


        clearConsentError();


        const form =
          findPaymentForm();


        if (form) {

          syncSubmitButton(
            form
          );

        }

      }
    );


    label.append(
      input,
      visual,
      content
    );


    return label;

  }


  function ensureConsentUi() {

    const form =
      findPaymentForm();


    if (!form) {
      return;
    }


    let root =
      document.getElementById(
        CONSENT_ROOT_ID
      );


    if (!root) {

      const button =
        findSubmitButton(
          form
        );


      if (!button) {
        return;
      }


      root =
        document.createElement(
          "div"
        );


      root.id =
        CONSENT_ROOT_ID;

      root.className =
        "boykovPaymentConsent";


      const heading =
        document.createElement(
          "div"
        );


      heading.className =
        "boykovPaymentConsent__heading";

      heading.textContent =
        "Перед оплатой";


      const rows =
        document.createElement(
          "div"
        );


      rows.className =
        "boykovPaymentConsent__rows";


      rows.append(

        createConsentRow({
          type:
            "personal",

          textBefore:
            "Я даю ",

          linkText:
            "согласие на обработку персональных данных",

          href:
            "/personal-data-consent/",

          textAfter:
            "."
        }),

        createConsentRow({
          type:
            "offer",

          textBefore:
            "Я ознакомился и принимаю условия ",

          linkText:
            "Публичной оферты",

          href:
            "/offer/",

          textAfter:
            "."
        })

      );


      const note =
        document.createElement(
          "p"
        );


      note.className =
        "boykovPaymentConsent__note";

      note.textContent =
        "Оба согласия обязательны для перехода к оплате.";


      const error =
        document.createElement(
          "p"
        );


      error.className =
        "boykovPaymentConsent__error";

      error.hidden =
        true;


      root.append(
        heading,
        rows,
        note,
        error
      );


      button.parentNode
        ?.insertBefore(
          root,
          button
        );

    }


    syncSubmitButton(
      form
    );

  }


  /*
   * Дополнительная защита:
   * даже если React успел перерисовать кнопку,
   * submit не пройдёт без двух галочек.
   */
  document.addEventListener(
    "submit",

    event => {

      const form =
        event.target;


      if (
        form !==
        findPaymentForm()
      ) {
        return;
      }


      if (
        currentConsentsAccepted()
      ) {
        return;
      }


      event.preventDefault();
      event.stopImmediatePropagation();

      showConsentError();


      document
        .querySelector(
          `#${CONSENT_ROOT_ID} input:not(:checked)`
        )
        ?.focus();

    },

    true
  );


  let scheduled =
    false;


  const observer =
    new MutationObserver(
      () => {

        if (scheduled) {
          return;
        }


        scheduled =
          true;


        requestAnimationFrame(
          () => {

            scheduled =
              false;

            ensureConsentUi();

          }
        );

      }
    );


  observer.observe(
    document.documentElement,
    {
      childList:
        true,

      subtree:
        true,

      attributes:
        true,

      attributeFilter: [
        "disabled"
      ]
    }
  );


  ensureConsentUi();

})();
