import "./PdfRegistrationModal.css";


const ADVERTISING_NOTE =
  "Предоставление настоящего Согласия является добровольным и не является обязательным условием регистрации на Сайте, использования личного кабинета, оформления Заказа, оплаты или получения услуг.";


export default function PdfRegistrationForm({

  name,
  setName,

  phone,
  setPhone,

  email,
  setEmail,

  password,
  setPassword,

  userAgreementAccepted,
  setUserAgreementAccepted,

  personalDataConsentAccepted,
  setPersonalDataConsentAccepted,

  advertisingConsentAccepted,
  setAdvertisingConsentAccepted,

  busy,
  registered,
  status,

  nameInputRef,
  handleSubmit

}) {

  return (

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

  );

}
