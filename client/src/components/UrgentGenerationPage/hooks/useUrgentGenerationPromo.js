import {
  useState
} from "react";

import {
  normalizePromoCode,
  formatAmount
} from "../urgentGenerationUtils.js";


const BASE_AMOUNT =
  500;


export default function useUrgentGenerationPromo() {

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


  function handlePromoInputChange(
    value
  ) {

    const nextValue =
      value.toUpperCase();


    setPromoInput(
      nextValue
    );


    if (
      appliedPromo &&
      normalizePromoCode(
        nextValue
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


  const displayOriginalAmount =
    Number.isFinite(
      appliedPromo?.originalAmount
    )
      ? appliedPromo.originalAmount
      : BASE_AMOUNT;


  const displayAmount =
    Number.isFinite(
      appliedPromo?.amount
    )
      ? appliedPromo.amount
      : BASE_AMOUNT;


  const hasPromoDiscount =
    displayAmount <
    displayOriginalAmount;


  return {
    promoInput,
    appliedPromo,
    promoMessage,
    promoMessageType,
    isPromoChecking,

    handlePromoApply,
    handlePromoInputChange,

    displayOriginalAmount,
    displayAmount,
    hasPromoDiscount
  };

}
