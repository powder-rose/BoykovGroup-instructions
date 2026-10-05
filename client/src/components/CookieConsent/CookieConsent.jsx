import {
  useEffect,
  useState
} from "react";

import "./CookieConsent.css";


const COOKIE_NAME =
  "boykov_cookie_consent";

const COOKIE_DAYS =
  365;


function getConsent() {

  const prefix =
    `${COOKIE_NAME}=`;


  const cookies =
    document.cookie
      .split(";")
      .map(
        item =>
          item.trim()
      );


  const item =
    cookies.find(
      cookie =>
        cookie.startsWith(
          prefix
        )
    );


  if (!item) {
    return null;
  }


  return decodeURIComponent(
    item.slice(
      prefix.length
    )
  );

}


function applyConsent(
  value
) {

  window.BOYKOV_COOKIE_CONSENT =
    value;


  document.documentElement
    .setAttribute(
      "data-cookie-consent",
      value
    );

}


function saveConsent(
  value
) {

  const maxAge =
    COOKIE_DAYS *
    24 *
    60 *
    60;


  document.cookie =
    `${COOKIE_NAME}=${encodeURIComponent(value)}; ` +
    `Max-Age=${maxAge}; ` +
    `Path=/; ` +
    `SameSite=Lax; ` +
    `Secure`;


  applyConsent(
    value
  );


  window.dispatchEvent(
    new CustomEvent(
      "boykov:cookie-consent",
      {
        detail: {
          value
        }
      }
    )
  );

}


export default function CookieConsent() {

  const [
    consent,
    setConsent
  ] =
    useState(
      () => {

        const existing =
          getConsent();


        return (
          existing === "all" ||
          existing === "necessary"
        )
          ? existing
          : null;

      }
    );


  useEffect(() => {

    if (
      consent === "all" ||
      consent === "necessary"
    ) {

      applyConsent(
        consent
      );

    }

  }, [
    consent
  ]);


  useEffect(() => {

    function resetConsent() {

      document.cookie =
        `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;


      window.BOYKOV_COOKIE_CONSENT =
        null;


      document.documentElement
        .removeAttribute(
          "data-cookie-consent"
        );


      setConsent(
        null
      );

    }


    window.resetBoykovCookieConsent =
      resetConsent;


    return () => {

      if (
        window.resetBoykovCookieConsent ===
        resetConsent
      ) {

        delete window
          .resetBoykovCookieConsent;

      }

    };

  }, []);


  function accept(
    value
  ) {

    saveConsent(
      value
    );

    setConsent(
      value
    );

  }


  if (
    consent === "all" ||
    consent === "necessary"
  ) {

    return null;

  }


  return (
    <section
      id="boykov-cookie-banner"
      className="boykovCookieBanner"
      role="dialog"
      aria-label="Настройки cookie"
    >

      <div
        className="boykovCookieBanner__eyebrow"
      >
        Cookie
      </div>


      <h2
        className="boykovCookieBanner__title"
      >
        Мы используем cookie
      </h2>


      <p
        className="boykovCookieBanner__text"
      >
        Необходимые cookie используются для корректной работы сайта.
        Аналитические cookie помогают нам понимать, как посетители
        пользуются сайтом. Вы можете разрешить все cookie или оставить
        только необходимые.
      </p>


      <p
        className="boykovCookieBanner__more"
      >
        <a
          className="boykovCookieBanner__link"
          href="/soglasie-na-obrabotku-cookie/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Согласие на обработку файлов cookies
        </a>
      </p>


      <div
        className="boykovCookieBanner__actions"
      >

        <button
          type="button"
          className="
            boykovCookieBanner__button
            boykovCookieBanner__button--secondary
          "
          onClick={
            () =>
              accept(
                "necessary"
              )
          }
        >
          Только необходимые
        </button>


        <button
          type="button"
          className="
            boykovCookieBanner__button
            boykovCookieBanner__button--primary
          "
          onClick={
            () =>
              accept(
                "all"
              )
          }
        >
          Принять все
        </button>

      </div>

    </section>
  );

}
