import {useEffect, useState} from "react";
import {useSelector} from "react-redux";

import {selectAuthToken} from "../../store/authSlice.js";

import styles from "./ImportManager.module.css";


export default function ImportManager({
                                          importId, onComplete
                                      }) {


    const token =
        useSelector(selectAuthToken);


    const [progress, setProgress] =
        useState(null);


    const [error, setError] =
        useState("");

    useEffect(() => {


        if (!importId) {
            return;
        }


        let timer;


        async function loadProgress() {
            try {
                const response =
                    await fetch(
                        `/api/instructions/imports/${importId}`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            }
                        }
                    );

                if (!response.ok) {

                    throw new Error(
                        "Не удалось получить статус импорта"
                    );

                }

                const data =
                    await response.json();

                setProgress(
                    data
                );

               if (
    data.status === "completed"
) {

    clearInterval(timer);


    setTimeout(()=>{

        if(onComplete){

            onComplete();

        }

    },2000);


}



if(
    data.status === "failed"
){

    clearInterval(timer);

}

            } catch (err) {
                setError(
                    err.message
                );
            }
        }

        loadProgress();

        timer =
            setInterval(
                loadProgress,
                2000
            );

        return () => {
            clearInterval(timer);
        };
    }, [importId, token]);


    if (!importId) {
        return null;
    }

    if (error) {
        return (
            <div className={styles.box}>
                Ошибка:
                {" "}
                {error}
            </div>

        );

    }


    if (!progress) {
        return (
            <div className={styles.box}>
                Запуск импорта...
            </div>
        );
    }

    return (
        <div className={styles.box}>
            <div className={styles.header}>

  <strong className={styles.title}>
    Импорт документов
  </strong>


  <span className={styles.percent}>

    {progress.progress || 0}%

  </span>


</div>

            <div className={styles.progress}>
                <div
                    className={styles.progressFill}
                    style={{
                        width:
                            `${progress.progress || 0}%`
                    }}
                />
            </div>
            <div className={styles.info}>
                Обработано:
                {" "}
                {progress.completed}
                {" / "}
                {progress.total}
            </div>


            {
                progress.failed > 0 &&
                <div className={styles.errorCount}>

                    Ошибок:
                    {" "}
                    {progress.failed}
                </div>

            }


            <div className={styles.status}>


                Статус:

                {" "}

                {translateStatus(
                    progress.status
                )}


            </div>
</div>

    );


}


function translateStatus(status) {


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
        map[status]
        ||
        status
    );


}