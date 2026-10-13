import {
  formatAmount
} from "./urgentGenerationUtils.js";

import styles
  from "./UrgentGenerationPage.module.css";


export default function UrgentGenerationOrderSection({

  profession,
  setProfession,

  promoInput,
  promoMessage,
  promoMessageType,
  isPromoChecking,

  handlePromoApply,
  handlePromoInputChange,

  displayOriginalAmount,
  displayAmount,
  hasPromoDiscount,

  isPaying,
  error,
  setError,

  isPaymentComplete,
  paymentMessage,

  offerAccepted,
  setOfferAccepted,

  personalDataAccepted,
  setPersonalDataAccepted,

  consentError,
  setConsentError,

  handleSubmit

}) {

  return (

    <section
      className={
        styles.orderSection
      }
    >

      <div
        className={
          styles.orderIntro
        }
      >

        <div>

          <h2
            className={
              styles.orderTitle
            }
          >
            Укажите профессию или вид работ
          </h2>


          <p
            className={
              styles.orderText
            }
          >
            Напишите точное название
            профессии, должности
            или вида работ, для которых
            необходима инструкция.
          </p>

        </div>

      </div>


      <form
        className={
          styles.form
        }
        onSubmit={
          handleSubmit
        }
      >

        <label
          className={
            styles.label
          }
          htmlFor="urgent-profession"
        >
          Профессия или вид работ
        </label>


        <input
          id="urgent-profession"
          className={
            styles.input
          }
          type="text"
          value={
            profession
          }
          onChange={
            (event) => {
              setProfession(
                event.target.value
              );

              setError("");
            }
          }
          placeholder="Например: электромонтёр или при работе на высоте"
          autoComplete="off"
          maxLength={180}
        />


        <div
          className={
            styles.generationScopeHint
          }
        >
          <span>
            Можно указать:
          </span>{" "}

          <strong>
            профессию
          </strong>{" "}

          <span>
            или
          </span>{" "}

          <strong>
            конкретный вид работ
          </strong>

          <span
            className={
              styles.generationScopeExamples
            }
          >
            Например: водитель погрузчика · при работе на высоте · при эксплуатации электрооборудования
          </span>
        </div>


        <div
          className={
            styles.promoCheckout
          }
        >

          <label
            className={
              styles.promoLabel
            }
            htmlFor="urgent-promo-code"
          >
            Промокод
          </label>


          <div
            className={
              styles.promoRow
            }
          >

            <input
              id="urgent-promo-code"
              className={
                styles.promoInput
              }
              type="text"
              value={
                promoInput
              }
              placeholder="Введите промокод"
              autoComplete="off"
              maxLength={40}
              spellCheck={false}
              onChange={
                (event) =>
                  handlePromoInputChange(
                    event.target.value
                  )
              }
              onKeyDown={
                (event) => {

                  if (
                    event.key ===
                      "Enter"
                  ) {

                    event.preventDefault();

                    void handlePromoApply();

                  }

                }
              }
            />


            <button
              type="button"
              className={
                styles.promoButton
              }
              disabled={
                isPromoChecking
              }
              onClick={
                () => {
                  void handlePromoApply();
                }
              }
            >
              {
                isPromoChecking
                  ? "Проверяем..."
                  : "Применить"
              }
            </button>

          </div>


          <div
            className={[
              styles.promoMessage,

              promoMessageType ===
                "success"
                ? styles.promoMessageSuccess
                : "",

              promoMessageType ===
                "error"
                ? styles.promoMessageError
                : ""
            ]
              .filter(Boolean)
              .join(" ")}
            aria-live="polite"
          >
            {promoMessage}
          </div>

        </div>


        <div
          className={
            styles.summary
          }
        >

          <span>
            Срочная инструкция
          </span>

          <strong>
            {
              hasPromoDiscount
                ? (
                    <span
                      className={
                        styles.promoPrice
                      }
                    >
                      <span
                        className={
                          styles.promoPriceOld
                        }
                      >
                        {formatAmount(
                          displayOriginalAmount
                        )} ₽
                      </span>

                      <span
                        className={
                          styles.promoPriceNew
                        }
                      >
                        {formatAmount(
                          displayAmount
                        )} ₽
                      </span>
                    </span>
                  )
                : `${formatAmount(
                    displayAmount
                  )} ₽`
            }
          </strong>

        </div>


        {error && (
          <div
            className={
              styles.error
            }
          >
            {error}
          </div>
        )}


        {isPaymentComplete && (
          <div
            className={
              styles.success
            }
          >
            {
                paymentMessage ||
                "Проверяем состояние заказа..."
              }
          </div>
        )}


        <div
          className={
            styles.paymentConsents
          }
        >

          <div
            className={
              styles.paymentConsentsHeading
            }
          >
            Перед оплатой
          </div>


          <div
            className={
              styles.paymentConsentRows
            }
          >

            <label
              className={
                styles.paymentConsentRow
              }
            >

              <input
                type="checkbox"
                className={
                  styles.paymentConsentCheckbox
                }
                checked={
                  personalDataAccepted
                }
                onChange={
                  (event) => {

                    setPersonalDataAccepted(
                      event.target.checked
                    );

                    setConsentError("");

                  }
                }
              />

              <span
                className={
                  styles.paymentConsentBox
                }
              />

              <span
                className={
                  styles.paymentConsentText
                }
              >
                Я даю{" "}
                <a
                  href="/personal-data-consent/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  согласие на обработку персональных данных
                </a>
                .
              </span>

            </label>


            <label
              className={
                styles.paymentConsentRow
              }
            >

              <input
                type="checkbox"
                className={
                  styles.paymentConsentCheckbox
                }
                checked={
                  offerAccepted
                }
                onChange={
                  (event) => {

                    setOfferAccepted(
                      event.target.checked
                    );

                    setConsentError("");

                  }
                }
              />

              <span
                className={
                  styles.paymentConsentBox
                }
              />

              <span
                className={
                  styles.paymentConsentText
                }
              >
                Я ознакомился и принимаю условия{" "}
                <a
                  href="/offer/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Публичной оферты
                </a>
                .
              </span>

            </label>

          </div>


          <p
            className={
              styles.paymentConsentNote
            }
          >
            Оба согласия обязательны для перехода к оплате.
          </p>


          {
            consentError &&
            (
              <p
                className={
                  styles.paymentConsentError
                }
              >
                {consentError}
              </p>
            )
          }

        </div>


        <button
          type="submit"
          className={
            styles.submit
          }
          disabled={
            isPaying ||
            isPaymentComplete ||
            !offerAccepted ||
            !personalDataAccepted
          }
        >
          {
            isPaying
              ? "Открываем оплату..."
              : isPaymentComplete
                ? "Оплачено"
                : "Заказать инструкцию"
          }
        </button>


        <p
          className={
            styles.paymentNote
          }
        >
          Сумма оплаты:
          {" "}
          <strong>
            {formatAmount(
              displayAmount
            )} российских рублей
          </strong>
        </p>

      </form>

    </section>

  );

}
