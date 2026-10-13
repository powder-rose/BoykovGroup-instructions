import styles from "../AdminPanel/AdminPanel.module.css";

import {
  number,
  rub
} from "./generationStatsFormatters.js";


function getGenerationTypeLabel(source) {

  switch (source) {

    case "schedule":
      return "По расписанию";

    case "repair":
      return "Восстановление";

    case "import":
      return "Импорт";

    case "generation":
    default:
      return "Генерация";

  }

}


function getGenerationDisplayName(value) {

  const text =
    String(
      value || ""
    )
      .trim();


  if (!text) {

    return "—";

  }


  /*
   * Старые repair-записи могли сохранить весь системный prompt
   * вместо названия профессии.
   *
   * Ищем profession прямо внутри JSON, находящегося в prompt.
   */
  const professionMatch =
    text.match(
      /["']profession["']\s*:\s*["']([^"']+)["']/i
    );


  if (professionMatch?.[1]) {

    return professionMatch[1]
      .trim();

  }


  /*
   * Защита интерфейса на случай другой поврежденной записи.
   */
  if (
    text.includes(
      "Ты являешься редактором"
    ) ||
    text.includes(
      "Текущий документ:"
    ) ||
    text.includes(
      "Верни только JSON"
    )
  ) {

    return "Восстановление инструкции";

  }


  return text.length > 100
    ? `${text.slice(0, 97)}...`
    : text;

}


export default function AdminGenerationRecentTable({

  recent

}) {

  if (
    !recent?.length
  ) {

    return null;

  }


  return (

    <div className={styles.tableWrap}>

      <div className={styles.tableTitle}>
        Последние операции
      </div>

      <table className={styles.table}>

        <thead>

          <tr>

            <th>
              Тип
            </th>

            <th>
              Профессия
            </th>

            <th>
              API
            </th>

            <th>
              Вход
            </th>

            <th>
              Выход
            </th>

            <th>
              Стоимость
            </th>

          </tr>

        </thead>

        <tbody>

          {
            recent
              .slice(
                0,
                10
              )
              .map(
                item => (

                  <tr key={item.id}>

                    <td>
                      {
                        getGenerationTypeLabel(
                          item.source
                        )
                      }
                    </td>

                    <td>
                      {
                        getGenerationDisplayName(
                          item.profession
                        )
                      }
                    </td>

                    <td>
                      {
                        number(
                          item.apiCalls
                        )
                      }
                    </td>

                    <td>
                      {
                        number(
                          item.inputTokens
                        )
                      }
                    </td>

                    <td>
                      {
                        number(
                          item.outputTokens
                        )
                      }
                    </td>

                    <td>

                      <strong>
                        {
                          rub(
                            item.costRub
                          )
                        }
                      </strong>

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
