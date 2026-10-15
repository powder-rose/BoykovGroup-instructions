(() => {

  "use strict";


  const TOKEN_KEY =
    "boykovgroup_auth_token";


  const COMPANY_ONBOARDING_KEY = 'boykovdocs_company_onboarding_user_v1';
  const companyProfileRoot = document.getElementById('account-company-profile');
  let companyProfileController = null;
  let accountRequestId = 0;
  let currentAccountToken = null;
  let accountAbortController = null;

  function destroyCompanyProfile() {
    companyProfileController?.destroy();
    companyProfileController = null;
    companyProfileRoot?.replaceChildren();
  }

  function hasPendingCompanyProfile(userId) {
    try {
      return Boolean(userId) && sessionStorage.getItem(COMPANY_ONBOARDING_KEY) === String(userId);
    } catch {
      return false;
    }
  }

  function clearPendingCompanyProfile(userId) {
    try {
      if (hasPendingCompanyProfile(userId)) sessionStorage.removeItem(COMPANY_ONBOARDING_KEY);
    } catch {
      /* Session storage can be unavailable. */
    }
  }

  async function mountCompanyProfile(user, token, requestId, onboarding = hasPendingCompanyProfile(user?.id)) {
    if (!companyProfileRoot) return;
    destroyCompanyProfile();
    const loading = document.createElement('p');
    loading.className = 'company-profile__status';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Загружаем данные компании…';
    companyProfileRoot.append(loading);
    try {
      const { mountCompanyProfileForm } = await import('/assets/company-profile-form.js?v=20261015-company-profile-v3');
      if (requestId !== accountRequestId || getToken() !== token) return;
      companyProfileController = mountCompanyProfileForm(companyProfileRoot, {
        getToken,
        mode: onboarding ? 'onboarding' : 'account',
        onAuthenticationError() {
          if (getToken() === token) expireSession(token);
          else void start();
        },
        onComplete(_view, { action }) {
          if (!onboarding || requestId !== accountRequestId || getToken() !== token) return;
          if (['saved', 'dismissed', 'already-completed', 'deferred'].includes(action)) {
            clearPendingCompanyProfile(user.id);
            void mountCompanyProfile(user, token, requestId, false);
          }
        },
      });
    } catch {
      if (requestId !== accountRequestId || getToken() !== token) return;
      loading.textContent = 'Не удалось загрузить форму данных компании.';
      loading.classList.add('company-profile__status--error');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'company-profile__button';
      retry.textContent = 'Повторить';
      retry.addEventListener('click', () => mountCompanyProfile(user, token, requestId, onboarding));
      companyProfileRoot.append(retry);
      if (onboarding) {
        const defer = document.createElement('button');
        defer.type = 'button';
        defer.className = 'company-profile__button';
        defer.textContent = 'Продолжить без заполнения';
        defer.addEventListener('click', () => {
          clearPendingCompanyProfile(user.id);
          companyProfileRoot.replaceChildren();
        });
        companyProfileRoot.append(defer);
      }
    }
  }

  function expireSession(token) {
    if (getToken() !== token) return;
    destroyCompanyProfile();
    accountAbortController?.abort();
    accountRequestId += 1;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* no-op */
    }
    currentAccountToken = null;
    if (profileRoot) profileRoot.textContent = 'Требуется повторный вход.';
    if (ordersRoot) ordersRoot.textContent = 'Чтобы увидеть инструкции, войдите в аккаунт заново.';
    showMessage('Сессия истекла. Войдите в аккаунт заново.');
  }

  const profileRoot =
    document.getElementById(
      "account-profile"
    );

  const ordersRoot =
    document.getElementById(
      "account-orders"
    );

  const messageRoot =
    document.getElementById(
      "account-message"
    );

  const modal =
    document.getElementById(
      "instruction-modal"
    );

  const modalContent =
    document.getElementById(
      "instruction-modal-content"
    );

  const modalClose =
    document.getElementById(
      "instruction-modal-close"
    );


  function getToken() {

    try {

      return window.localStorage
        .getItem(
          TOKEN_KEY
        );

    }
    catch {

      return null;

    }

  }


  function authHeaders() {

    const token =
      getToken();


    return token
      ? {
          Authorization:
            `Bearer ${token}`
        }
      : {};

  }


  function showMessage(
    text
  ) {

    if (!messageRoot) {
      return;
    }


    messageRoot.hidden =
      false;

    messageRoot.textContent =
      text;

  }


  function clearMessage() {

    if (messageRoot) {

      messageRoot.hidden =
        true;

      messageRoot.textContent =
        "";

    }

  }


  function formatDate(
    value
  ) {

    if (!value) {
      return "—";
    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }


    return new Intl.DateTimeFormat(
      "ru-RU",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short"
      }
    )
      .format(
        date
      );

  }


  function formatAmount(
    amount,
    currency
  ) {

    return new Intl.NumberFormat(
      "ru-RU",
      {
        style:
          "currency",

        currency:
          currency || "RUB",

        maximumFractionDigits:
          2
      }
    )
      .format(
        Number(
          amount
        ) || 0
      );

  }


  function statusInfo(
    status
  ) {

    switch (
      status
    ) {

      case "pending_payment":
        return {
          text:
            "Ожидает оплаты",
          className:
            ""
        };


      case "paid":
      case "moderating":
      case "generating":
        return {
          text:
            "Готовим инструкцию",
          className:
            "orderCard__status--processing"
        };


      case "generated":
      case "published":
        return {
          text:
            "Готово",
          className:
            "orderCard__status--ready"
        };


      case "manual_review":
        return {
          text:
            "На дополнительной проверке",
          className:
            "orderCard__status--processing"
        };


      case "refunding":
      case "refund_pending":
        return {
          text:
            "Оформляется возврат",
          className:
            "orderCard__status--processing"
        };


      case "refunded":
        return {
          text:
            "Возврат выполнен",
          className:
            "orderCard__status--error"
        };


      case "test_paid":
        return {
          text:
            "Тестовый платёж",
          className:
            ""
        };


      default:
        return {
          text:
            String(
              status || "Неизвестно"
            ),
          className:
            ""
        };

    }

  }


  function isReady(
    order
  ) {

    return (
      order?.status ===
        "generated" ||
      order?.status ===
        "published"
    );

  }


  async function api(
    url,
    options = {}
  ) {

    const response =
      await fetch(
        url,
        {
          ...options,

          headers: {
            ...authHeaders(),
            ...(
              options.headers ||
              {}
            )
          },

          cache:
            "no-store"
        }
      );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    const data =
      contentType.includes(
        "application/json"
      )
        ?
          await response
            .json()
            .catch(
              () => ({})
            )
        :
          null;


    if (!response.ok) {

      const error =
        new Error(
          data?.error ||
          `Ошибка запроса (${response.status})`
        );


      error.status =
        response.status;


      throw error;

    }


    return data;

  }


  function renderProfile(
    user
  ) {

    if (!profileRoot) {
      return;
    }


    profileRoot.replaceChildren();


    const name =
      document.createElement(
        "div"
      );

    name.className =
      "accountProfile__name";

    name.textContent =
      user?.name ||
      "Пользователь";


    const email =
      document.createElement(
        "div"
      );

    email.className =
      "accountProfile__email";

    email.textContent =
      user?.email ||
      user?.login ||
      "";


    const logout =
      document.createElement(
        "button"
      );

    logout.type =
      "button";

    logout.className =
      "accountProfile__logout";

    logout.textContent =
      "Выйти из аккаунта";


    logout.addEventListener(
      "click",
      () => {
        destroyCompanyProfile();
        accountAbortController?.abort();
        accountRequestId += 1;
        clearPendingCompanyProfile(user?.id);

        try {

          localStorage.removeItem(
            TOKEN_KEY
          );

          sessionStorage.removeItem(
            "boykovgroup_active_auth_role"
          );

        }
        catch {
          /* no-op */
        }


        window.location.href =
          "/";

      }
    );


    profileRoot.append(
      name,
      email,
      logout
    );

  }


  async function downloadPdf(
    order
  ) {

    try {

      const response =
        await fetch(
          `/api/public-generation/my-orders/${encodeURIComponent(
            order.id
          )}/pdf`,
          {
            headers:
              authHeaders(),

            cache:
              "no-store"
          }
        );


      if (!response.ok) {

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );


        throw new Error(
          data?.error ||
          "Не удалось скачать PDF"
        );

      }


      const blob =
        await response.blob();


      const url =
        URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        url;

      link.download =
        `instruction-${order.id}.pdf`;


      document.body
        .appendChild(
          link
        );


      link.click();
      link.remove();


      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        2000
      );

    }
    catch(error) {

      window.alert(
        error?.message ||
        "Не удалось скачать PDF"
      );

    }

  }


  function paragraphText(
    value
  ) {

    if (
      typeof value ===
      "string"
    ) {
      return value;
    }


    if (
      value &&
      typeof value ===
        "object"
    ) {

      return String(
        value.text ??
        value.content ??
        ""
      );

    }


    return String(
      value ?? ""
    );

  }


  function renderInstruction(
    instruction
  ) {

    if (
      !modal ||
      !modalContent
    ) {
      return;
    }


    modalContent
      .replaceChildren();


    const article =
      document.createElement(
        "article"
      );


    article.className =
      "instructionDocument";

    article.dataset.copyProtected = "true";


    const h2 =
      document.createElement(
        "h2"
      );


    h2.textContent =
      instruction?.title ||
      (
        instruction?.profession
          ?
            `Инструкция по охране труда: ${instruction.profession}`
          :
            "Инструкция"
      );


    article.appendChild(
      h2
    );


    if (
      instruction?.intro
    ) {

      const intro =
        document.createElement(
          "p"
        );


      intro.textContent =
        String(
          instruction.intro
        );


      article.appendChild(
        intro
      );

    }


    const sections =
      Array.isArray(
        instruction?.sections
      )
        ?
          instruction.sections
        :
          [];


    sections.forEach(
      (
        section,
        index
      ) => {

        const h3 =
          document.createElement(
            "h3"
          );


        const number =
          section?.number ??
          index + 1;


        h3.textContent =
          `${number}. ${String(
            section?.heading ??
            ""
          )}`;


        article.appendChild(
          h3
        );


        const paragraphs =
          Array.isArray(
            section?.paragraphs
          )
            ?
              section.paragraphs
            :
              [];


        for (
          const paragraph
          of paragraphs
        ) {

          const text =
            paragraphText(
              paragraph
            ).trim();


          if (!text) {
            continue;
          }


          const p =
            document.createElement(
              "p"
            );


          p.textContent =
            text;


          article.appendChild(
            p
          );

        }

      }
    );


    modalContent
      .appendChild(
        article
      );


    modal.hidden =
      false;

    document.body.style.overflow =
      "hidden";

  }


  function closeInstruction() {

    if (!modal) {
      return;
    }


    modal.hidden =
      true;

    document.body.style.overflow =
      "";

  }


  async function openOrder(
    order
  ) {

    try {

      const data =
        await api(
          `/api/public-generation/my-orders/${encodeURIComponent(
            order.id
          )}`
        );


      if (!data?.instruction) {

        throw new Error(
          "Инструкция ещё не готова"
        );

      }


      renderInstruction(
        data.instruction
      );

    }
    catch(error) {

      window.alert(
        error?.message ||
        "Не удалось открыть инструкцию"
      );

    }

  }


  function renderOrders(
    orders
  ) {

    if (!ordersRoot) {
      return;
    }


    ordersRoot.replaceChildren();


    if (
      !Array.isArray(
        orders
      ) ||
      orders.length === 0
    ) {

      const empty =
        document.createElement(
          "div"
        );


      empty.className =
        "accountEmpty";

      empty.textContent =
        "У вас пока нет заказов.";


      ordersRoot.appendChild(
        empty
      );


      return;

    }


    for (
      const order
      of orders
    ) {

      const card =
        document.createElement(
          "article"
        );


      card.className =
        "orderCard";


      const main =
        document.createElement(
          "div"
        );


      const meta =
        document.createElement(
          "div"
        );


      meta.className =
        "orderCard__meta";

      meta.textContent =
        `${formatDate(
          order.createdAt
        )} · ${formatAmount(
          order.amount,
          order.currency
        )}`;


      const title =
        document.createElement(
          "h3"
        );


      title.className =
        "orderCard__profession";

      title.textContent =
        order.profession ||
        "Инструкция";


      const status =
        statusInfo(
          order.status
        );


      const badge =
        document.createElement(
          "div"
        );


      badge.className =
        [
          "orderCard__status",
          status.className
        ]
          .filter(
            Boolean
          )
          .join(" ");

      badge.textContent =
        status.text;


      main.append(
        meta,
        title,
        badge
      );


      const actions =
        document.createElement(
          "div"
        );


      actions.className =
        "orderCard__actions";


      const open =
        document.createElement(
          "button"
        );


      open.type =
        "button";

      open.className =
        "orderCard__button orderCard__button--primary";

      open.textContent =
        "Открыть";

      open.disabled =
        !isReady(
          order
        );


      open.addEventListener(
        "click",
        () =>
          openOrder(
            order
          )
      );


      const pdf =
        document.createElement(
          "button"
        );


      pdf.type =
        "button";

      pdf.className =
        "orderCard__button";

      pdf.textContent =
        "Скачать PDF";

      pdf.disabled =
        !isReady(
          order
        );


      pdf.addEventListener(
        "click",
        () =>
          downloadPdf(
            order
          )
      );


      actions.append(
        open,
        pdf
      );


      card.append(
        main,
        actions
      );


      ordersRoot.appendChild(
        card
      );

    }

  }


  async function start() {
    clearMessage();
    destroyCompanyProfile();
    accountAbortController?.abort();
    accountAbortController = new AbortController();
    const signal = accountAbortController.signal;
    const requestId = ++accountRequestId;
    const token = getToken();
    currentAccountToken = token;
    closeInstruction();

    if (!token) {
      if (profileRoot) profileRoot.textContent = 'Войдите или зарегистрируйтесь на сайте.';
      if (ordersRoot) ordersRoot.textContent = 'Чтобы увидеть свои инструкции, сначала войдите в аккаунт.';
      return;
    }
    if (profileRoot) profileRoot.textContent = 'Загружаем профиль…';
    if (ordersRoot) ordersRoot.textContent = 'Загружаем инструкции…';
    const options = { signal, headers: { Authorization: `Bearer ${token}` } };
    let me;
    try {
      me = await api('/api/auth/me', options);
      if (requestId !== accountRequestId || token !== getToken()) return;
      renderProfile(me?.user);
      void mountCompanyProfile(me?.user, token, requestId);
    } catch (error) {
      if (requestId !== accountRequestId || token !== getToken() || error.name === 'AbortError') return;
      if (error?.status === 401) expireSession(token);
      else showMessage(error?.message || 'Не удалось загрузить личный кабинет.');
      return;
    }

    try {
      const orders = await api('/api/public-generation/my-orders', options);
      if (requestId !== accountRequestId || token !== getToken()) return;
      renderOrders(orders?.items);
    } catch (error) {
      if (requestId !== accountRequestId || token !== getToken() || error.name === 'AbortError') return;
      if (error?.status === 401) expireSession(token);
      else {
        if (ordersRoot) ordersRoot.textContent = 'Не удалось загрузить инструкции. Обновите страницу, чтобы повторить.';
        showMessage(error?.message || 'Не удалось загрузить ваши инструкции.');
      }
    }
  }

  function refreshChangedSession() {
    if (getToken() !== currentAccountToken) void start();
  }

  window.addEventListener('storage', event => {
    if (event.key === TOKEN_KEY || event.key === null) refreshChangedSession();
  });
  window.addEventListener('focus', refreshChangedSession);
  window.addEventListener('pageshow', refreshChangedSession);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshChangedSession();
  });


  modalClose
    ?.addEventListener(
      "click",
      closeInstruction
    );


  modal
    ?.querySelector(
      ".instructionModal__overlay"
    )
    ?.addEventListener(
      "click",
      closeInstruction
    );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
          "Escape" &&
        modal &&
        !modal.hidden
      ) {

        closeInstruction();

      }

    }
  );


  start();

})();
