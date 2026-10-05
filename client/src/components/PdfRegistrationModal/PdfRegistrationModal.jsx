import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  register as registerUser
} from "../../api/authApi.js";

import "./PdfRegistrationModal.css";


const USER_TOKEN_KEY =
  "boykovgroup_auth_token";


const ADVERTISING_NOTE =
  "Предоставление настоящего Согласия является добровольным и не является обязательным условием регистрации на Сайте, использования личного кабинета, оформления Заказа, оплаты или получения услуг.";


export default function PdfRegistrationModal({
  onClose
}) {

  const [
    name,
    setName
  ] =
    useState("");

  const [
    phone,
    setPhone
  ] =
    useState("");

  const [
    email,
    setEmail
  ] =
    useState("");

  const [
    password,
    setPassword
  ] =
    useState("");

  const [
    userAgreementAccepted,
    setUserAgreementAccepted
  ] =
    useState(false);

  const [
    personalDataConsentAccepted,
    setPersonalDataConsentAccepted
  ] =
    useState(false);

  const [
    advertisingConsentAccepted,
    setAdvertisingConsentAccepted
  ] =
    useState(false);

  const [
    busy,
    setBusy
  ] =
    useState(false);

  const [
    registered,
    setRegistered
  ] =
    useState(false);

  const [
    status,
    setStatus
  ] =
    useState({
      text:
        "",

      type:
        ""
    });


  const registeredRef =
    useRef(false);

  const closeTimerRef =
    useRef(null);

  const nameInputRef =
    useRef(null);


  /*
   * Production сохраняет старый overflow,
   * блокирует body и возвращает его при закрытии.
   */
  useEffect(() => {

    const previousOverflow =
      document.body.style
        .overflow;


    document.body.style
      .overflow =
      "hidden";


    const focusTimer =
      window.setTimeout(
        () => {

          nameInputRef.current
            ?.focus();

        },
        120
      );


    return () => {

      document.body.style
        .overflow =
        previousOverflow;


      window.clearTimeout(
        focusTimer
      );


      if (
        closeTimerRef.current
      ) {

        window.clearTimeout(
          closeTimerRef.current
        );

      }

    };

  }, []);


  /*
   * Escape закрывает modal.
   * Если регистрация уже завершена —
   * production после закрытия reload'ит страницу.
   */
  useEffect(() => {

    function handleKeyDown(
      event
    ) {

      if (
        event.key ===
        "Escape"
      ) {

        closeModal();

      }

    }


    document.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  }, []);


  function closeModal() {

    const reloadAfter =
      registeredRef.current;


    onClose();


    if (reloadAfter) {

      window.setTimeout(
        () => {

          window.location.reload();

        },
        0
      );

    }

  }


  async function handleSubmit(
    event
  ) {

    event.preventDefault();


    if (
      busy ||
      registered
    ) {
      return;
    }


    setBusy(
      true
    );


    setStatus({
      text:
        "",

      type:
        ""
    });


    try {

      const data =
        await registerUser({
          name:
            name.trim(),

          phone:
            phone.trim(),

          email:
            email.trim(),

          password,

          userAgreementAccepted,

          personalDataConsentAccepted,

          advertisingConsentAccepted
        });


      if (
        data?.token
      ) {

        window.localStorage
          .setItem(
            USER_TOKEN_KEY,
            data.token
          );

      }


      registeredRef.current =
        true;


      setRegistered(
        true
      );


      setStatus({
        type:
          "success",

        text:
          data?.verificationEmailSent ===
            false
            ? "Регистрация завершена."
            : "Регистрация завершена. Подтвердите e-mail по ссылке из письма."
      });


      closeTimerRef.current =
        window.setTimeout(
          () => {

            onClose();


            window.location.reload();

          },
          1800
        );

    }
    catch(error) {

      setBusy(
        false
      );


      setStatus({
        type:
          "error",

        text:
          error?.message ||
          "Не удалось зарегистрироваться"
      });

    }

  }


  function handleOverlayClick(
    event
  ) {

    if (
      event.target ===
      event.currentTarget
    ) {

      closeModal();

    }

  }


  return (
    <div
      id="boykov-pdf-registration-modal"
      className="boykovPdfRegistration"
      onMouseDown={
        handleOverlayClick
      }
    >

      <div
        className="boykovPdfRegistration__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="boykov-pdf-registration-title"
      >

        <button
          type="button"
          className="boykovPdfRegistration__close"
          aria-label="Закрыть"
          onClick={
            closeModal
          }
        >
          ×
        </button>


        <div
          className="boykovPdfRegistration__eyebrow"
        >
          PDF
        </div>


        <h2
          id="boykov-pdf-registration-title"
          className="boykovPdfRegistration__title"
        >
          Регистрация
        </h2>


        <p
          className="boykovPdfRegistration__description"
        >
          Зарегистрируйтесь, чтобы скачать инструкцию в PDF.
        </p>


        <form
          className="boykovPdfRegistration__form"
          data-boykov-profile="1"
          data-boykov-registration-consents="1"
          onSubmit={
            handleSubmit
          }
        >

          <div
            className="boykovProfileFields"
          >

            <label
              className="boykovProfileField"
            >

              <span
                className="boykovProfileField__label"
              >
                Имя
              </span>


              <input
                ref={
                  nameInputRef
                }
                id="boykov-registration-name"
                className="boykovProfileField__input"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Как к вам обращаться"
                required
                aria-required="true"
                value={
                  name
                }
                onChange={
                  event =>
                    setName(
                      event.target.value
                    )
                }
              />

            </label>


            <label
              className="boykovProfileField"
            >

              <span
                className="boykovProfileField__label"
              >
                Телефон
              </span>


              <input
                id="boykov-registration-phone"
                className="boykovProfileField__input"
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="+7 900 000-00-00"
                required
                aria-required="true"
                value={
                  phone
                }
                onChange={
                  event =>
                    setPhone(
                      event.target.value
                    )
                }
              />

            </label>

          </div>


          <label
            className="boykovPdfRegistration__field"
          >

            <span
              className="boykovPdfRegistration__label"
            >
              Email
            </span>


            <input
              className="boykovPdfRegistration__input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="name@example.ru"
              required
              value={
                email
              }
              onChange={
                event =>
                  setEmail(
                    event.target.value
                  )
              }
            />

          </label>


          <label
            className="boykovPdfRegistration__field"
          >

            <span
              className="boykovPdfRegistration__label"
            >
              Пароль
            </span>


            <input
              className="boykovPdfRegistration__input"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Введите пароль"
              minLength="8"
              required
              value={
                password
              }
              onChange={
                event =>
                  setPassword(
                    event.target.value
                  )
              }
            />

          </label>


          <div
            className="boykovRegistrationConsents"
          >

            <label
              className="
                boykovRegistrationConsent
                boykovRegistrationConsent--required
              "
            >

              <input
                id="boykov-registration-user-agreement"
                className="boykovRegistrationConsent__checkbox"
                type="checkbox"
                required
                checked={
                  userAgreementAccepted
                }
                onChange={
                  event =>
                    setUserAgreementAccepted(
                      event.target.checked
                    )
                }
              />


              <span
                className="boykovRegistrationConsent__content"
              >

                <a
                  className="boykovRegistrationConsent__link"
                  href="/user-agreement/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Пользовательское соглашение
                </a>

              </span>

            </label>


            <label
              className="
                boykovRegistrationConsent
                boykovRegistrationConsent--required
              "
            >

              <input
                id="boykov-registration-personal-data"
                className="boykovRegistrationConsent__checkbox"
                type="checkbox"
                required
                checked={
                  personalDataConsentAccepted
                }
                onChange={
                  event =>
                    setPersonalDataConsentAccepted(
                      event.target.checked
                    )
                }
              />


              <span
                className="boykovRegistrationConsent__content"
              >

                <a
                  className="boykovRegistrationConsent__link"
                  href="/personal-data-consent/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Согласие на обработку персональных данных
                </a>

              </span>

            </label>


            <div
              className="boykovRegistrationConsentOptional"
            >

              <label
                className="boykovRegistrationConsent"
              >

                <input
                  id="boykov-registration-advertising"
                  className="boykovRegistrationConsent__checkbox"
                  type="checkbox"
                  checked={
                    advertisingConsentAccepted
                  }
                  onChange={
                    event =>
                      setAdvertisingConsentAccepted(
                        event.target.checked
                      )
                  }
                />


                <span
                  className="boykovRegistrationConsent__content"
                >

                  <a
                    className="boykovRegistrationConsent__link"
                    href="/advertising-consent/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Согласие на получение рекламных и информационных сообщений
                  </a>

                </span>

              </label>


              <div
                className="boykovRegistrationConsent__note"
              >
                {ADVERTISING_NOTE}
              </div>

            </div>

          </div>


          <button
            type="submit"
            className="boykovPdfRegistration__submit"
            disabled={
              busy ||
              registered
            }
          >
            {
              registered
                ? "Готово"
                : busy
                  ? "Регистрируем..."
                  : "Зарегистрироваться"
            }
          </button>


          <div
            className={[
              "boykovPdfRegistration__status",

              status.type ===
                "success"
                ? "boykovPdfRegistration__status--success"
                : "",

              status.type ===
                "error"
                ? "boykovPdfRegistration__status--error"
                : ""
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
          >
            {status.text}
          </div>

        </form>

      </div>

    </div>
  );

}
