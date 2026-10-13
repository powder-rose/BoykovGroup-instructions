import LoginModalForm
  from "./LoginModalForm.jsx";

import useLoginModal
  from "./hooks/useLoginModal.js";

import styles from
  "./LoginModal.module.css";


export default function LoginModal({
  onClose
}) {
  const {
    mode,
    loginValue,
    setLoginValue,
    name,
    setName,
    phone,
    setPhone,
    email,
    setEmail,

    userAgreementAccepted,
    setUserAgreementAccepted,

    personalDataConsentAccepted,
    setPersonalDataConsentAccepted,

    advertisingConsentAccepted,
    setAdvertisingConsentAccepted,

    password,
    setPassword,
    passwordConfirm,
    setPasswordConfirm,

    isAuthenticating,
    visibleError,

    switchMode,
    handleSubmit
  } =
    useLoginModal({
      onClose
    });


  return (
    <div
      className={
        styles.overlay
      }
      onClick={
        onClose
      }
    >
      <div
        className={
          styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-label={
          mode === "login"
            ? "Вход"
            : "Регистрация"
        }
        onClick={
          (event) =>
            event.stopPropagation()
        }
      >
        <button
          type="button"
          className={
            styles.close
          }
          onClick={
            onClose
          }
          aria-label="Закрыть"
        >
          ×
        </button>

        <span
          className={
            styles.eyebrow
          }
        >
          //
          {mode === "login"
            ? " авторизация"
            : " регистрация"}
        </span>

        <h2
          className={
            styles.title
          }
        >
          {mode === "login"
            ? "Вход"
            : "Создать аккаунт"}
        </h2>

        <div
          className={
            styles.tabs
          }
          role="tablist"
        >
          <button
            type="button"
            className={[
              styles.tab,
              mode === "login"
                ? styles.tabActive
                : ""
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={
              () =>
                switchMode(
                  "login"
                )
            }
          >
            Вход
          </button>

          <button
            type="button"
            className={[
              styles.tab,
              mode ===
                "register"
                ? styles.tabActive
                : ""
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={
              () =>
                switchMode(
                  "register"
                )
            }
          >
            Регистрация
          </button>
        </div>

        <LoginModalForm
          mode={
            mode
          }
          loginValue={
            loginValue
          }
          setLoginValue={
            setLoginValue
          }
          name={
            name
          }
          setName={
            setName
          }
          phone={
            phone
          }
          setPhone={
            setPhone
          }
          email={
            email
          }
          setEmail={
            setEmail
          }
          userAgreementAccepted={
            userAgreementAccepted
          }
          setUserAgreementAccepted={
            setUserAgreementAccepted
          }
          personalDataConsentAccepted={
            personalDataConsentAccepted
          }
          setPersonalDataConsentAccepted={
            setPersonalDataConsentAccepted
          }
          advertisingConsentAccepted={
            advertisingConsentAccepted
          }
          setAdvertisingConsentAccepted={
            setAdvertisingConsentAccepted
          }
          password={
            password
          }
          setPassword={
            setPassword
          }
          passwordConfirm={
            passwordConfirm
          }
          setPasswordConfirm={
            setPasswordConfirm
          }
          isAuthenticating={
            isAuthenticating
          }
          visibleError={
            visibleError
          }
          handleSubmit={
            handleSubmit
          }
        />

      </div>
    </div>
  );
}
