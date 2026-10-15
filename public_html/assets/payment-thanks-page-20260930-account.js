(() => {

  "use strict";


  const TOKEN_KEY =
    "boykovgroup_auth_token";


  const statusElement =
    document.getElementById(
      "thanks-status"
    );

  const professionElement =
    document.getElementById(
      "thanks-profession"
    );

  const resultRoot =
    document.getElementById(
      "thanks-instruction"
    );

  const modal =
    document.getElementById(
      "thanks-loading-modal"
    );

  const modalTitle =
    document.getElementById(
      "thanks-modal-title"
    );

  const modalText =
    document.getElementById(
      "thanks-modal-text"
    );

  const modalSpinner =
    document.getElementById(
      "thanks-modal-spinner"
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


  function sleep(
    milliseconds
  ) {

    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          milliseconds
        )
    );

  }


  function setStatus(
    text,
    type = ""
  ) {

    if (!statusElement) {
      return;
    }


    statusElement.textContent =
      text;

    statusElement.className =
      "thanksStatus";


    if (type) {

      statusElement.classList.add(
        `thanksStatus--${type}`
      );

    }

  }


  function setModal({
    title,
    text,
    spinning = true
  }) {

    if (!modal) {
      return;
    }


    modal.hidden =
      false;


    if (modalTitle) {

      modalTitle.textContent =
        title;

    }


    if (modalText) {

      modalText.textContent =
        text;

    }


    if (modalSpinner) {

      modalSpinner.hidden =
        !spinning;

    }

  }


  function hideModal() {

    if (modal) {

      modal.hidden =
        true;

    }

  }


  function createTextElement(
    tag,
    className,
    text
  ) {

    const element =
      document.createElement(
        tag
      );


    if (className) {

      element.className =
        className;

    }


    element.textContent =
      text;


    return element;

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


  function instructionTitle(
    instruction
  ) {

    return (
      instruction?.title ||
      (
        instruction?.profession
          ?
            `Инструкция по охране труда: ${instruction.profession}`
          :
            "Ваша инструкция"
      )
    );

  }


  async function downloadPdf(
    orderId
  ) {

    const response =
      await fetch(
        `/api/public-generation/my-orders/${encodeURIComponent(
          orderId
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
      `instruction-${orderId}.pdf`;


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


  function createDownloadButton(
    orderId
  ) {

    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";

    button.className =
      "thanksDownload";

    button.textContent =
      "Скачать PDF";


    button.addEventListener(
      "click",

      async () => {

        const oldText =
          button.textContent;


        button.disabled =
          true;

        button.textContent =
          "Формируем PDF...";


        try {

          await downloadPdf(
            orderId
          );

        }
        catch(error) {

          alert(
            error?.message ||
            "Не удалось скачать PDF"
          );

        }
        finally {

          button.disabled =
            false;

          button.textContent =
            oldText;

        }

      }
    );


    return button;

  }


  function renderInstruction(
    instruction,
    orderId
  ) {

    if (
      !instruction ||
      !resultRoot
    ) {
      return false;
    }


    resultRoot.replaceChildren();


    const article =
      document.createElement(
        "article"
      );


    article.className =
      "thanksDocument";

    article.dataset.copyProtected = "true";


    const top =
      document.createElement(
        "div"
      );


    top.className =
      "thanksDocument__top";


    const headingBox =
      document.createElement(
        "div"
      );


    headingBox.append(

      createTextElement(
        "div",
        "thanksDocument__eyebrow",
        "ДОКУМЕНТ ГОТОВ"
      ),

      createTextElement(
        "h2",
        "thanksDocument__title",
        instructionTitle(
          instruction
        )
      )

    );


    top.append(
      headingBox,
      createDownloadButton(
        orderId
      )
    );


    article.appendChild(
      top
    );


    if (
      instruction.intro
    ) {

      article.appendChild(
        createTextElement(
          "p",
          "thanksDocument__intro",
          String(
            instruction.intro
          )
        )
      );

    }


    const sections =
      Array.isArray(
        instruction.sections
      )
        ?
          instruction.sections
        :
          [];


    for (
      let index = 0;
      index < sections.length;
      index++
    ) {

      const section =
        sections[index];


      const sectionElement =
        document.createElement(
          "section"
        );


      sectionElement.className =
        "thanksDocument__section";


      const number =
        section?.number ??
        index + 1;


      const heading =
        String(
          section?.heading ??
          ""
        ).trim();


      if (heading) {

        sectionElement.appendChild(
          createTextElement(
            "h3",
            "thanksDocument__sectionTitle",
            `${number}. ${heading}`
          )
        );

      }


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


        sectionElement.appendChild(
          createTextElement(
            "p",
            "thanksDocument__paragraph",
            text
          )
        );

      }


      article.appendChild(
        sectionElement
      );

    }


    resultRoot.appendChild(
      article
    );


    hideModal();


    setStatus(
      "Инструкция готова. Она также сохранена в вашем личном кабинете.",
      "ready"
    );


    return true;

  }


  function renderLoginRequired() {

    hideModal();


    setStatus(
      "Чтобы получить оплаченный заказ, войдите в аккаунт.",
      "error"
    );


    if (!resultRoot) {
      return;
    }


    resultRoot.replaceChildren();


    const link =
      document.createElement(
        "a"
      );


    link.href =
      "/";

    link.className =
      "thanksDownload";

    link.textContent =
      "Войти / зарегистрироваться";


    resultRoot.appendChild(
      link
    );

  }


  async function getLatestPaidOrderId() {

    const response =
      await fetch(
        "/api/public-generation/my-orders",

        {
          headers:
            authHeaders(),

          cache:
            "no-store"
        }
      );


    if (
      response.status ===
        401
    ) {
      return {
        unauthorized:
          true
      };
    }


    if (!response.ok) {
      return null;
    }


    const data =
      await response
        .json()
        .catch(
          () => ({})
        );


    const first =
      Array.isArray(
        data?.items
      )
        ?
          data.items[0]
        :
          null;


    return first?.id
      ?
        {
          orderId:
            first.id
        }
      :
        null;

  }


  async function resolveOrderId() {

    const params =
      new URLSearchParams(
        window.location.search
      );


    const explicit =
      String(
        params.get(
          "orderId"
        ) ??
        ""
      ).trim();


    if (explicit) {

      return {
        orderId:
          explicit
      };

    }


    return null;

  }


  async function fetchOrder(
    orderId
  ) {

    return fetch(
      `/api/public-generation/my-orders/${encodeURIComponent(
        orderId
      )}`,

      {
        headers:
          authHeaders(),

        cache:
          "no-store"
      }
    );

  }


  async function start() {

    if (!getToken()) {

      renderLoginRequired();
      return;

    }


    const resolved =
      await resolveOrderId();


    if (
      resolved?.unauthorized
    ) {

      renderLoginRequired();
      return;

    }


    if (!resolved?.orderId) {

      hideModal();


      setStatus(
        "Не удалось найти оплаченный заказ в вашем аккаунте.",
        "error"
      );


      return;

    }


    const orderId =
      resolved.orderId;


    setModal({
      title:
        "Готовим вашу инструкцию",

      text:
        "Оплата подтверждена. Получаем заказ из вашего аккаунта.",

      spinning:
        true
    });


    setStatus(
      "Оплата прошла успешно. Получаем вашу инструкцию."
    );


    for (
      let attempt = 0;
      attempt < 450;
      attempt++
    ) {

      let response;


      try {

        response =
          await fetchOrder(
            orderId
          );

      }
      catch {

        await sleep(
          2000
        );

        continue;

      }


      if (
        response.status ===
          401
      ) {

        renderLoginRequired();
        return;

      }


      if (
        response.status ===
          404
      ) {

        hideModal();


        setStatus(
          "Этот заказ не найден в вашем аккаунте. Откройте личный кабинет или обратитесь в поддержку — повторно оплачивать заказ не нужно.",
          "error"
        );


        return;

      }


      if (!response.ok) {

        await sleep(
          2000
        );

        continue;

      }


      const order =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        professionElement &&
        order?.profession
      ) {

        professionElement.textContent =
          order.profession;

      }


      switch (
        order?.status
      ) {

        case "generated":
        case "published": {

          if (
            renderInstruction(
              order?.instruction,
              orderId
            )
          ) {

            return;

          }


          break;

        }


        case "paid":

          setModal({
            title:
              "Оплата подтверждена",

            text:
              "Запускаем подготовку инструкции."
          });

          break;


        case "moderating":

          setModal({
            title:
              "Обрабатываем заказ",

            text:
              "Проверяем данные перед формированием документа."
          });

          break;


        case "generating":

          setModal({
            title:
              "Готовим вашу инструкцию",

            text:
              "Документ формируется. Страница обновится автоматически."
          });

          break;


        case "manual_review":

          setModal({
            title:
              "Оплата подтверждена",

            text:
              "Заказ принят и требует дополнительной обработки.",

            spinning:
              false
          });

          return;


        case "refunding":
        case "refund_pending":

          setModal({
            title:
              "Оформляется возврат",

            text:
              "Оплата возвращается.",

            spinning:
              false
          });

          return;


        case "refunded":

          hideModal();


          setStatus(
            "Оплата возвращена.",
            "error"
          );


          return;


        default:

          break;

      }


      await sleep(
        2000
      );

    }


    setModal({
      title:
        "Заказ сохранён",

      text:
        "Подготовка инструкции продолжается. Заказ уже доступен в вашем личном кабинете.",

      spinning:
        false
    });

  }


  start();

})();
