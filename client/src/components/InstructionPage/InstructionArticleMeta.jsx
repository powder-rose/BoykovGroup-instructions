import styles
    from "./InstructionPage.module.css";


export default function InstructionArticleMeta({

    instruction,
    isAdmin,
    viewStats,
    onEdit

}) {

    return (

        <div className={styles.articleMeta}>


            <div className={styles.versionInfo}>


                <span>
                    Версия документа: {instruction.version || "1.0"}
                </span>


                <span>
                    Обновлено:{" "}
                    {
                        instruction.updatedAt
                            ? new Date(
                                instruction.updatedAt
                            ).toLocaleDateString("ru-RU")
                            : new Date(
                                instruction.createdAt
                            ).toLocaleDateString("ru-RU")
                    }
                </span>


            </div>




            {
                isAdmin &&
                viewStats &&
                (
                    <div
                        className={
                            styles.viewCounter
                        }
                    >

                        <span
                            className={
                                styles.viewCounterLabel
                            }
                        >
                            Просмотры
                        </span>

                        <strong
                            className={
                                styles.viewCounterTotal
                            }
                        >
                            {
                                Number(
                                    viewStats.total || 0
                                )
                                .toLocaleString(
                                    "ru-RU"
                                )
                            }
                        </strong>

                        <span
                            className={
                                styles.viewCounterMeta
                            }
                        >
                            сегодня:{" "}
                            {
                                Number(
                                    viewStats.today || 0
                                )
                                .toLocaleString(
                                    "ru-RU"
                                )
                            }
                            {" · "}
                            7 дней:{" "}
                            {
                                Number(
                                    viewStats.last7Days || 0
                                )
                                .toLocaleString(
                                    "ru-RU"
                                )
                            }
                        </span>

                    </div>
                )
            }


            {isAdmin && (

                <button

                    className={styles.editButton}

                    onClick={onEdit}

                >

                    Редактировать статью

                </button>

            )}


        </div>

    );

}
