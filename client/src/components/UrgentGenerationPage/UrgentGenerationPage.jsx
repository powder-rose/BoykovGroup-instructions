import {
  useLayoutEffect,
  useState
} from "react";

import {
  Link,
  useNavigate
} from "react-router-dom";

import Header from "../Header/Header.jsx";
import Navigation from "../Navigation/Navigation.jsx";
import HeroPortrait from "../HeroPortrait/HeroPortrait.jsx";

import SEO
  from "../SEO/SEO.jsx";

import {
  loadCloudPayments
} from "../../lib/cloudPayments.js";

import styles
  from "./UrgentGenerationPage.module.css";


function normalizePromoCode(value) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();

}


function formatAmount(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "";

  }


  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        2
    }
  ).format(
    number
  );

}


function getUserAuthToken() {

  try {

    const token =
      window.localStorage
        .getItem(
          "boykovgroup_auth_token"
        );


    return token
      ? String(
          token
        )
      : null;

  }
  catch {

    return null;

  }

}


export default function UrgentGenerationPage() {

  const navigate =
    useNavigate();

  const [
    profession,
    setProfession
  ] = useState("");

  const [
    headerQuery,
    setHeaderQuery
  ] = useState("");

  const [
    isPaying,
    setIsPaying
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  const [
    isPaymentComplete,
    setIsPaymentComplete
  ] = useState(false);

  const [
    paymentMessage,
    setPaymentMessage
  ] = useState("");


  /*
   * PAYMENT CONSENTS
   *
   * Эти состояния раньше добавлялись поверх
   * production bundle отдельным DOM-patch.
   * Теперь это обычное React-состояние.
   */
  const [
    offerAccepted,
    setOfferAccepted
  ] = useState(false);

  const [
    personalDataAccepted,
    setPersonalDataAccepted
  ] = useState(false);

  const [
    consentError,
    setConsentError
  ] = useState("");


  /*
   * PROMO CODE CHECKOUT
   *
   * Раньше этот слой внедрялся отдельным
   * production JS поверх React.
   */
  const [
    promoInput,
    setPromoInput
  ] = useState("");

  const [
    appliedPromo,
    setAppliedPromo
  ] = useState(null);

  const [
    promoMessage,
    setPromoMessage
  ] = useState("");

  const [
    promoMessageType,
    setPromoMessageType
  ] = useState("");

  const [
    isPromoChecking,
    setIsPromoChecking
  ] = useState(false);


  /*
   * ==========================================================
   * URGENT PAGE SCROLL RESET
   * ==========================================================
   *
   * React Router сохраняет scroll позиции
   * предыдущего route. Для коммерческой страницы
   * всегда начинаем с первого экрана.
   */
  useLayoutEffect(() => {

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto"
    });


    /*
     * Дополнительно сбрасываем scroll у document,
     * чтобы поведение было одинаковым
     * во всех браузерах.
     */
    document.documentElement.scrollTop =
      0;

    document.body.scrollTop =
      0;


    /*
     * LEGACY ORDER STORAGE CLEANUP
     *
     * Старое восстановление заказа больше
     * не используется. Удаляем оставшиеся
     * ключи у пользователей после обновления.
     */
    try {

      window.sessionStorage.removeItem(
        "boykovgroup_urgent_generation_order_v1"
      );

      window.sessionStorage.removeItem(
        "boykovdocs_thanks_order_v1"
      );

    }
    catch {
      /* storage может быть недоступен */
    }

  }, []);




  async function handlePromoApply() {

    const code =
      normalizePromoCode(
        promoInput
      );


    if (!code) {

      setAppliedPromo(
        null
      );

      setPromoMessageType(
        "error"
      );

      setPromoMessage(
        "Введите промокод."
      );

      return;
    }


    setIsPromoChecking(
      true
    );

    setPromoMessage(
      ""
    );

    setPromoMessageType(
      ""
    );


    try {

      const response =
        await fetch(
          "/api/promo-codes/validate",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                code
              })
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok ||
        data?.ok !== true
      ) {

        setAppliedPromo(
          null
        );

        setPromoMessageType(
          "error"
        );

        setPromoMessage(
          data?.error ||
          "Промокод не подходит."
        );

        return;
      }


      const promo = {
        code:
          normalizePromoCode(
            data?.promo?.code ||
            code
          ),

        originalAmount:
          Number(
            data.originalAmount
          ),

        amount:
          Number(
            data.amount
          ),

        discountAmount:
          Number(
            data.discountAmount
          )
      };


      setAppliedPromo(
        promo
      );

      setPromoInput(
        promo.code
      );

      setPromoMessageType(
        "success"
      );

      setPromoMessage(
        `Промокод ${promo.code} применён. Скидка ${formatAmount(
          promo.discountAmount
        )} ₽.`
      );

    }
    catch {

      setAppliedPromo(
        null
      );

      setPromoMessageType(
        "error"
      );

      setPromoMessage(
        "Не удалось проверить промокод. Попробуйте ещё раз."
      );

    }
    finally {

      setIsPromoChecking(
        false
      );

    }

  }


  async function handleSubmit(event) {

    event.preventDefault();

    setError("");
    setPaymentMessage("");
    setConsentError("");


    if (
      !offerAccepted ||
      !personalDataAccepted
    ) {

      setConsentError(
        "Для перехода к оплате отметьте оба обязательных согласия."
      );

      return;
    }


    const normalizedProfession =
      profession.trim();


    if (
      normalizedProfession.length < 2
    ) {

      setError(
        "Укажите профессию, для которой нужна инструкция."
      );

      return;
    }


    setIsPaying(
      true
    );


    try {

      const orderResponse =
        await fetch(
          "/api/public-generation/orders",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              ...(
                getUserAuthToken()
                  ? {
                      Authorization:
                        `Bearer ${getUserAuthToken()}`
                    }
                  : {}
              )
            },

            body:
              JSON.stringify({
                profession:
                  normalizedProfession,

                offerAccepted:
                  true,

                personalDataConsentAccepted:
                  true,

                ...(
                  appliedPromo?.code
                    ? {
                        promoCode:
                          appliedPromo.code
                      }
                    : {}
                )
              })
          }
        );


      const order =
        await orderResponse
          .json()
          .catch(
            () => ({})
          );


      /*
       * Уже опубликованную инструкцию
       * повторно не продаём.
       */
      if (
        orderResponse.status === 409 &&
        order?.existingInstructionId
      ) {

        navigate(
          `/instrukciya-po-ohrane-truda/${encodeURIComponent(
            order.existingInstructionId
          )}`
        );

        return;
      }


      if (!orderResponse.ok) {

        throw new Error(
          order?.error ||
          order?.message ||
          "Не удалось создать заказ."
        );
      }


      const {
        orderId,
        orderToken,
        externalId,
        publicTerminalId,
        amount,
        currency
      } = order;


      if (
        !orderId ||
        !orderToken ||
        !publicTerminalId ||
        !Number.isFinite(
          Number(amount)
        ) ||
        Number(amount) <= 0 ||
        !currency
      ) {

        throw new Error(
          "Сервер вернул неполные данные платежа."
        );
      }


      const cp =
        await loadCloudPayments();


      const widget =
        new cp.CloudPayments();


      const widgetResult =
        await widget.start({

          publicTerminalId,

          description:
            `Срочная инструкция по охране труда: ${normalizedProfession}`,

          paymentSchema:
            "Single",

          amount:
            Number(amount),

          currency,

          culture:
            "ru-RU",

          skin:
            "classic",

          externalId:
            externalId ||
            orderId,

          successRedirectUrl:
            `https://boykovdocs.ru/thanks/?orderId=${encodeURIComponent(
              orderId
            )}`,

          failRedirectUrl:
            "https://boykovdocs.ru/srochnaya-generaciya-instrukcii"

        });


      if (
        widgetResult?.status !==
          "success" ||
        !widgetResult?.data
          ?.transactionId
      ) {

        throw new Error(
          widgetResult?.message ||
          "Оплата не завершена."
        );
      }


      const transactionId =
        String(
          widgetResult
            .data
            .transactionId
        );


      setIsPaymentComplete(
        true
      );

      setPaymentMessage(
        "Платёж выполнен. Проверяем транзакцию в CloudPayments..."
      );


      let paymentConfirmed =
        false;


      /*
       * После оплаты транзакция может появиться
       * в API CloudPayments с небольшой задержкой.
       */
      for (
        let attempt = 0;
        attempt < 8;
        attempt += 1
      ) {

        let confirmResponse;


        try {

          confirmResponse =
            await fetch(
              `/api/public-generation/orders/${encodeURIComponent(
                orderId
              )}/confirm-payment`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  "x-order-token":
                    orderToken
                },

                body:
                  JSON.stringify({
                    transactionId
                  })
              }
            );

        }
        catch {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                2000
              )
          );

          continue;
        }


        const confirmData =
          await confirmResponse
            .json()
            .catch(
              () => ({})
            );


        if (
          confirmResponse.ok
        ) {

          paymentConfirmed =
            true;

          break;
        }


        const canRetry =
          confirmResponse.status ===
            502 ||
          confirmResponse.status ===
            429 ||
          (
            confirmResponse.status ===
              409 &&
            String(
              confirmData?.error ??
              ""
            )
              .includes(
                "пока не подтвердил"
              )
          );


        if (!canRetry) {

          console.error(
            "[UrgentGeneration] payment confirmation rejected:",
            confirmResponse.status,
            confirmData
          );

          break;
        }


        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              2000
            )
        );
      }


      if (!paymentConfirmed) {

        setPaymentMessage(
          "Платёж выполнен, но автоматическое подтверждение пока не получено. Повторно оплачивать не нужно."
        );

        return;
      }


      window.location.replace(
        `/thanks/?orderId=${encodeURIComponent(
          orderId
        )}`
      );

      return;

    }
    catch (paymentError) {

      setError(
        paymentError?.message ||
        "Оплата не завершена."
      );

    }
    finally {

      setIsPaying(
        false
      );

    }

  }


  const baseAmount =
    500;


  const displayOriginalAmount =
    Number.isFinite(
      appliedPromo?.originalAmount
    )
      ? appliedPromo.originalAmount
      : baseAmount;


  const displayAmount =
    Number.isFinite(
      appliedPromo?.amount
    )
      ? appliedPromo.amount
      : baseAmount;


  const hasPromoDiscount =
    displayAmount <
    displayOriginalAmount;


  return (
    <div
      className={
        styles.page
      }
    >

      <SEO
        title="Срочная инструкция по охране труда за 500 ₽ | БОЙКОВГРУПП"
        description="Срочная подготовка проекта инструкции по охране труда для нужной профессии с опорой на требования законодательства РФ."
      />


      <div
        className={
          styles.siteHeader
        }
      >

        <Header
          query={headerQuery}
          onQueryChange={setHeaderQuery}
        />

        <Navigation />

      </div>


      <main
        className={
          styles.content
        }
      >

        <Link
          to="/"
          className={
            styles.back
          }
        >
          ← Все инструкции
        </Link>


        <section
          className={
            styles.hero
          }
        >

          <div
            className={
              styles.heroCopy
            }
          >

            <div
              className={
                styles.eyebrow
              }
            >
              [ профессия или вид работ ]
            </div>


            <h1
              className={
                styles.title
              }
            >
              Срочная инструкция
              по охране труда
            </h1>


            <p
              className={
                styles.lead
              }
            >
              Укажите профессию, должность
              или вид работ — подготовим
              проект инструкции с опорой
              на требования законодательства
              Российской Федерации и принятую
              структуру документов по охране труда.
            </p>


            <div
              className={
                styles.notice
              }
            >
              Перед утверждением инструкции
              работодателем документ необходимо
              проверить с учётом конкретных
              условий труда, оборудования
              и локальных требований организации.
            </div>

          </div>


          <div
            className={
              styles.heroProfile
            }
          >

            <HeroPortrait
              compact
            />

          </div>


          <div
            className={
              styles.priceCard
            }
          >

            <div
              className={
                styles.priceLabel
              }
            >
              Стоимость
            </div>


            <div
              className={
                styles.price
              }
            >
              {
                hasPromoDiscount
                  ? (
                      <>
                        <span
                          className={
                            styles.promoPriceOld
                          }
                        >
                          {formatAmount(
                            displayOriginalAmount
                          )} ₽
                        </span>

                        {" "}

                        <span
                          className={
                            styles.promoPriceNew
                          }
                        >
                          {formatAmount(
                            displayAmount
                          )} ₽
                        </span>
                      </>
                    )
                  : `${formatAmount(
                      displayAmount
                    )} ₽`
              }
            </div>


            <div
              className={
                styles.priceDescription
              }
            >
              за подготовку
              одной инструкции
            </div>

          </div>

        </section>


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
                    (event) => {

                      const value =
                        event.target.value
                          .toUpperCase();


                      setPromoInput(
                        value
                      );


                      if (
                        appliedPromo &&
                        normalizePromoCode(
                          value
                        ) !==
                          appliedPromo.code
                      ) {

                        setAppliedPromo(
                          null
                        );

                        setPromoMessage(
                          ""
                        );

                        setPromoMessageType(
                          ""
                        );

                      }

                    }
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

      

      </main>

    </div>
  );
}
