import styles from "../AdminPanel/AdminPanel.module.css";

import {
  number,
  rub
} from "./generationStatsFormatters.js";


export default function AdminGenerationSummaryCards({

  stats

}) {

  return (

    <div className={styles.cards}>

      <div className={styles.card}>

        <span className={styles.cardLabel}>
          Сегодня
        </span>

        <strong className={styles.cardValue}>
          {
            number(
              stats.today
                ?.generations
            )
          }
        </strong>

        <span className={styles.cardMeta}>
          генераций ·{" "}
          {
            rub(
              stats.today
                ?.costRub
            )
          }
        </span>

      </div>


      <div className={styles.card}>

        <span className={styles.cardLabel}>
          За месяц
        </span>

        <strong className={styles.cardValue}>
          {
            rub(
              stats.month
                ?.costRub
            )
          }
        </strong>

        <span className={styles.cardMeta}>
          {
            number(
              stats.month
                ?.generations
            )
          }
          {" "}
          генераций
        </span>

      </div>


      <div className={styles.card}>

        <span className={styles.cardLabel}>
          Всего
        </span>

        <strong className={styles.cardValue}>
          {
            rub(
              stats.total
                ?.costRub
            )
          }
        </strong>

        <span className={styles.cardMeta}>
          {
            number(
              stats.total
                ?.apiCalls
            )
          }
          {" "}
          API-запросов
        </span>

      </div>


      <div className={styles.card}>

        <span className={styles.cardLabel}>
          Средняя генерация
        </span>

        <strong className={styles.cardValue}>
          {
            rub(
              stats.total
                ?.averageCostRub
            )
          }
        </strong>

        <span className={styles.cardMeta}>
          {
            number(
              stats.total
                ?.totalTokens
            )
          }
          {" "}
          токенов всего
        </span>

      </div>

    </div>

  );

}
