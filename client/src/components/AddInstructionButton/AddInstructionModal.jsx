import {useEffect, useRef, useState} from "react";
import {useDispatch, useSelector} from "react-redux";
import {uploadInstruction} from "../../store/instructionsSlice.js";
import styles from "./AddInstructionButton.module.css";

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.txt,.md";


export default function AddInstructionModal({onClose, onImportCreated}) {

    const dispatch = useDispatch();

    const isUploading = useSelector(
        (state) => state.instructions.isUploading
    );

    const uploadError = useSelector(
        (state) => state.instructions.uploadError
    );


    const [mode, setMode] = useState("file");

    const [manualText, setManualText] = useState("");

    const [files, setFiles] = useState([]);

    const fileInputRef = useRef(null);


    useEffect(() => {

        function handleKeyDown(e) {

            if (e.key === "Escape") {
                onClose();
            }

        }


        document.addEventListener(
            "keydown",
            handleKeyDown
        );


        return () => {

            document.removeEventListener(
                "keydown",
                handleKeyDown
            );

        };

    }, [onClose]);


    const isReady =
        mode === "file"
            ? files.length > 0
            : manualText.trim().length > 0;


    async function handleSubmit(e) {

        e.preventDefault();


        if (!isReady) {
            return;
        }


        const formData = new FormData();


        if (mode === "file") {


            files.forEach((file) => {

                formData.append(
                    "files",
                    file
                );

            });


        } else {


            formData.append(
                "content",
                manualText.trim()
            );


        }


        const result =
            await dispatch(
                uploadInstruction(formData)
            );


        if (result?.importId) {


            onImportCreated(
                result.importId
            );


        }


    }


    return (

        <div
            className={styles.overlay}
            onClick={onClose}
        >


            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >


                <button
                    type="button"
                    className={styles.close}
                    onClick={onClose}
                >
                    ×
                </button>


                <h2 className={styles.title}>
                    Добавить инструкцию
                </h2>


                <div className={styles.modeSwitch}>


                    <button
                        type="button"
                        className={
                            mode === "file"
                                ? styles.modeBtnActive
                                : styles.modeBtn
                        }
                        onClick={() => setMode("file")}
                    >
                        Файл
                    </button>


                    <button
                        type="button"
                        className={
                            mode === "text"
                                ? styles.modeBtnActive
                                : styles.modeBtn
                        }
                        onClick={() => setMode("text")}
                    >
                        Текст
                    </button>


                </div>


                <form
                    onSubmit={handleSubmit}
                    className={styles.form}
                >


                    {mode === "file" ? (


                        <label className={styles.field}>


              <span className={styles.label}>
                Выберите документы
              </span>


                            <input

                                ref={fileInputRef}

                                className={styles.fileInput}

                                type="file"

                                multiple

                                accept={ACCEPTED_EXTENSIONS}

                                onChange={(e) => {

                                    setFiles(
                                        Array.from(
                                            e.target.files || []
                                        )
                                    );

                                }}

                            />


                            {files.length > 0 && (

                                <div className={styles.fileHint}>

                                    Загружено файлов:
                                    {" "}
                                    {files.length}

                                </div>

                            )}


                        </label>


                    ) : (


                        <label className={styles.field}>


              <span className={styles.label}>
                Текст инструкции
              </span>


                            <textarea

                                className={styles.textarea}

                                value={manualText}

                                onChange={(e) =>
                                    setManualText(e.target.value)
                                }

                                rows={8}

                            />


                        </label>


                    )}


                    {uploadError && (

                        <p className={styles.error}>
                            {uploadError}
                        </p>

                    )}


                    <button

                        type="submit"

                        className={styles.submit}

                        disabled={
                            isUploading ||
                            !isReady
                        }

                    >

                        {
                            isUploading
                                ? "Загрузка..."
                                : "Добавить"
                        }


                    </button>


                </form>


            </div>


        </div>

    );

}