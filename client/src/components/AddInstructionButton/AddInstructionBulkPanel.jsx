import styles from "./AddInstructionButton.module.css";


export default function AddInstructionBulkPanel({

    bulkPhase,
    statusText,
    bulkBatchId,

    uploadedCount,
    files,

    processingDone,
    processingTotal,
    bulkProgress,

    bulkError,
    failedFiles,

    handleStop,
    handleResume,
    onClose

}) {

    return (

        <div
            className={
                styles.bulkPanel
            }
        >

            <div
                className={
                    styles.bulkStatus
                }
            >
                {statusText}
            </div>


            {
                bulkBatchId &&
                (

                    <div
                        className={
                            styles.bulkId
                        }
                    >
                        ID: {bulkBatchId}
                    </div>

                )
            }


            {
                bulkPhase === "uploading" &&
                (

                    <>

                        <div
                            className={
                                styles.progressLabel
                            }
                        >
                            Загружено на сервер:{" "}
                            {uploadedCount} / {files.length}
                        </div>


                        <div
                            className={
                                styles.progressTrack
                            }
                        >
                            <div
                                className={
                                    styles.progressBar
                                }

                                style={{
                                    width:
                                        `${
                                            files.length
                                                ? Math.round(
                                                    uploadedCount /
                                                    files.length *
                                                    100
                                                )
                                                : 0
                                        }%`
                                }}
                            />
                        </div>

                    </>

                )
            }


            {
                [
                    "starting",
                    "processing",
                    "stopping",
                    "paused",
                    "completed"
                ].includes(
                    bulkPhase
                ) &&
                bulkProgress &&
                (

                    <>

                        <div
                            className={
                                styles.progressLabel
                            }
                        >
                            Обработано:{" "}
                            {processingDone} / {processingTotal}
                        </div>


                        <div
                            className={
                                styles.progressTrack
                            }
                        >
                            <div
                                className={
                                    styles.progressBar
                                }

                                style={{
                                    width:
                                        `${bulkProgress.progress || 0}%`
                                }}
                            />
                        </div>


                        <div
                            className={
                                styles.bulkStats
                            }
                        >

                            <div>
                                В очереди:{" "}
                                <strong>
                                    {bulkProgress.waiting || 0}
                                </strong>
                            </div>

                            <div>
                                Обрабатывается:{" "}
                                <strong>
                                    {bulkProgress.processing || 0}
                                </strong>
                            </div>

                            <div>
                                Успешно:{" "}
                                <strong>
                                    {bulkProgress.completed || 0}
                                </strong>
                            </div>

                            <div>
                                Ошибок:{" "}
                                <strong>
                                    {bulkProgress.failed || 0}
                                </strong>
                            </div>

                            <div>
                                Новых:{" "}
                                <strong>
                                    {bulkProgress.created || 0}
                                </strong>
                            </div>

                            <div>
                                Дубликатов:{" "}
                                <strong>
                                    {bulkProgress.duplicates || 0}
                                </strong>
                            </div>

                            <div>
                                Новых версий:{" "}
                                <strong>
                                    {bulkProgress.updatedVersions || 0}
                                </strong>
                            </div>

                        </div>

                    </>

                )
            }


            {
                bulkError &&
                (

                    <p
                        className={
                            styles.error
                        }
                    >
                        {bulkError}
                    </p>

                )
            }


            {
                failedFiles.length > 0 &&
                (

                    <div
                        className={
                            styles.failedFiles
                        }
                    >

                        <strong>
                            Ошибки файлов
                        </strong>


                        {
                            failedFiles.map(
                                (file) => (

                                    <div
                                        key={
                                            file.id
                                        }

                                        className={
                                            styles.failedFile
                                        }
                                    >

                                        <div>
                                            {file.name}
                                        </div>

                                        <div>
                                            {
                                                file.error ||
                                                "Ошибка обработки"
                                            }
                                        </div>

                                    </div>

                                )
                            )
                        }

                    </div>

                )
            }


            <div
                className={
                    styles.bulkActions
                }
            >

                {
                    bulkPhase === "processing" &&
                    (

                        <button
                            type="button"

                            className={
                                styles.stopButton
                            }

                            onClick={
                                handleStop
                            }
                        >
                            Остановить импорт
                        </button>

                    )
                }


                {
                    bulkPhase === "paused" &&
                    (

                        <button
                            type="button"

                            className={
                                styles.submit
                            }

                            onClick={
                                handleResume
                            }
                        >
                            Продолжить импорт
                        </button>

                    )
                }


                {
                    [
                        "completed",
                        "error",
                        "paused"
                    ].includes(
                        bulkPhase
                    ) &&
                    (

                        <button
                            type="button"

                            className={
                                styles.secondaryButton
                            }

                            onClick={
                                onClose
                            }
                        >
                            Закрыть
                        </button>

                    )
                }

            </div>

        </div>

    );

}
