import {
  useEffect,
  useState
} from "react";

import "./AdminInstructionTop10.css";


const PERIODS = [
  {
    id:
      "total",

    label:
      "За всё время"
  },

  {
    id:
      "today",

    label:
      "Сегодня"
  },

  {
    id:
      "7d",

    label:
      "7 дней"
  },

  {
    id:
      "30d",

    label:
      "30 дней"
  }
];


function formatNumber(
  value
) {

  return Number(
    value || 0
  )
    .toLocaleString(
      "ru-RU"
    );

}


export default function AdminInstructionTop10({
  token,
  hidden = false
}) {

  const [
    period,
    setPeriod
  ] =
    useState(
      "total"
    );

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


    async function loadStats(
      silent = false
    ) {

      if (!silent) {

        setLoading(
          true
        );

      }


      try {

        setError(
          ""
        );


        const response =
          await fetch(
            `/api/admin/instruction-popularity?period=${encodeURIComponent(
              period
            )}`,
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
            "Не удалось загрузить статистику."
          );

        }

      }
      finally {

        if (
          !cancelled &&
          !silent
        ) {

          setLoading(
            false
          );

        }

      }

    }


    void loadStats();


    const timer =
      window.setInterval(
        () => {

          void loadStats(
            true
          );

        },
        60000
      );


    return () => {

      cancelled =
        true;


      window.clearInterval(
        timer
      );

    };

  }, [
    token,
    period
  ]);


  const items =
    Array.isArray(
      data?.items
    )
      ? data.items
      : [];


  function metricClass(
    metric
  ) {

    return [
      "boykovTop10__number",

      period === metric
        ? "boykovTop10__number--active"
        : ""
    ]
      .filter(Boolean)
      .join(" ");

  }


  return (
    <section
      id="boykov-admin-instruction-top10"
      className={[
        "boykovTop10",

        hidden
          ? "boykovAdminDashboardSection--hidden"
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-boykov-admin-tab-section="top10"
    >

      <div
        className="boykovTop10__header"
      >

        <div
          className="boykovTop10__heading"
        >

          <div
            className="boykovTop10__eyebrow"
          >
            СТАТИСТИКА
          </div>

          <h2
            className="boykovTop10__title"
          >
            Топ-10 инструкций
          </h2>

          <p
            className="boykovTop10__description"
          >
            Самые просматриваемые инструкции на сайте
          </p>

        </div>


        <div
          className="boykovTop10__tabs"
        >

          {
            PERIODS.map(
              item => (

                <button
                  key={
                    item.id
                  }
                  type="button"
                  className={[
                    "boykovTop10__tab",

                    period ===
                      item.id
                      ? "boykovTop10__tab--active"
                      : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={
                    () =>
                      setPeriod(
                        item.id
                      )
                  }
                >
                  {item.label}
                </button>

              )
            )
          }

        </div>

      </div>


      <div
        className="boykovTop10__body"
      >

        {
          loading &&
          (
            <div
              className="boykovTop10__loading"
            >
              Загрузка статистики...
            </div>
          )
        }


        {
          !loading &&
          error &&
          (
            <div
              className="boykovTop10__error"
            >
              {error}
            </div>
          )
        }


        {
          !loading &&
          !error &&
          items.length ===
            0 &&
          (
            <div
              className="boykovTop10__empty"
            >
              Пока недостаточно данных о просмотрах.
            </div>
          )
        }


        {
          !loading &&
          !error &&
          items.length >
            0 &&
          (
            <div
              className="boykovTop10__tableWrap"
            >

              <table
                className="boykovTop10__table"
              >

                <thead>
                  <tr>
                    <th>№</th>
                    <th>Инструкция</th>
                    <th>Всего</th>
                    <th>Сегодня</th>
                    <th>7 дней</th>
                    <th>30 дней</th>
                  </tr>
                </thead>


                <tbody>

                  {
                    items.map(
                      item => (

                        <tr
                          key={
                            item.id
                          }
                        >

                          <td
                            className="boykovTop10__rank"
                          >

                            <span
                              className={[
                                "boykovTop10__rankBadge",

                                item.rank <=
                                  3
                                  ? `boykovTop10__rankBadge--${item.rank}`
                                  : ""
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {item.rank}
                            </span>

                          </td>


                          <td
                            className="boykovTop10__instruction"
                          >

                            <a
                              className="boykovTop10__link"
                              href={`/instrukciya-po-ohrane-truda/${encodeURIComponent(
                                item.id
                              )}`}
                            >
                              {item.title}
                            </a>

                          </td>


                          <td
                            className={
                              metricClass(
                                "total"
                              )
                            }
                          >
                            {
                              formatNumber(
                                item.total
                              )
                            }
                          </td>


                          <td
                            className={
                              metricClass(
                                "today"
                              )
                            }
                          >
                            {
                              formatNumber(
                                item.today
                              )
                            }
                          </td>


                          <td
                            className={
                              metricClass(
                                "7d"
                              )
                            }
                          >
                            {
                              formatNumber(
                                item.last7Days
                              )
                            }
                          </td>


                          <td
                            className={
                              metricClass(
                                "30d"
                              )
                            }
                          >
                            {
                              formatNumber(
                                item.last30Days
                              )
                            }
                          </td>

                        </tr>

                      )
                    )
                  }

                </tbody>

              </table>

            </div>
          )
        }

      </div>

    </section>
  );

}
