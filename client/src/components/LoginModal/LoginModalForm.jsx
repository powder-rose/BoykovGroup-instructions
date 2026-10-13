import LoginRegistrationConsents
  from "./LoginRegistrationConsents.jsx";

import styles from
  "./LoginModal.module.css";


export default function LoginModalForm({

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

  handleSubmit

}) {

  return (

    <form
      onSubmit={
        handleSubmit
      }
      className={
        styles.form
      }
    >
      {
        mode ===
          "register" &&
        (
          <div
            className={
              styles.profileFields
            }
          >

            <label
              className={
                styles.profileField
              }
            >

              <span
                className={
                  styles.profileLabel
                }
              >
                Имя
              </span>

              <input
                className={
                  styles.profileInput
                }
                type="text"
                value={
                  name
                }
                onChange={
                  (event) =>
                    setName(
                      event.target.value
                    )
                }
                placeholder="Как к вам обращаться"
                autoComplete="name"
                required
                aria-required="true"
              />

            </label>


            <label
              className={
                styles.profileField
              }
            >

              <span
                className={
                  styles.profileLabel
                }
              >
                Телефон
              </span>

              <input
                className={
                  styles.profileInput
                }
                type="tel"
                value={
                  phone
                }
                onChange={
                  (event) =>
                    setPhone(
                      event.target.value
                    )
                }
                placeholder="+7 900 000-00-00"
                autoComplete="tel"
                required
                aria-required="true"
              />

            </label>

          </div>
        )
      }


      {mode ===
      "login" ? (
        <label
          className={
            styles.field
          }
        >
          <span
            className={
              styles.label
            }
          >
            Email или логин
          </span>

          <input
            className={
              styles.input
            }
            value={
              loginValue
            }
            onChange={
              (event) =>
                setLoginValue(
                  event.target
                    .value
                )
            }
            autoFocus
            autoComplete="username"
            required
          />
        </label>
      ) : (
        <label
          className={
            styles.field
          }
        >
          <span
            className={
              styles.label
            }
          >
            Email
          </span>

          <input
            className={
              styles.input
            }
            type="email"
            value={
              email
            }
            onChange={
              (event) =>
                setEmail(
                  event.target
                    .value
                )
            }
            autoFocus
            autoComplete="email"
            required
          />
        </label>
      )}

      <label
        className={
          styles.field
        }
      >
        <span
          className={
            styles.label
          }
        >
          Пароль
        </span>

        <input
          className={
            styles.input
          }
          type="password"
          value={
            password
          }
          onChange={
            (event) =>
              setPassword(
                event.target
                  .value
              )
          }
          minLength={
            mode ===
            "register"
              ? 8
              : undefined
          }
          autoComplete={
            mode ===
            "register"
              ? "new-password"
              : "current-password"
          }
          required
        />
      </label>

      {mode ===
        "register" && (
        <label
          className={
            styles.field
          }
        >
          <span
            className={
              styles.label
            }
          >
            Повторите пароль
          </span>

          <input
            className={
              styles.input
            }
            type="password"
            value={
              passwordConfirm
            }
            onChange={
              (event) =>
                setPasswordConfirm(
                  event.target
                    .value
                )
            }
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
      )}

      {mode ===
        "register" && (
        <p
          className={
            styles.hint
          }
        >
          Минимум 8 символов.
          Пароль хранится
          в зашифрованном виде.
        </p>
      )}

      {visibleError && (
        <p
          className={
            styles.error
          }
        >
          {visibleError}
        </p>
      )}

      {
        mode ===
          "register" &&
        (
          <LoginRegistrationConsents
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
          />
        )
      }


      <button
        type="submit"
        className={
          styles.submit
        }
        disabled={
          isAuthenticating
        }
      >
        {isAuthenticating
          ? mode ===
            "register"
            ? "Создаём..."
            : "Проверяем..."
          : mode ===
            "register"
            ? "Зарегистрироваться"
            : "Войти"}
      </button>
    </form>

  );

}
