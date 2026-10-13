import useImportProgress
  from "./hooks/useImportProgress.js";

import styles
  from "./ImportManager.module.css";


function translateStatus(
  status
) {

  const map = {
    waiting:
      "ожидание",

    processing:
      "обработка",

    completed:
      "завершено",

    failed:
      "ошибка"
  };


  return (
    map[status] ||
    status
  );

}


export default function ImportManager({
  importId,
  onComplete
}) {

  const {
    progress,
    error
  } =
    useImportProgress({
      importId,
      onComplete
    });


  if (!importId) {
    return null;
  }


  if (error) {

    return (
      <div
        className={
          styles.box
        }
      >
        Ошибка:{" "}
        {error}
      </div>
    );

  }


  if (!progress) {

    return (
      <div
        className={
          styles.box
        }
      >
        Запуск импорта...
      </div>
    );

  }


  return (
    <div
      className={
        styles.box
      }
    >

      <div
        className={
          styles.header
        }
      >

        <strong
          className={
            styles.title
          }
        >
          Импорт документов
        </strong>


        <span
          className={
            styles.percent
          }
        >
          {
            progress.progress ||
            0
          }%
        </span>

      </div>


      <div
        className={
          styles.progress
        }
      >

        <div
          className={
            styles.progressFill
          }
          style={{
            width:
              `${progress.progress || 0}%`
          }}
        />

      </div>


      <div
        className={
          styles.info
        }
      >
        Обработано:{" "}
        {progress.completed}
        {" / "}
        {progress.total}
      </div>


      {
        progress.failed >
          0 &&
        (
          <div
            className={
              styles.errorCount
            }
          >
            Ошибок:{" "}
            {progress.failed}
          </div>
        )
      }


      <div
        className={
          styles.status
        }
      >
        Статус:{" "}
        {
          translateStatus(
            progress.status
          )
        }
      </div>

    </div>
  );

}
