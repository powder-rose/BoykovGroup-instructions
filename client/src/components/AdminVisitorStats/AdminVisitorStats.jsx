import {
  useEffect,
  useState
} from "react";

import "./AdminVisitorStats.css";


const numberFormatter =
  new Intl.NumberFormat(
    "ru-RU"
  );


function formatNumber(
  value
) {

  return numberFormatter.format(
    Number(value) || 0
  );

}


export default function AdminVisitorStats({
  token,
  hidden = false
}) {

  const [
    data,
    setData
  ] =
    useState(null);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState("");


  useEffect(() => {

    if (!token) {

      setData(
        null
      );

      setLoading(
        false
      );

      return undefined;

    }


    let cancelled =
      false;


    async function loadStats() {

      try {

        setError(
          ""
        );


        const response =
          await fetch(
            "/api/visitor-stats/admin",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              },

              cache:
                "no-store"
            }
          );


        const result =
          await response
            .json()
            .catch(
              () => ({})
            );


        if (!response.ok) {

          throw new Error(
            result?.error ||
            `Ошибка статистики (${response.status})`
          );

        }


        if (!cancelled) {

          setData(
            result
          );

        }

      }
      catch(loadError) {

        if (!cancelled) {

          setError(
            loadError?.message ||
            "Не удалось загрузить статистику посетителей."
          );

        }

      }
      finally {

        if (!cancelled) {

          setLoading(
            false
          );

        }

      }

    }


    function handleFocus() {

      void loadStats();

    }


    void loadStats();


    window.addEventListener(
      "focus",
      handleFocus
    );


    return () => {

      cancelled =
        true;


      window.removeEventListener(
        "focus",
        handleFocus
      );

    };

  }, [
    token
  ]);


  const cards = [
    {
      label:
        "Сегодня",

      value:
        data?.today?.visitors
    },

    {
      label:
        "Вчера",

      value:
        data?.yesterday?.visitors
    },

    {
      label:
        "7 дней",

      value:
        data?.last7Days?.visitors
    },

    {
      label:
        "30 дней",

      value:
        data?.last30Days?.visitors
    },

    {
      label:
        "Всего",

      value:
        data?.total?.visitors
    }
  ];


  return (
    <section
      id="boykovVisitorStats"
      className={[
        "boykovVisitorStats",

        hidden
          ? "boykovAdminDashboardSection--hidden"
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-boykov-admin-tab-section="visitors"
    >

      <div
        className="boykovVisitorStats__header"
      >

        <div
          className="boykovVisitorStats__eyebrow"
        >
          СТАТИСТИКА
        </div>

        <h2
          className="boykovVisitorStats__title"
        >
          Посетители сайта
        </h2>

        <p
          className="boykovVisitorStats__description"
        >
          Уникальные посетители и просмотры страниц
        </p>

      </div>


      <div
        className="boykovVisitorStats__content"
      >

        {
          loading &&
          (
            <div
              className="boykovVisitorStats__loading"
            >
              Загружаем статистику…
            </div>
          )
        }


        {
          !loading &&
          error &&
          (
            <div
              className="boykovVisitorStats__loading"
            >
              {error}
            </div>
          )
        }


        {
          !loading &&
          !error &&
          data &&
          (
            <>

              <div
                className="boykovVisitorStats__grid"
              >

                {
                  cards.map(
                    card => (

                      <div
                        key={
                          card.label
                        }
                        className="boykovVisitorStats__card"
                      >

                        <div
                          className="boykovVisitorStats__label"
                        >
                          {card.label}
                        </div>

                        <div
                          className="boykovVisitorStats__value"
                        >
                          {
                            formatNumber(
                              card.value
                            )
                          }
                        </div>

                      </div>

                    )
                  )
                }

              </div>


              <div
                className="boykovVisitorStats__pageviews"
              >
                Просмотров страниц сегодня:

                <strong>
                  {
                    formatNumber(
                      data?.today?.pageViews
                    )
                  }
                </strong>
              </div>


              <div
                className="boykovVisitorStats__note"
              >
                Уникальные посетители считаются с момента установки счётчика.
              </div>

            </>
          )
        }

      </div>

    </section>
  );

}
