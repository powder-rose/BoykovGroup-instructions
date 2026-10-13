import {
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import {
  loadCloudPayments
} from "../../../lib/cloudPayments.js";


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


export default function useUrgentGenerationPayment({

  profession,
  appliedPromo

}) {

  const navigate =
    useNavigate();


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

      const authToken =
        getUserAuthToken();


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
                authToken
                  ? {
                      Authorization:
                        `Bearer ${authToken}`
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


  return {
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
  };

}
