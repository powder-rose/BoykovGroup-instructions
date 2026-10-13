import AdminInstructionTop10Table
  from "./AdminInstructionTop10Table.jsx";

import useAdminInstructionTop10
  from "./hooks/useAdminInstructionTop10.js";

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


export default function AdminInstructionTop10({
  token,
  hidden = false
}) {

  const {
    period,
    setPeriod,
    items,
    loading,
    error
  } =
    useAdminInstructionTop10(
      token
    );


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
            <AdminInstructionTop10Table
              items={
                items
              }
              period={
                period
              }
            />
          )
        }

      </div>

    </section>
  );

}
