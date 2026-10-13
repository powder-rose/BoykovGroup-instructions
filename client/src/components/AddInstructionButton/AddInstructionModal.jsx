import {
    useEffect,
    useState
} from "react";

import {
    useDispatch,
    useSelector
} from "react-redux";

import {
    uploadInstruction
} from "../../store/instructionsSlice.js";

import {
    selectAuthToken
} from "../../store/authSlice.js";

import AddInstructionBulkPanel from "./AddInstructionBulkPanel.jsx";
import AddInstructionForm from "./AddInstructionForm.jsx";
import useAddInstructionBulkImport from "./hooks/useAddInstructionBulkImport.js";

import styles from "./AddInstructionButton.module.css";


export default function AddInstructionModal({
    onClose,
    onImportCreated
}) {

    const dispatch =
        useDispatch();

    const token =
        useSelector(
            selectAuthToken
        );

    const isUploading =
        useSelector(
            (state) =>
                state.instructions.isUploading
        );

    const uploadError =
        useSelector(
            (state) =>
                state.instructions.uploadError
        );

    const currentQuery =
        useSelector(
            (state) =>
                state.instructions.query
        );


    const [mode, setMode] =
        useState("file");

    const [manualText, setManualText] =
        useState("");

    const [files, setFiles] =
        useState([]);

    const {
        bulkPhase,
        setBulkPhase,

        bulkBatchId,
        uploadedCount,
        bulkProgress,

        bulkError,
        setBulkError,

        failedFiles,
        bulkBusy,

        handleBulkSubmit,
        handleStop,
        handleResume,

        processingDone,
        processingTotal,
        statusText
    } =
        useAddInstructionBulkImport({
            token,
            currentQuery,
            files
        });


    const isReady =
        mode === "file"
            ? files.length > 0
            : manualText.trim().length > 0;


    useEffect(
        () => {

            function handleKeyDown(e) {

                if (
                    e.key === "Escape" &&
                    !bulkBusy &&
                    !isUploading
                ) {
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

        },
        [
            onClose,
            bulkBusy,
            isUploading
        ]
    );


    async function handleManualSubmit() {

        const formData =
            new FormData();


        formData.append(
            "content",
            manualText.trim()
        );


        const result =
            await dispatch(
                uploadInstruction(
                    formData
                )
            );


        if (
            result?.importId
        ) {

            onImportCreated(
                result.importId
            );

        }

    }


    async function handleSubmit(e) {

        e.preventDefault();


        if (
            !isReady ||
            bulkBusy ||
            isUploading
        ) {
            return;
        }


        try {

            if (
                mode === "file"
            ) {

                await handleBulkSubmit();

            }
            else {

                await handleManualSubmit();

            }

        }
        catch (error) {

            console.error(
                "Bulk import error:",
                error
            );


            setBulkError(
                error?.message ||
                "Ошибка массового импорта"
            );


            setBulkPhase(
                "error"
            );

        }

    }


    return (

        <div
            className={styles.overlay}

            onClick={
                () => {

                    if (
                        !bulkBusy &&
                        !isUploading
                    ) {
                        onClose();
                    }

                }
            }
        >

            <div
                className={styles.modal}

                role="dialog"

                aria-modal="true"

                onClick={
                    (e) =>
                        e.stopPropagation()
                }
            >

                <button
                    type="button"

                    className={styles.close}

                    disabled={
                        bulkBusy ||
                        isUploading
                    }

                    onClick={onClose}
                >
                    ×
                </button>


                <h2
                    className={styles.title}
                >
                    Добавить инструкцию
                </h2>


                {
                    bulkPhase === "idle"
                    ? (

                        <AddInstructionForm
                            mode={
                                mode
                            }
                            setMode={
                                setMode
                            }
                            files={
                                files
                            }
                            setFiles={
                                setFiles
                            }
                            manualText={
                                manualText
                            }
                            setManualText={
                                setManualText
                            }
                            bulkError={
                                bulkError
                            }
                            setBulkError={
                                setBulkError
                            }
                            uploadError={
                                uploadError
                            }
                            isUploading={
                                isUploading
                            }
                            bulkBusy={
                                bulkBusy
                            }
                            isReady={
                                isReady
                            }
                            handleSubmit={
                                handleSubmit
                            }
                        />

                    )
                    : (

                        <AddInstructionBulkPanel
                            bulkPhase={
                                bulkPhase
                            }
                            statusText={
                                statusText
                            }
                            bulkBatchId={
                                bulkBatchId
                            }
                            uploadedCount={
                                uploadedCount
                            }
                            files={
                                files
                            }
                            processingDone={
                                processingDone
                            }
                            processingTotal={
                                processingTotal
                            }
                            bulkProgress={
                                bulkProgress
                            }
                            bulkError={
                                bulkError
                            }
                            failedFiles={
                                failedFiles
                            }
                            handleStop={
                                handleStop
                            }
                            handleResume={
                                handleResume
                            }
                            onClose={
                                onClose
                            }
                        />

                    )
                }

            </div>

        </div>

    );
}
