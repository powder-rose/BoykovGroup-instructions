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
} from "../../../store/authSlice.js";


export default function useLoginModal({
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


  return {
    mode,
    loginValue,
    setLoginValue,
    name,
    setName,
    phone,
    setPhone,
    email,
    setEmail,

    userAgreementAccepted,
    setUserAgreementAccepted,

    personalDataConsentAccepted,
    setPersonalDataConsentAccepted,

    advertisingConsentAccepted,
    setAdvertisingConsentAccepted,

    password,
    setPassword,
    passwordConfirm,
    setPasswordConfirm,

    isAuthenticating,
    visibleError,

    switchMode,
    handleSubmit
  };

}
