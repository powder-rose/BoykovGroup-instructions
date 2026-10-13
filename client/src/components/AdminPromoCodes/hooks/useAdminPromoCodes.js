import {
  useEffect,
  useState
} from "react";

import {
  createPromoCode,
  getPromoCodes
} from "../../../api/promoCodesApi.js";

import {
  fromLocalInput
} from "../promoCodeAdminUtils.js";


const INITIAL_CREATE_FORM = {
  code:
    "",

  type:
    "fixed_price",

  value:
    "10",

  maxUses:
    "",

  expiresAt:
    "",

  active:
    true
};


export default function useAdminPromoCodes({
  token
}) {

  const [
    items,
    setItems
  ] =
    useState([]);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    createForm,
    setCreateForm
  ] =
    useState(
      INITIAL_CREATE_FORM
    );

  const [
    creating,
    setCreating
  ] =
    useState(false);

  const [
    message,
    setMessage
  ] =
    useState({
      text:
        "",

      type:
        ""
    });


  function showMessage(
    text,
    type
  ) {

    setMessage({
      text:
        text || "",

      type:
        type || ""
    });

  }


  async function loadItems() {

    if (!token) {

      setItems(
        []
      );

      setLoading(
        false
      );

      return;

    }


    try {

      const data =
        await getPromoCodes(
          token
        );


      setItems(
        Array.isArray(
          data?.items
        )
          ? data.items
          : []
      );

    }
    catch(error) {

      showMessage(
        error?.message ||
        "Не удалось загрузить промокоды.",
        "error"
      );

    }
    finally {

      setLoading(
        false
      );

    }

  }


  useEffect(() => {

    void loadItems();

  }, [
    token
  ]);


  function changeCreate(
    name,
    value
  ) {

    setCreateForm(
      current => ({
        ...current,
        [name]:
          value
      })
    );

  }


  async function handleCreate(
    event
  ) {

    event.preventDefault();


    const maxUsesText =
      String(
        createForm.maxUses
      )
        .trim();


    const payload = {
      code:
        createForm.code
          .trim()
          .toUpperCase(),

      type:
        createForm.type,

      value:
        Number(
          createForm.value
        ),

      maxUses:
        maxUsesText
          ? Number(
              maxUsesText
            )
          : null,

      expiresAt:
        fromLocalInput(
          createForm.expiresAt
        ),

      active:
        createForm.active
    };


    setCreating(
      true
    );

    showMessage(
      "",
      ""
    );


    try {

      await createPromoCode(
        payload,
        token
      );


      setCreateForm({
        ...INITIAL_CREATE_FORM
      });


      showMessage(
        "Промокод создан.",
        "success"
      );


      await loadItems();

    }
    catch(error) {

      showMessage(
        error?.message ||
        "Не удалось создать промокод.",
        "error"
      );

    }
    finally {

      setCreating(
        false
      );

    }

  }


  return {
    items,
    loading,
    createForm,
    creating,
    message,
    showMessage,
    loadItems,
    changeCreate,
    handleCreate
  };

}
