import {
  useLayoutEffect,
  useState
} from "react";

import {
  Link
} from "react-router-dom";

import Header from "../Header/Header.jsx";
import Navigation from "../Navigation/Navigation.jsx";

import SEO
  from "../SEO/SEO.jsx";

import useUrgentGenerationPromo
  from "./hooks/useUrgentGenerationPromo.js";

import useUrgentGenerationPayment
  from "./hooks/useUrgentGenerationPayment.js";

import UrgentGenerationHero
  from "./UrgentGenerationHero.jsx";

import UrgentGenerationOrderSection
  from "./UrgentGenerationOrderSection.jsx";
import styles
  from "./UrgentGenerationPage.module.css";


export default function UrgentGenerationPage() {

  const [
    profession,
    setProfession
  ] = useState("");

  const [
    headerQuery,
    setHeaderQuery
  ] = useState("");

  const {
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
  } =
    useUrgentGenerationPromo();


  const {
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
  } =
    useUrgentGenerationPayment({
      profession,
      appliedPromo
    });


  /*
   * ==========================================================
   * URGENT PAGE SCROLL RESET
   * ==========================================================
   *
   * React Router сохраняет scroll позиции
   * предыдущего route. Для коммерческой страницы
   * всегда начинаем с первого экрана.
   */
  useLayoutEffect(() => {

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto"
    });


    /*
     * Дополнительно сбрасываем scroll у document,
     * чтобы поведение было одинаковым
     * во всех браузерах.
     */
    document.documentElement.scrollTop =
      0;

    document.body.scrollTop =
      0;


    /*
     * LEGACY ORDER STORAGE CLEANUP
     *
     * Старое восстановление заказа больше
     * не используется. Удаляем оставшиеся
     * ключи у пользователей после обновления.
     */
    try {

      window.sessionStorage.removeItem(
        "boykovgroup_urgent_generation_order_v1"
      );

      window.sessionStorage.removeItem(
        "boykovdocs_thanks_order_v1"
      );

    }
    catch {
      /* storage может быть недоступен */
    }

  }, []);




  return (
    <div
      className={
        styles.page
      }
    >

      <SEO
        title="Срочная инструкция по охране труда за 500 ₽ | БОЙКОВГРУПП"
        description="Срочная подготовка проекта инструкции по охране труда для нужной профессии с опорой на требования законодательства РФ."
      />


      <div
        className={
          styles.siteHeader
        }
      >

        <Header
          query={headerQuery}
          onQueryChange={setHeaderQuery}
        />

        <Navigation />

      </div>


      <main
        className={
          styles.content
        }
      >

        <Link
          to="/"
          className={
            styles.back
          }
        >
          ← Все инструкции
        </Link>


        <UrgentGenerationHero
          displayOriginalAmount={
            displayOriginalAmount
          }
          displayAmount={
            displayAmount
          }
          hasPromoDiscount={
            hasPromoDiscount
          }
        />


        <UrgentGenerationOrderSection
          profession={
            profession
          }
          setProfession={
            setProfession
          }
          promoInput={
            promoInput
          }
          promoMessage={
            promoMessage
          }
          promoMessageType={
            promoMessageType
          }
          isPromoChecking={
            isPromoChecking
          }
          handlePromoApply={
            handlePromoApply
          }
          handlePromoInputChange={
            handlePromoInputChange
          }
          displayOriginalAmount={
            displayOriginalAmount
          }
          displayAmount={
            displayAmount
          }
          hasPromoDiscount={
            hasPromoDiscount
          }
          isPaying={
            isPaying
          }
          error={
            error
          }
          setError={
            setError
          }
          isPaymentComplete={
            isPaymentComplete
          }
          paymentMessage={
            paymentMessage
          }
          offerAccepted={
            offerAccepted
          }
          setOfferAccepted={
            setOfferAccepted
          }
          personalDataAccepted={
            personalDataAccepted
          }
          setPersonalDataAccepted={
            setPersonalDataAccepted
          }
          consentError={
            consentError
          }
          setConsentError={
            setConsentError
          }
          handleSubmit={
            handleSubmit
          }
        />

      

      </main>

    </div>
  );
}
