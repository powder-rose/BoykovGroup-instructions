import styles from "../AdminPanel/AdminPanel.module.css";


import AdminGenerationRecentTable from "./AdminGenerationRecentTable.jsx";
import AdminGenerationSummaryCards from "./AdminGenerationSummaryCards.jsx";

export default function AdminGenerationStats({

  stats,
  statsError

}) {

  return (

    <div className={styles.statsBlock}>

      <div className={styles.statsHeader}>

        <div>

          <div className={styles.statsEyebrow}>
            YandexGPT
          </div>

          <h2 className={styles.statsTitle}>
            Расходы на генерацию
          </h2>

        </div>

        {
          stats?.trackingStarted &&
          (
            <div className={styles.tracking}>
              учёт с{" "}
              {
                new Date(
                  stats.trackingStarted
                )
                  .toLocaleString(
                    "ru-RU"
                  )
              }
            </div>
          )
        }

      </div>


      {
        statsError &&
        (
          <div className={styles.statsError}>
            {statsError}
          </div>
        )
      }


      {
        stats &&
        (
          <>
            <AdminGenerationSummaryCards
              stats={
                stats
              }
            />


            <AdminGenerationRecentTable
              recent={
                stats.recent
              }
            />

          </>
        )
      }

    </div>

  );

}
