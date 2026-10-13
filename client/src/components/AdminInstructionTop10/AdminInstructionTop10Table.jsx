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


export default function AdminInstructionTop10Table({

  items,
  period

}) {

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
  );

}
