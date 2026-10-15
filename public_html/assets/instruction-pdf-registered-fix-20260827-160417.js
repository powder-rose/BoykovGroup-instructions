(() => {
  "use strict";


  const TOKEN_KEYS = [
    "boykovgroup_admin_token",
    "boykovgroup_auth_token"
  ];


  const ROOT_ID =
    "boykov-instruction-pdf-download";


  let lastToken =
    undefined;


  let authPromise =
    null;

  const CATALOG_DOWNLOAD_NOTE =
    "5 скачиваний на аккаунт за всё время";


  function updateCatalogDownloadNote(status, user) {
    const note = user?.role === "admin" ? "" : CATALOG_DOWNLOAD_NOTE;
    if (status.textContent !== note) {
      status.textContent = note;
    }
  }


  function getDownloadSuccessMessage(response, user) {
    const remaining = response.headers.get("X-Download-Remaining");
    const quotaMessage =
      user?.role !== "admin" &&
      response.headers.get("X-Download-Limit") === "5" &&
      /^[0-5]$/.test(remaining || "")
        ? ` Осталось скачиваний из каталога: ${remaining} из 5.`
        : "";
    return `PDF успешно сформирован.${quotaMessage}`;
  }


  function getToken() {

    for (
      const key
      of TOKEN_KEYS
    ) {

      const value =
        localStorage.getItem(
          key
        );

      if (value) {
        return value;
      }

    }

    return null;
  }


  function getInstructionId() {

    const match =
      window.location.pathname
        .match(
          /^\/instrukciya-po-ohrane-truda\/([^/]+)\/?$/
        );


    if (!match) {
      return null;
    }


    try {

      return decodeURIComponent(
        match[1]
      );

    }

    catch {

      return match[1];

    }
  }


  function removeControl() {

    document
      .getElementById(
        ROOT_ID
      )
      ?.remove();

  }


  async function getAuth(
    token
  ) {

    if (
      token !==
      lastToken
    ) {

      lastToken =
        token;

      authPromise =
        null;

    }


    if (!token) {
      return null;
    }


    if (!authPromise) {

      authPromise =
        fetch(
          "/api/auth/me",
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        )
          .then(
            async response => {

              if (
                !response.ok
              ) {
                return null;
              }

              const data =
                await response.json();

              return (
                data?.user ??
                null
              );
            }
          )
          .catch(
            () => null
          );

    }


    return authPromise;
  }


  function createControl() {

    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.id =
      ROOT_ID;


    wrapper.className =
      "boykovPdfDownload";


    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";


    button.className =
      "boykovPdfDownload__button";


    const badge =
      document.createElement(
        "span"
      );


    badge.className =
      "boykovPdfDownload__badge";

    badge.setAttribute("aria-hidden", "true");


    badge.textContent =
      "PDF";


    const text =
      document.createElement(
        "span"
      );


    text.className =
      "boykovPdfDownload__text";


    button.append(
      badge,
      text
    );


    const status =
      document.createElement(
        "span"
      );


    status.className =
      "boykovPdfDownload__status";


    wrapper.append(
      button,
      status
    );


    return {
      wrapper,
      button,
      text,
      status
    };
  }


  function downloadNameFromHeaders(
    response,
    fallback
  ) {

    const disposition =
      response.headers.get(
        "Content-Disposition"
      ) || "";


    const utf8 =
      disposition.match(
        /filename\*=UTF-8''([^;]+)/i
      );


    if (
      utf8?.[1]
    ) {

      try {

        return decodeURIComponent(
          utf8[1]
        );

      }

      catch {
      }

    }


    return fallback;
  }


  /*
   * GUEST_REGISTRATION_MODAL_V1
   *
   * Используем уже существующую
   * React-модалку авторизации/регистрации.
   * Новую форму регистрации здесь
   * НЕ создаём.
   */

  function isVisible(
    element
  ) {

    if (!element) {
      return false;
    }


    const style =
      window.getComputedStyle(
        element
      );


    if (
      style.display ===
        "none" ||
      style.visibility ===
        "hidden"
    ) {
      return false;
    }


    return (
      element.getClientRects()
        .length > 0
    );
  }


  function findActionByText(
    pattern,
    root = document
  ) {

    const elements =
      Array.from(
        root.querySelectorAll(
          "button, a, [role='button']"
        )
      );


    return (
      elements.find(
        element => {

          if (
            element.closest(
              "#boykov-instruction-pdf-download"
            )
          ) {
            return false;
          }


          if (
            !isVisible(
              element
            )
          ) {
            return false;
          }


          const text =
            String(
              element.textContent ||
              ""
            )
              .trim()
              .replace(
                /\s+/g,
                " "
              );


          return pattern.test(
            text
          );
        }
      ) ??
      null
    );
  }


  function findRegistrationAction() {

    const dialog =
      document.querySelector(
        '[role="dialog"]'
      );


    const root =
      dialog ||
      document;


    return (
      findActionByText(
        /зарегистрироваться|регистрация|создать аккаунт/i,
        root
      )
    );
  }


  /*
   * PDF_GUEST_DIRECT_REGISTRATION_MODAL_V2
   *
   * Гость получает самостоятельную
   * модалку регистрации.
   *
   * Имя, телефон и согласия
   * автоматически добавляются уже
   * подключёнными registration scripts.
   */

  const GUEST_MODAL_ID =
    "boykov-pdf-registration-modal";


  function closeRegistrationModal(
    reloadAfter = false
  ) {

    const modal =
      document.getElementById(
        GUEST_MODAL_ID
      );


    if (!modal) {
      return;
    }


    modal.remove();


    document.body.style.overflow =
      modal.dataset.previousOverflow ||
      "";


    if (reloadAfter) {

      window.location.reload();

    }

  }


  function createModalField({
    label,
    type,
    name,
    autocomplete,
    placeholder,
    minLength
  }) {

    const wrapper =
      document.createElement(
        "label"
      );


    wrapper.className =
      "boykovPdfRegistration__field";


    const caption =
      document.createElement(
        "span"
      );


    caption.className =
      "boykovPdfRegistration__label";


    caption.textContent =
      label;


    const input =
      document.createElement(
        "input"
      );


    input.className =
      "boykovPdfRegistration__input";


    input.type =
      type;


    input.name =
      name;


    input.autocomplete =
      autocomplete;


    input.placeholder =
      placeholder;


    input.required =
      true;


    if (minLength) {

      input.minLength =
        minLength;

    }


    wrapper.append(
      caption,
      input
    );


    return wrapper;

  }


  function waitForRegistrationFields(
    form,
    submit,
    status
  ) {

    let attempts =
      0;


    const check =
      () => {

        attempts +=
          1;


        const name =
          form.querySelector(
            "#boykov-registration-name"
          );


        const phone =
          form.querySelector(
            "#boykov-registration-phone"
          );


        const consents =
          form.querySelector(
            ".boykovRegistrationConsents"
          );


        if (
          name &&
          phone &&
          consents
        ) {

          submit.disabled =
            false;


          submit.textContent =
            "Зарегистрироваться";


          return;

        }


        if (
          attempts >=
          40
        ) {

          submit.disabled =
            false;


          submit.textContent =
            "Зарегистрироваться";


          status.textContent =
            "";


          return;

        }


        window.setTimeout(
          check,
          50
        );

      };


    check();

  }


  function openRegistrationModal() {

    const existing =
      document.getElementById(
        GUEST_MODAL_ID
      );


    if (existing) {

      existing
        .querySelector(
          'input[name="email"]'
        )
        ?.focus();


      return;

    }


    const overlay =
      document.createElement(
        "div"
      );


    overlay.id =
      GUEST_MODAL_ID;


    overlay.className =
      "boykovPdfRegistration";


    overlay.dataset.previousOverflow =
      document.body.style.overflow ||
      "";


    const modal =
      document.createElement(
        "div"
      );


    modal.className =
      "boykovPdfRegistration__modal";


    modal.setAttribute(
      "role",
      "dialog"
    );


    modal.setAttribute(
      "aria-modal",
      "true"
    );


    modal.setAttribute(
      "aria-labelledby",
      "boykov-pdf-registration-title"
    );


    const close =
      document.createElement(
        "button"
      );


    close.type =
      "button";


    close.className =
      "boykovPdfRegistration__close";


    close.setAttribute(
      "aria-label",
      "Закрыть"
    );


    close.textContent =
      "×";


    const eyebrow =
      document.createElement(
        "div"
      );


    eyebrow.className =
      "boykovPdfRegistration__eyebrow";


    eyebrow.textContent =
      "PDF";


    const title =
      document.createElement(
        "h2"
      );


    title.id =
      "boykov-pdf-registration-title";


    title.className =
      "boykovPdfRegistration__title";


    title.textContent =
      "Регистрация";


    const description =
      document.createElement(
        "p"
      );


    description.className =
      "boykovPdfRegistration__description";


    description.textContent =
      "Зарегистрируйтесь, чтобы скачать инструкцию в PDF.";


    const form =
      document.createElement(
        "form"
      );


    form.className =
      "boykovPdfRegistration__form";


    form.noValidate =
      false;


    /*
     * Имя и телефон сюда намеренно
     * не вставляем.
     *
     * Их добавит уже работающий
     * registration-profile script.
     */
    const emailField =
      createModalField({

        label:
          "Email",

        type:
          "email",

        name:
          "email",

        autocomplete:
          "email",

        placeholder:
          "name@example.ru"

      });


    const passwordField =
      createModalField({

        label:
          "Пароль",

        type:
          "password",

        name:
          "password",

        autocomplete:
          "new-password",

        placeholder:
          "Введите пароль",

        minLength:
          8

      });


    const submit =
      document.createElement(
        "button"
      );


    submit.type =
      "submit";


    submit.className =
      "boykovPdfRegistration__submit";


    submit.disabled =
      true;


    submit.textContent =
      "Подготовка...";


    const status =
      document.createElement(
        "div"
      );


    status.className =
      "boykovPdfRegistration__status";


    status.setAttribute(
      "role",
      "status"
    );


    form.append(
      emailField,
      passwordField,
      submit,
      status
    );


    modal.append(
      close,
      eyebrow,
      title,
      description,
      form
    );


    overlay.appendChild(
      modal
    );


    document.body.appendChild(
      overlay
    );


    document.body.style.overflow =
      "hidden";


    /*
     * Существующие MutationObserver:
     *
     * registration-profile
     * -> добавит Имя и Телефон.
     *
     * registration-consents
     * -> добавит все 3 согласия.
     */
    waitForRegistrationFields(
      form,
      submit,
      status
    );


    close.addEventListener(
      "click",
      () => {

        closeRegistrationModal(
          overlay.dataset.registered ===
            "1"
        );

      }
    );


    overlay.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          overlay
        ) {

          closeRegistrationModal(
            overlay.dataset.registered ===
              "1"
          );

        }

      }
    );


    const escapeHandler =
      event => {

        if (
          event.key ===
          "Escape"
        ) {

          document.removeEventListener(
            "keydown",
            escapeHandler
          );


          closeRegistrationModal(
            overlay.dataset.registered ===
              "1"
          );

        }

      };


    document.addEventListener(
      "keydown",
      escapeHandler
    );


    form.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        if (
          !form.reportValidity()
        ) {
          return;
        }


        submit.disabled =
          true;


        submit.textContent =
          "Регистрируем...";


        status.className =
          "boykovPdfRegistration__status";


        status.textContent =
          "";


        const email =
          String(
            form.elements.email?.value ||
            ""
          ).trim();


        const password =
          String(
            form.elements.password?.value ||
            ""
          );


        try {

          /*
           * registration-profile и
           * registration-consents уже
           * оборачивают window.fetch.
           *
           * Поэтому к этому body
           * автоматически добавятся:
           *
           * name
           * phone
           * userAgreementAccepted
           * personalDataConsentAccepted
           * advertisingConsentAccepted
           */
          const response =
            await fetch(
              "/api/auth/register",
              {

                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    email,
                    password
                  })

              }
            );


          let data =
            null;


          try {

            data =
              await response.json();

          }

          catch {
          }


          if (
            !response.ok
          ) {

            throw new Error(
              data?.error ||
              "Не удалось зарегистрироваться"
            );

          }


          if (
            data?.token
          ) {

            localStorage.setItem(
              "boykovgroup_auth_token",
              data.token
            );

          }


          overlay.dataset.registered =
            "1";


          submit.textContent =
            "Готово";


          submit.disabled =
            true;


          status.className =
            "boykovPdfRegistration__status boykovPdfRegistration__status--success";


          status.textContent =
            data?.verificationEmailSent ===
              false
              ?
                "Регистрация завершена."
              :
                "Регистрация завершена. Подтвердите e-mail по ссылке из письма.";


          window.setTimeout(
            () => {

              closeRegistrationModal(
                true
              );

            },
            1800
          );

        }

        catch (error) {

          submit.disabled =
            false;


          submit.textContent =
            "Зарегистрироваться";


          status.className =
            "boykovPdfRegistration__status boykovPdfRegistration__status--error";


          status.textContent =
            error?.message ||
            "Не удалось зарегистрироваться";

        }

      }
    );


    window.setTimeout(
      () => {

        form
          .querySelector(
            "#boykov-registration-name"
          )
          ?.focus();

      },
      120
    );

  }


  async function downloadPdf(
    instructionId,
    token,
    control,
    user
  ) {

    if (
      control.button.disabled
    ) {
      return;
    }


    control.button.disabled =
      true;


    control.wrapper.classList.add(
      "boykovPdfDownload--loading"
    );


    control.text.textContent =
      "Формируем PDF...";


    control.status.textContent =
      "";


    try {

      const response =
        await fetch(
          `/api/instructions/${encodeURIComponent(
            instructionId
          )}/pdf`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );


      if (!response.ok) {

        let message =
          "Не удалось скачать PDF";


        try {

          const data =
            await response.json();


          if (
            data?.error
          ) {
            message =
              data.error;
          }

        }

        catch {
        }


        throw new Error(
          message
        );
      }


      const blob =
        await response.blob();


      const objectUrl =
        URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        objectUrl;


      link.download =
        downloadNameFromHeaders(
          response,
          `instruction-${instructionId}.pdf`
        );


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      window.setTimeout(
        () => {

          URL.revokeObjectURL(
            objectUrl
          );

        },
        1500
      );


      control.text.textContent =
        "Скачать PDF";


      control.status.textContent =
        getDownloadSuccessMessage(response, user);

    }

    catch (error) {

      control.text.textContent =
        "Скачать PDF";


      control.status.textContent =
        error?.message ||
        "Не удалось скачать PDF";

    }

    finally {

      control.wrapper
        .classList.remove(
          "boykovPdfDownload--loading"
        );


      control.button.disabled =
        false;

    }
  }


  async function render() {

    const instructionId =
      getInstructionId();


    if (!instructionId) {

      removeControl();

      return;
    }


    const token =
      getToken();


    /*
     * У гостя token отсутствует.
     * Кнопку всё равно отображаем.
     */
    const user =
      token
        ? await getAuth(
            token
          )
        : null;


    const title =
      document.querySelector(
        "main article h1"
      );


    if (!title) {
      return;
    }


    let wrapper =
      document.getElementById(
        ROOT_ID
      );


    let control;


    if (!wrapper) {

      control =
        createControl();


      wrapper =
        control.wrapper;


      title.insertAdjacentElement(
        "afterend",
        wrapper
      );

    }

    else {

      control = {
        wrapper,

        button:
          wrapper.querySelector(
            ".boykovPdfDownload__button"
          ),

        text:
          wrapper.querySelector(
            ".boykovPdfDownload__text"
          ),

        status:
          wrapper.querySelector(
            ".boykovPdfDownload__status"
          )
      };

    }


    if (
      !control.button ||
      !control.text ||
      !control.status
    ) {

      wrapper.remove();

      return;
    }


    /*
     * Гость:
     * кнопку показываем как обычную,
     * но вместо запроса PDF
     * открываем регистрацию.
     */
    if (!user) {

      control.wrapper.classList.remove(
        "boykovPdfDownload--locked",
        "boykovPdfDownload--loading"
      );


      control.wrapper.classList.add(
        "boykovPdfDownload--guest"
      );


      control.button.disabled =
        false;


      control.text.textContent =
        "Скачать PDF";


      updateCatalogDownloadNote(control.status, user);


      control.button.onclick =
        () => {

          openRegistrationModal();

        };


      return;
    }


    control.wrapper.classList.remove(
      "boykovPdfDownload--guest"
    );


    const allowed =
      user.role ===
        "admin" ||
      (
        user.role ===
          "user" &&
        user.emailVerified ===
          true
      );


    control.button.onclick =
      null;


    if (!allowed) {

      control.wrapper.classList.add(
        "boykovPdfDownload--locked"
      );


      control.button.disabled =
        true;


      control.text.textContent =
        "Подтвердите e-mail для PDF";


      updateCatalogDownloadNote(control.status, user);


      return;
    }


    control.wrapper.classList.remove(
      "boykovPdfDownload--locked"
    );


    control.button.disabled =
      false;


    control.text.textContent =
      "Скачать PDF";


    updateCatalogDownloadNote(control.status, user);


    control.button.onclick =
      () => {

        void downloadPdf(
          instructionId,
          token,
          control,
          user
        );

      };

  }


  let scheduled =
    false;


  function scheduleRender() {

    if (scheduled) {
      return;
    }


    scheduled =
      true;


    requestAnimationFrame(
      () => {

        scheduled =
          false;

        void render();

      }
    );

  }


  /*
   * =========================================================
   * REGISTERED PDF DOWNLOAD FIX V3
   * =========================================================
   *
   * Причина:
   * старая кнопка получала onclick во время render(),
   * а MutationObserver постоянно вызывал render повторно.
   *
   * Теперь реальный клик перехватывается один раз
   * через event delegation.
   */


  function getPdfTokenCandidates() {

    const tokens =
      [];


    const add =
      value => {

        const token =
          String(
            value || ""
          ).trim();


        if (
          token &&
          !tokens.includes(
            token
          )
        ) {

          tokens.push(
            token
          );

        }

      };


    /*
     * Наши известные ключи.
     */
    add(
      localStorage.getItem(
        "boykovgroup_auth_token"
      )
    );


    add(
      localStorage.getItem(
        "boykovgroup_admin_token"
      )
    );


    /*
     * Страховка:
     * если текущая React-сборка хранит
     * JWT под другим ключом.
     */
    for (
      let index = 0;
      index < localStorage.length;
      index += 1
    ) {

      const key =
        localStorage.key(
          index
        );


      if (!key) {
        continue;
      }


      const value =
        localStorage.getItem(
          key
        );


      if (
        typeof value ===
          "string" &&
        value.startsWith(
          "eyJ"
        ) &&
        value.split(".").length ===
          3
      ) {

        add(
          value
        );

      }

    }


    return tokens;

  }


  async function resolvePdfSession() {

    const tokens =
      getPdfTokenCandidates();


    for (
      const token
      of tokens
    ) {

      try {

        const response =
          await fetch(
            "/api/auth/me",
            {

              method:
                "GET",

              headers: {

                Authorization:
                  `Bearer ${token}`

              },

              cache:
                "no-store"

            }
          );


        if (!response.ok) {
          continue;
        }


        const data =
          await response.json();


        if (
          data?.user
        ) {

          return {

            token,

            user:
              data.user

          };

        }

      }

      catch {
      }

    }


    return null;

  }


  function showPdfMessage(
    message,
    type = "error"
  ) {

    document
      .getElementById(
        "boykov-pdf-download-message"
      )
      ?.remove();


    const toast =
      document.createElement(
        "div"
      );


    toast.id =
      "boykov-pdf-download-message";


    toast.style.position =
      "fixed";


    toast.style.right =
      "20px";


    toast.style.bottom =
      "20px";


    toast.style.zIndex =
      "100000";


    toast.style.maxWidth =
      "380px";


    toast.style.padding =
      "12px 16px";


    toast.style.borderRadius =
      "8px";


    toast.style.fontSize =
      "13px";


    toast.style.lineHeight =
      "1.45";


    toast.style.boxShadow =
      "0 12px 30px rgba(0,0,0,.16)";


    if (
      type ===
      "success"
    ) {

      toast.style.background =
        "#edf8f2";


      toast.style.color =
        "#236342";


      toast.style.border =
        "1px solid #b9dec9";

    }

    else {

      toast.style.background =
        "#fff6f6";


      toast.style.color =
        "#9d3535";


      toast.style.border =
        "1px solid #e8c0c0";

    }


    toast.textContent =
      message;


    document.body.appendChild(
      toast
    );


    window.setTimeout(
      () => {

        toast.remove();

      },
      5000
    );

  }


  function getPdfFileName(
    response,
    instructionId
  ) {

    const disposition =
      response.headers.get(
        "Content-Disposition"
      ) || "";


    const match =
      disposition.match(
        /filename\*=UTF-8''([^;]+)/i
      );


    if (
      match?.[1]
    ) {

      try {

        return decodeURIComponent(
          match[1]
        );

      }

      catch {
      }

    }


    return (
      `instruction-${instructionId}.pdf`
    );

  }


  async function stablePdfDownload(
    instructionId,
    token,
    button,
    user
  ) {

    const wrapper =
      button.closest(
        "#boykov-instruction-pdf-download"
      );


    const text =
      button.querySelector(
        ".boykovPdfDownload__text"
      );


    const originalText =
      text?.textContent ||
      "Скачать PDF";


    button.disabled =
      true;


    if (text) {

      text.textContent =
        "Формируем PDF...";

    }


    try {

      const response =
        await fetch(
          `/api/instructions/${
            encodeURIComponent(
              instructionId
            )
          }/pdf`,
          {

            method:
              "GET",

            headers: {

              Authorization:
                `Bearer ${token}`,

              Accept:
                "application/pdf"

            },

            cache:
              "no-store"

          }
        );


      if (!response.ok) {

        let message =
          `Ошибка скачивания (${response.status})`;


        try {

          const data =
            await response.json();


          if (
            data?.error
          ) {

            message =
              data.error;

          }

        }

        catch {
        }


        throw new Error(
          message
        );

      }


      const contentType =
        response.headers.get(
          "Content-Type"
        ) || "";


      if (
        !contentType
          .toLowerCase()
          .includes(
            "application/pdf"
          )
      ) {

        throw new Error(
          "Сервер вернул не PDF-файл"
        );

      }


      const blob =
        await response.blob();


      if (
        blob.size <
        1000
      ) {

        throw new Error(
          "Получен пустой PDF-файл"
        );

      }


      const objectUrl =
        URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        objectUrl;


      link.download =
        getPdfFileName(
          response,
          instructionId
        );


      link.style.display =
        "none";


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      window.setTimeout(
        () => {

          URL.revokeObjectURL(
            objectUrl
          );

        },
        5000
      );


      showPdfMessage(
        getDownloadSuccessMessage(response, user),
        "success"
      );

    }

    catch (error) {

      console.error(
        "PDF download error:",
        error
      );


      showPdfMessage(
        error?.message ||
        "Не удалось скачать PDF"
      );

    }

    finally {

      button.disabled =
        false;


      if (text) {

        text.textContent =
          originalText;

      }


      if (wrapper) {

        wrapper.classList.remove(
          "boykovPdfDownload--loading"
        );

      }

    }

  }


  /*
   * Один источник поведения кнопки.
   *
   * Используем capture=true и
   * stopImmediatePropagation(),
   * чтобы старый onclick больше
   * не конфликтовал.
   */
  document.addEventListener(
    "click",

    async event => {

      const button =
        event.target.closest(
          "#boykov-instruction-pdf-download .boykovPdfDownload__button"
        );


      if (!button) {
        return;
      }


      /*
       * Если кнопка реально заблокирована
       * для неподтверждённого пользователя,
       * браузер обычно сам не посылает click.
       */
      if (
        button.disabled
      ) {
        return;
      }


      event.preventDefault();

      event.stopImmediatePropagation();


      const instructionId =
        getInstructionId();


      if (!instructionId) {

        showPdfMessage(
          "Не удалось определить инструкцию"
        );

        return;
      }


      const session =
        await resolvePdfSession();


      /*
       * Нет валидной сессии —
       * значит пользователь гость.
       */
      if (!session) {

        openRegistrationModal();

        return;
      }


      const {
        token,
        user
      } =
        session;


      /*
       * Администратор.
       */
      if (
        user.role ===
        "admin"
      ) {

        await stablePdfDownload(
          instructionId,
          token,
          button,
          user
        );

        return;
      }


      /*
       * Обычный пользователь.
       */
      if (
        user.role ===
          "user" &&
        user.emailVerified ===
          true
      ) {

        await stablePdfDownload(
          instructionId,
          token,
          button,
          user
        );

        return;
      }


      /*
       * Пользователь есть,
       * но email ещё не подтверждён.
       */
      showPdfMessage(
        "Подтвердите e-mail, чтобы скачать PDF"
      );

    },

    true
  );


  /*
   * =========================================================
   * /REGISTERED PDF DOWNLOAD FIX V3
   * =========================================================
   */



  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      scheduleRender,
      {
        once: true
      }
    );

  }

  else {

    scheduleRender();

  }


  new MutationObserver(
    scheduleRender
  ).observe(
    document.documentElement,
    {
      childList:
        true,

      subtree:
        true
    }
  );


  window.addEventListener(
    "popstate",
    scheduleRender
  );


  window.addEventListener(
    "storage",
    scheduleRender
  );

})();
