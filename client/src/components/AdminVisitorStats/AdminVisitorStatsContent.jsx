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


export default function AdminVisitorStatsContent({

  data,
  loading,
  error

}) {

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
  );

}
