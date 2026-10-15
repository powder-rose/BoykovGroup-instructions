import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { register as registerUser, selectAuthError } from '../../../store/authSlice.js';

export default function usePdfRegistrationModal({ onClose }) {
  const dispatch = useDispatch();
  const authError = useSelector(selectAuthError);
  const [name, setName] = useState('');

  const [phone, setPhone] = useState('');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [userAgreementAccepted, setUserAgreementAccepted] = useState(false);

  const [personalDataConsentAccepted, setPersonalDataConsentAccepted] = useState(false);

  const [advertisingConsentAccepted, setAdvertisingConsentAccepted] = useState(false);

  const [busy, setBusy] = useState(false);

  const [registered, setRegistered] = useState(false);

  const [status, setStatus] = useState({
    text: '',

    type: '',
  });

  const nameInputRef = useRef(null);

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /*
   * Production сохраняет старый overflow,
   * блокирует body и возвращает его при закрытии.
   */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 120);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.clearTimeout(focusTimer);
    };
  }, []);

  const closeModal = useCallback(() => {
    onCloseRef.current?.();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeModal();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeModal]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy || registered) {
      return;
    }

    setBusy(true);

    setStatus({
      text: '',

      type: '',
    });

    try {
      const data = await dispatch(
        registerUser({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          userAgreementAccepted,
          personalDataConsentAccepted,
          advertisingConsentAccepted,
        }),
      );

      if (!data) {
        setBusy(false);
        setStatus({ type: 'error', text: 'Не удалось зарегистрироваться' });
        return;
      }

      setRegistered(true);

      setStatus({
        type: 'success',

        text:
          data?.verificationEmailSent === false
            ? 'Регистрация завершена.'
            : 'Регистрация завершена. Подтвердите e-mail по ссылке из письма.',
      });

      // Auth state opens the optional company-profile step without reloading this instruction.
      onCloseRef.current?.();
    } catch (error) {
      setBusy(false);

      setStatus({
        type: 'error',

        text: error?.message || 'Не удалось зарегистрироваться',
      });
    }
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
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
    status: status.type === 'error' && authError ? { ...status, text: authError } : status,

    nameInputRef,

    closeModal,
    handleSubmit,
    handleOverlayClick,
  };
}
