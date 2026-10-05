import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  useSelector
} from "react-redux";

import {
  selectAuthToken,
  selectAuthUser,
  selectIsRestoringSession
} from "../../store/authSlice.js";

import PdfRegistrationModal
  from "../PdfRegistrationModal/PdfRegistrationModal.jsx";

import "./InstructionPdfDownload.css";


function getPdfFileName(
  response,
  instructionId
) {

  const disposition =
    response.headers.get(
      "Content-Disposition"
    ) || "";


  const match =
    disposition.match(
      /filename\*=UTF-8''([^;]+)/i
    );


  if (match?.[1]) {

    try {

      return decodeURIComponent(
        match[1]
      );

    }
    catch {
      /* use fallback */
    }

  }


  return (
    `instruction-${instructionId}.pdf`
  );

}


export default function InstructionPdfDownload({
  instructionId
}) {

  const token =
    useSelector(
      selectAuthToken
    );

  const user =
    useSelector(
      selectAuthUser
    );

  const isRestoring =
    useSelector(
      selectIsRestoringSession
    );


  const [
    isRegistrationOpen,
    setRegistrationOpen
  ] =
    useState(false);

  const [
    isDownloading,
    setDownloading
  ] =
    useState(false);

  const [
    message,
    setMessage
  ] =
    useState(null);


  const messageTimerRef =
    useRef(null);


  useEffect(() => {

    return () => {

      if (
        messageTimerRef.current
      ) {

        window.clearTimeout(
          messageTimerRef.current
        );

      }

    };

  }, []);


  function showMessage(
    text,
    type = "error"
  ) {

    setMessage({
      text,
      type
    });


    if (
      messageTimerRef.current
    ) {

      window.clearTimeout(
        messageTimerRef.current
      );

    }


    messageTimerRef.current =
      window.setTimeout(
        () => {

          setMessage(
            null
          );

          messageTimerRef.current =
            null;

        },
        5000
      );

  }


  const isAdmin =
    user?.role ===
      "admin";


  const isVerifiedUser =
    user?.role ===
      "user" &&
    user?.emailVerified ===
      true;


  const isLockedUser =
    user?.role ===
      "user" &&
    user?.emailVerified !==
      true;


  async function downloadPdf() {

    if (
      !instructionId ||
      !token ||
      isDownloading
    ) {
      return;
    }


    setDownloading(
      true
    );


    try {

      const response =
        await fetch(
          `/api/instructions/${encodeURIComponent(
            instructionId
          )}/pdf`,
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,

              Accept:
                "application/pdf"
            },

            cache:
              "no-store"
          }
        );


      if (!response.ok) {

        let errorMessage =
          `Ошибка скачивания (${response.status})`;


        try {

          const data =
            await response.json();


          if (data?.error) {

            errorMessage =
              data.error;

          }

        }
        catch {
          /* keep default message */
        }


        throw new Error(
          errorMessage
        );

      }


      const contentType =
        response.headers.get(
          "Content-Type"
        ) || "";


      if (
        !contentType
          .toLowerCase()
          .includes(
            "application/pdf"
          )
      ) {

        throw new Error(
          "Сервер вернул не PDF-файл"
        );

      }


      const blob =
        await response.blob();


      if (
        blob.size <
        1000
      ) {

        throw new Error(
          "Получен пустой PDF-файл"
        );

      }


      const objectUrl =
        URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        objectUrl;


      link.download =
        getPdfFileName(
          response,
          instructionId
        );


      link.style.display =
        "none";


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      window.setTimeout(
        () => {

          URL.revokeObjectURL(
            objectUrl
          );

        },
        5000
      );


      showMessage(
        "PDF успешно сформирован.",
        "success"
      );

    }
    catch(error) {

      console.error(
        "PDF download error:",
        error
      );


      showMessage(
        error?.message ||
        "Не удалось скачать PDF"
      );

    }
    finally {

      setDownloading(
        false
      );

    }

  }


  function handleClick() {

    if (
      isRestoring ||
      isDownloading
    ) {
      return;
    }


    if (
      !user ||
      !token
    ) {

      setRegistrationOpen(
        true
      );

      return;

    }


    if (
      isAdmin ||
      isVerifiedUser
    ) {

      void downloadPdf();

    }

  }


  if (
    !instructionId
  ) {
    return null;
  }


  const buttonText =
    isDownloading
      ? "Формируем PDF..."
      : isLockedUser
        ? "Подтвердите e-mail для PDF"
        : "Скачать PDF";


  return (
    <>

      <div
        id="boykov-instruction-pdf-download"
        className={[
          "boykovPdfDownload",

          !user
            ? "boykovPdfDownload--guest"
            : "",

          isLockedUser
            ? "boykovPdfDownload--locked"
            : "",

          isDownloading
            ? "boykovPdfDownload--loading"
            : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >

        <button
          type="button"
          className="boykovPdfDownload__button"
          disabled={
            isRestoring ||
            isDownloading ||
            isLockedUser
          }
          onClick={
            handleClick
          }
        >

          <span
            className="boykovPdfDownload__badge"
          >
            PDF
          </span>


          <span
            className="boykovPdfDownload__text"
          >
            {buttonText}
          </span>

        </button>


        <span
          className="boykovPdfDownload__status"
        />

      </div>


      {
        isRegistrationOpen &&
        (
          <PdfRegistrationModal
            onClose={
              () =>
                setRegistrationOpen(
                  false
                )
            }
          />
        )
      }


      {
        message &&
        (
          <div
            className={[
              "boykovPdfMessage",

              message.type ===
                "success"
                ? "boykovPdfMessage--success"
                : "boykovPdfMessage--error"
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
          >
            {message.text}
          </div>
        )
      }

    </>
  );

}
