import {
  useEffect,
  useState
} from "react";

import {
  useDispatch,
  useSelector
} from "react-redux";

import {
  clearAuthError,
  login,
  register,
  selectAuthError,
  selectIsAuthenticating
} from "../../store/authSlice.js";

import styles from
  "./LoginModal.module.css";


export default function LoginModal({
  onClose
}) {
  const dispatch =
    useDispatch();

  const isAuthenticating =
    useSelector(
      selectIsAuthenticating
    );

  const error =
    useSelector(
      selectAuthError
    );

  const [
    mode,
    setMode
  ] =
    useState(
      "login"
    );

  const [
    loginValue,
    setLoginValue
  ] =
    useState("");

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
    password,
    setPassword
  ] =
    useState("");

  const [
    passwordConfirm,
    setPasswordConfirm
  ] =
    useState("");

  const [
    localError,
    setLocalError
  ] =
    useState("");


  useEffect(
    () => {
      function handleKeyDown(
        event
      ) {
        if (
          event.key ===
          "Escape"
        ) {
          onClose();
        }
      }

      document.addEventListener(
        "keydown",
        handleKeyDown
      );

      return () =>
        document.removeEventListener(
          "keydown",
          handleKeyDown
        );
    },
    [
      onClose
    ]
  );


  useEffect(
    () => {
      return () => {
        dispatch(
          clearAuthError()
        );
      };
    },
    [
      dispatch
    ]
  );


  function switchMode(
    nextMode
  ) {
    setMode(
      nextMode
    );

    setLocalError("");

    dispatch(
      clearAuthError()
    );
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setLocalError("");

    if (
      mode ===
      "register"
    ) {
      if (
        password !==
        passwordConfirm
      ) {
        setLocalError(
          "Пароли не совпадают"
        );

        return;
      }

      const ok =
        await dispatch(
          register({
            name:
              name.trim(),

            phone:
              phone.trim(),

            email,

            password,

            userAgreementAccepted,

            personalDataConsentAccepted,

            advertisingConsentAccepted
          })
        );

      if (ok) {
        onClose();
      }

      return;
    }

    const ok =
      await dispatch(
        login(
          loginValue,
          password
        )
      );

    if (ok) {
      onClose();
    }
  }


  const visibleError =
    localError ||
    error;


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

      </div>
    </div>
  );
}
