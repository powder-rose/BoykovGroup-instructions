import {
    useRef
} from "react";

import {
    ACCEPTED_EXTENSIONS
} from "./addInstructionBulkImportUtils.js";

import styles from "./AddInstructionButton.module.css";


export default function AddInstructionForm({

    mode,
    setMode,

    files,
    setFiles,

    manualText,
    setManualText,

    bulkError,
    setBulkError,
    uploadError,

    isUploading,
    bulkBusy,
    isReady,

    handleSubmit

}) {

    const fileInputRef =
        useRef(null);


    return (

        <>

            <div
                className={
                    styles.modeSwitch
                }
            >

                <button
                    type="button"

                    className={
                        mode === "file"
                            ? styles.modeBtnActive
                            : styles.modeBtn
                    }

                    onClick={
                        () =>
                            setMode("file")
                    }
                >
                    Файлы
                </button>


                <button
                    type="button"

                    className={
                        mode === "text"
                            ? styles.modeBtnActive
                            : styles.modeBtn
                    }

                    onClick={
                        () =>
                            setMode("text")
                    }
                >
                    Текст
                </button>

            </div>


            <form
                onSubmit={
                    handleSubmit
                }

                className={
                    styles.form
                }
            >

                {
                    mode === "file"
                    ? (

                        <label
                            className={
                                styles.field
                            }
                        >

                            <span
                                className={
                                    styles.label
                                }
                            >
                                Выберите документы
                            </span>


                            <input
                                ref={
                                    fileInputRef
                                }

                                className={
                                    styles.fileInput
                                }

                                type="file"

                                multiple

                                accept={
                                    ACCEPTED_EXTENSIONS
                                }

                                onChange={
                                    (e) => {

                                        setBulkError(
                                            null
                                        );

                                        setFiles(
                                            Array.from(
                                                e.target.files ||
                                                []
                                            )
                                        );

                                    }
                                }
                            />


                            {
                                files.length > 0 &&
                                (

                                    <div
                                        className={
                                            styles.fileHint
                                        }
                                    >
                                        Выбрано файлов:{" "}
                                        {files.length}
                                    </div>

                                )
                            }

                        </label>

                    )
                    : (

                        <label
                            className={
                                styles.field
                            }
                        >

                            <span
                                className={
                                    styles.label
                                }
                            >
                                Текст инструкции
                            </span>


                            <textarea
                                className={
                                    styles.textarea
                                }

                                value={
                                    manualText
                                }

                                onChange={
                                    (e) =>
                                        setManualText(
                                            e.target.value
                                        )
                                }

                                rows={8}
                            />

                        </label>

                    )
                }


                {
                    (
                        bulkError ||
                        uploadError
                    ) &&
                    (

                        <p
                            className={
                                styles.error
                            }
                        >
                            {
                                bulkError ||
                                uploadError
                            }
                        </p>

                    )
                }


                <button
                    type="submit"

                    className={
                        styles.submit
                    }

                    disabled={
                        isUploading ||
                        bulkBusy ||
                        !isReady
                    }
                >

                    {
                        isUploading
                            ? "Загрузка..."
                            : (
                                mode === "file"
                                    ? `Импортировать ${files.length || ""}`
                                    : "Добавить"
                            )
                    }

                </button>

            </form>

        </>

    );

}
