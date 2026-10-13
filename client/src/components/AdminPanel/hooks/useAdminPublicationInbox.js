import {
  useEffect,
  useState
} from "react";


export default function useAdminPublicationInbox({

  isAdmin,
  token

}) {

  const [
    publicationInbox,
    setPublicationInbox
  ] =
    useState([]);

  const [
    publicationInboxLoading,
    setPublicationInboxLoading
  ] =
    useState(false);

  const [
    publicationInboxError,
    setPublicationInboxError
  ] =
    useState("");

  const [
    publicationReviewBusy,
    setPublicationReviewBusy
  ] =
    useState(null);

  const [
    selectedPublicationInstruction,
    setSelectedPublicationInstruction
  ] =
    useState(null);


  async function loadPublicationInbox(
    silent = false
  ) {

    if (
      !isAdmin ||
      !token
    ) {

      setPublicationInbox([]);

      return;

    }


    if (!silent) {

      setPublicationInboxLoading(
        true
      );

    }


    try {

      const response =
        await fetch(
          "/api/public-generation/admin/inbox",
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            },

            cache:
              "no-store"
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          data?.error ||
          "Не удалось загрузить ящик публикаций."
        );

      }


      setPublicationInbox(
        Array.isArray(
          data?.items
        )
          ? data.items
          : []
      );

      setPublicationInboxError(
        ""
      );

    }
    catch(error) {

      setPublicationInboxError(
        error?.message ||
        "Не удалось загрузить ящик публикаций."
      );

    }
    finally {

      if (!silent) {

        setPublicationInboxLoading(
          false
        );

      }

    }

  }


  useEffect(
    () => {

      if (
        !isAdmin ||
        !token
      ) {

        setPublicationInbox([]);

        return undefined;

      }


      loadPublicationInbox();


      const timer =
        setInterval(
          () => {

            loadPublicationInbox(
              true
            );

          },
          15000
        );


      return () => {

        clearInterval(
          timer
        );

      };

    },
    [
      isAdmin,
      token
    ]
  );


  async function reviewPublication(
    orderId,
    action
  ) {

    if (
      !token ||
      !orderId
    ) {

      return;

    }


    const isApprove =
      action ===
        "approve";


    const confirmed =
      window.confirm(
        isApprove
          ? "Опубликовать эту инструкцию в общем каталоге?"
          : "Отклонить публикацию этой инструкции?"
      );


    if (!confirmed) {

      return;

    }


    setPublicationReviewBusy(
      orderId
    );

    setPublicationInboxError(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/public-generation/admin/orders/${encodeURIComponent(
            orderId
          )}/${action}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`
            },

            body:
              JSON.stringify({})
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          data?.error ||
          "Не удалось изменить статус публикации."
        );

      }


      setPublicationInbox(
        current =>
          current.filter(
            item =>
              item.id !==
                orderId
          )
      );


      if (
        selectedPublicationInstruction
          ?.orderId ===
        orderId
      ) {

        setSelectedPublicationInstruction(
          null
        );

      }

    }
    catch(error) {

      setPublicationInboxError(
        error?.message ||
        "Не удалось изменить статус публикации."
      );

    }
    finally {

      setPublicationReviewBusy(
        null
      );

    }

  }


  return {
    publicationInbox,
    publicationInboxLoading,
    publicationInboxError,
    publicationReviewBusy,

    selectedPublicationInstruction,
    setSelectedPublicationInstruction,

    reviewPublication
  };

}
