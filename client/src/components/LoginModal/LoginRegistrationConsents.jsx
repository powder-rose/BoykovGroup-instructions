import styles from
  "./LoginModal.module.css";


export default function LoginRegistrationConsents({

  userAgreementAccepted,
  setUserAgreementAccepted,

  personalDataConsentAccepted,
  setPersonalDataConsentAccepted,

  advertisingConsentAccepted,
  setAdvertisingConsentAccepted

}) {

  return (
    <div
      className={
        styles.registrationConsents
      }
    >

      <label
        className={[
          styles.registrationConsent,
          styles.registrationConsentRequired
        ]
          .filter(Boolean)
          .join(" ")}
      >

        <input
          className={
            styles.registrationConsentCheckbox
          }
          type="checkbox"
          checked={
            userAgreementAccepted
          }
          onChange={
            (event) =>
              setUserAgreementAccepted(
                event.target.checked
              )
          }
          required
        />

        <span
          className={
            styles.registrationConsentContent
          }
        >
          <a
            className={
              styles.registrationConsentLink
            }
            href="/user-agreement/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Пользовательское соглашение
          </a>
        </span>

      </label>


      <label
        className={[
          styles.registrationConsent,
          styles.registrationConsentRequired
        ]
          .filter(Boolean)
          .join(" ")}
      >

        <input
          className={
            styles.registrationConsentCheckbox
          }
          type="checkbox"
          checked={
            personalDataConsentAccepted
          }
          onChange={
            (event) =>
              setPersonalDataConsentAccepted(
                event.target.checked
              )
          }
          required
        />

        <span
          className={
            styles.registrationConsentContent
          }
        >
          <a
            className={
              styles.registrationConsentLink
            }
            href="/personal-data-consent/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Согласие на обработку персональных данных
          </a>
        </span>

      </label>


      <div
        className={
          styles.registrationConsentOptional
        }
      >

        <label
          className={
            styles.registrationConsent
          }
        >

          <input
            className={
              styles.registrationConsentCheckbox
            }
            type="checkbox"
            checked={
              advertisingConsentAccepted
            }
            onChange={
              (event) =>
                setAdvertisingConsentAccepted(
                  event.target.checked
                )
            }
          />

          <span
            className={
              styles.registrationConsentContent
            }
          >
            <a
              className={
                styles.registrationConsentLink
              }
              href="/advertising-consent/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Согласие на получение рекламных и информационных сообщений
            </a>
          </span>

        </label>


        <div
          className={
            styles.registrationConsentNote
          }
        >
          Предоставление настоящего Согласия является добровольным и не является обязательным условием регистрации на Сайте, использования личного кабинета, оформления Заказа, оплаты или получения услуг.
        </div>

      </div>

    </div>
  );

}
