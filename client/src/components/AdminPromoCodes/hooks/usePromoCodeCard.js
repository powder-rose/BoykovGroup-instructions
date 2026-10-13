import {
  useEffect,
  useState
} from "react";

import {
  deletePromoCode,
  updatePromoCode
} from "../../../api/promoCodesApi.js";

import {
  fromLocalInput,
  toDraft
} from "../promoCodeAdminUtils.js";


export default function usePromoCodeCard({

  promo,
  token,
  onReload,
  onMessage

}) {

  const [
    draft,
    setDraft
  ] =
    useState(
      () =>
        toDraft(
          promo
        )
    );


  const [
    busy,
    setBusy
  ] =
    useState(false);


  useEffect(() => {

    setDraft(
      toDraft(
        promo
      )
    );

  }, [
    promo
  ]);


  function change(
    name,
    value
  ) {

    setDraft(
      current => ({
        ...current,
        [name]:
          value
      })
    );

  }


  function payload() {

    const maxUsesText =
      String(
        draft.maxUses ?? ""
      )
        .trim();


    return {
      code:
        String(
          draft.code || ""
        )
          .trim()
          .toUpperCase(),

      type:
        draft.type ||
        "fixed_price",

      value:
        Number(
          draft.value
        ),

      maxUses:
        maxUsesText
          ? Number(
              maxUsesText
            )
          : null,

      expiresAt:
        fromLocalInput(
          draft.expiresAt
        ),

      active:
        draft.active ===
        true
    };

  }


  async function save() {

    setBusy(
      true
    );

    onMessage(
      "",
      ""
    );


    try {

      await updatePromoCode(
        promo.id,
        payload(),
        token
      );


      onMessage(
        `Промокод ${promo.code} сохранён.`,
        "success"
      );


      await onReload();

    }
    catch(error) {

      onMessage(
        error?.message ||
        "Не удалось сохранить промокод.",
        "error"
      );

    }
    finally {

      setBusy(
        false
      );

    }

  }


  async function toggle() {

    setBusy(
      true
    );

    onMessage(
      "",
      ""
    );


    try {

      await updatePromoCode(
        promo.id,
        {
          active:
            promo.active !==
            true
        },
        token
      );


      await onReload();

    }
    catch(error) {

      onMessage(
        error?.message ||
        "Не удалось изменить состояние промокода.",
        "error"
      );

    }
    finally {

      setBusy(
        false
      );

    }

  }


  async function remove() {

    const confirmed =
      window.confirm(
        `Удалить промокод ${promo.code}?`
      );


    if (!confirmed) {
      return;
    }


    setBusy(
      true
    );

    onMessage(
      "",
      ""
    );


    try {

      await deletePromoCode(
        promo.id,
        token
      );


      onMessage(
        `Промокод ${promo.code} удалён.`,
        "success"
      );


      await onReload();

    }
    catch(error) {

      onMessage(
        error?.message ||
        "Не удалось удалить промокод.",
        "error"
      );

    }
    finally {

      setBusy(
        false
      );

    }

  }


  return {
    draft,
    busy,
    change,
    save,
    toggle,
    remove
  };

}
