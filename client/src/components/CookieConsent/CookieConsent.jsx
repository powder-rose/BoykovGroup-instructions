import useCookieConsent
  from "./hooks/useCookieConsent.js";

import "./CookieConsent.css";


export default function CookieConsent() {

  const {
    consent,
    accept
  } =
    useCookieConsent();


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
