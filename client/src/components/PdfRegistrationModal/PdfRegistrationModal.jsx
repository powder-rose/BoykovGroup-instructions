import PdfRegistrationForm
  from "./PdfRegistrationForm.jsx";

import usePdfRegistrationModal
  from "./hooks/usePdfRegistrationModal.js";

import "./PdfRegistrationModal.css";


export default function PdfRegistrationModal({
  onClose
}) {

  const {
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
  } =
    usePdfRegistrationModal({
      onClose
    });


  return (
    <div
      id="boykov-pdf-registration-modal"
      className="boykovPdfRegistration"
      onMouseDown={
        handleOverlayClick
      }
    >

      <div
        className="boykovPdfRegistration__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="boykov-pdf-registration-title"
      >

        <button
          type="button"
          className="boykovPdfRegistration__close"
          aria-label="Закрыть"
          onClick={
            closeModal
          }
        >
          ×
        </button>


        <div
          className="boykovPdfRegistration__eyebrow"
        >
          PDF
        </div>


        <h2
          id="boykov-pdf-registration-title"
          className="boykovPdfRegistration__title"
        >
          Регистрация
        </h2>


        <p
          className="boykovPdfRegistration__description"
        >
          Зарегистрируйтесь, чтобы скачать инструкцию в PDF.
        </p>


        <PdfRegistrationForm
          name={
            name
          }
          setName={
            setName
          }
          phone={
            phone
          }
          setPhone={
            setPhone
          }
          email={
            email
          }
          setEmail={
            setEmail
          }
          password={
            password
          }
          setPassword={
            setPassword
          }
          userAgreementAccepted={
            userAgreementAccepted
          }
          setUserAgreementAccepted={
            setUserAgreementAccepted
          }
          personalDataConsentAccepted={
            personalDataConsentAccepted
          }
          setPersonalDataConsentAccepted={
            setPersonalDataConsentAccepted
          }
          advertisingConsentAccepted={
            advertisingConsentAccepted
          }
          setAdvertisingConsentAccepted={
            setAdvertisingConsentAccepted
          }
          busy={
            busy
          }
          registered={
            registered
          }
          status={
            status
          }
          nameInputRef={
            nameInputRef
          }
          handleSubmit={
            handleSubmit
          }
        />

      </div>

    </div>
  );

}
