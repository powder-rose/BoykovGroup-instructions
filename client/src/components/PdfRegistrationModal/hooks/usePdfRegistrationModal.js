import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  register as registerUser
} from "../../../api/authApi.js";


const USER_TOKEN_KEY =
  "boykovgroup_auth_token";


export default function usePdfRegistrationModal({
  onClose
}) {

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
    password,
    setPassword
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
    busy,
    setBusy
  ] =
    useState(false);

  const [
    registered,
    setRegistered
  ] =
    useState(false);

  const [
    status,
    setStatus
  ] =
    useState({
      text:
        "",

      type:
        ""
    });


  const registeredRef =
    useRef(false);

  const closeTimerRef =
    useRef(null);

  const nameInputRef =
    useRef(null);


  /*
   * Production сохраняет старый overflow,
   * блокирует body и возвращает его при закрытии.
   */
  useEffect(() => {

    const previousOverflow =
      document.body.style
        .overflow;


    document.body.style
      .overflow =
      "hidden";


    const focusTimer =
      window.setTimeout(
        () => {

          nameInputRef.current
            ?.focus();

        },
        120
      );


    return () => {

      document.body.style
        .overflow =
        previousOverflow;


      window.clearTimeout(
        focusTimer
      );


      if (
        closeTimerRef.current
      ) {

        window.clearTimeout(
          closeTimerRef.current
        );

      }

    };

  }, []);


  /*
   * Escape закрывает modal.
   * Если регистрация уже завершена —
   * production после закрытия reload'ит страницу.
   */
  useEffect(() => {

    function handleKeyDown(
      event
    ) {

      if (
        event.key ===
        "Escape"
      ) {

        closeModal();

      }

    }


    document.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  }, []);


  function closeModal() {

    const reloadAfter =
      registeredRef.current;


    onClose();


    if (reloadAfter) {

      window.setTimeout(
        () => {

          window.location.reload();

        },
        0
      );

    }

  }


  async function handleSubmit(
    event
  ) {

    event.preventDefault();


    if (
      busy ||
      registered
    ) {
      return;
    }


    setBusy(
      true
    );


    setStatus({
      text:
        "",

      type:
        ""
    });


    try {

      const data =
        await registerUser({
          name:
            name.trim(),

          phone:
            phone.trim(),

          email:
            email.trim(),

          password,

          userAgreementAccepted,

          personalDataConsentAccepted,

          advertisingConsentAccepted
        });


      if (
        data?.token
      ) {

        window.localStorage
          .setItem(
            USER_TOKEN_KEY,
            data.token
          );

      }


      registeredRef.current =
        true;


      setRegistered(
        true
      );


      setStatus({
        type:
          "success",

        text:
          data?.verificationEmailSent ===
            false
            ? "Регистрация завершена."
            : "Регистрация завершена. Подтвердите e-mail по ссылке из письма."
      });


      closeTimerRef.current =
        window.setTimeout(
          () => {

            onClose();


            window.location.reload();

          },
          1800
        );

    }
    catch(error) {

      setBusy(
        false
      );


      setStatus({
        type:
          "error",

        text:
          error?.message ||
          "Не удалось зарегистрироваться"
      });

    }

  }


  function handleOverlayClick(
    event
  ) {

    if (
      event.target ===
      event.currentTarget
    ) {

      closeModal();

    }

  }


  return {
    name,
    setName,
    phone,
    setPhone,
    email,
    setEmail,
    password,
    setPassword,

    userAgreementAccepted,
    setUserAgreementAccepted,

    personalDataConsentAccepted,
    setPersonalDataConsentAccepted,

    advertisingConsentAccepted,
    setAdvertisingConsentAccepted,

    busy,
    registered,
    status,

    nameInputRef,

    closeModal,
    handleSubmit,
    handleOverlayClick
  };

}
