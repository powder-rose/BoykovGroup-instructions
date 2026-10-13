import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    useDispatch
} from "react-redux";

import {
    searchInstructions
} from "../../../store/instructionsSlice.js";

import {
    createBulkImport,
    uploadBulkImportChunk,
    startBulkImport,
    getBulkImportProgress,
    getBulkImportFiles,
    stopBulkImport,
    resumeBulkImport
} from "../../../api/instructionsApi.js";

import {
    MAX_FILE_SIZE,
    MAX_FILES,
    POLL_INTERVAL,
    ACTIVE_BATCH_KEY,
    sleep,
    makeChunks,
    getStatusText
} from "../addInstructionBulkImportUtils.js";


export default function useAddInstructionBulkImport({

    token,
    currentQuery,
    files

}) {

    const dispatch =
        useDispatch();


    const [bulkPhase, setBulkPhase] =
        useState("idle");

    const [bulkBatchId, setBulkBatchId] =
        useState(null);

    const [uploadedCount, setUploadedCount] =
        useState(0);

    const [bulkProgress, setBulkProgress] =
        useState(null);

    const [bulkError, setBulkError] =
        useState(null);

    const [failedFiles, setFailedFiles] =
        useState([]);

    const pollingRunRef =
        useRef(0);


    const bulkBusy =
        [
            "creating",
            "uploading",
            "starting",
            "processing",
            "stopping"
        ].includes(
            bulkPhase
        );


    async function loadFailedFiles(
        batchId
    ) {

        try {

            const result =
                await getBulkImportFiles(
                    batchId,
                    token,
                    {
                        status:
                            "failed",

                        limit:
                            200
                    }
                );


            setFailedFiles(
                result?.items || []
            );

        }
        catch {

            /*
             * Основной import уже завершён.
             * Ошибка загрузки детализации не должна
             * менять его итоговый статус.
             */

        }

    }


    async function pollBatch(
        batchId
    ) {

        const runId =
            ++pollingRunRef.current;


        while (
            runId ===
            pollingRunRef.current
        ) {

            const progress =
                await getBulkImportProgress(
                    batchId,
                    token
                );


            if (
                runId !==
                pollingRunRef.current
            ) {
                return;
            }


            setBulkProgress(
                progress
            );


            if (
                progress.status ===
                "completed"
            ) {

                setBulkPhase(
                    "completed"
                );

                localStorage.removeItem(
                    ACTIVE_BATCH_KEY
                );


                await loadFailedFiles(
                    batchId
                );


                dispatch(
                    searchInstructions({
                        query:
                            currentQuery,

                        page:
                            1
                    })
                );


                return;
            }


            if (
                progress.status ===
                "paused"
            ) {

                setBulkPhase(
                    "paused"
                );

                return;
            }


            setBulkPhase(
                "processing"
            );


            await sleep(
                POLL_INTERVAL
            );

        }

    }


    useEffect(
        () => {

            if (!token) {
                return;
            }


            const storedBatchId =
                localStorage.getItem(
                    ACTIVE_BATCH_KEY
                );


            if (!storedBatchId) {
                return;
            }


            let cancelled =
                false;


            (async () => {

                try {

                    const progress =
                        await getBulkImportProgress(
                            storedBatchId,
                            token
                        );


                    if (cancelled) {
                        return;
                    }


                    setBulkBatchId(
                        storedBatchId
                    );

                    setBulkProgress(
                        progress
                    );


                    if (
                        progress.status ===
                        "completed"
                    ) {

                        setBulkPhase(
                            "completed"
                        );

                        localStorage.removeItem(
                            ACTIVE_BATCH_KEY
                        );

                        await loadFailedFiles(
                            storedBatchId
                        );

                        return;
                    }


                    if (
                        progress.status ===
                        "paused"
                    ) {

                        setBulkPhase(
                            "paused"
                        );

                        return;
                    }


                    if (
                        progress.status ===
                        "running"
                    ) {

                        setBulkPhase(
                            "processing"
                        );

                        await pollBatch(
                            storedBatchId
                        );

                        return;
                    }


                    /*
                     * uploading означает, что браузер
                     * не успел отправить все File objects
                     * перед перезагрузкой.
                     *
                     * Автоматически продолжить transfer
                     * браузер уже не может.
                     */
                    localStorage.removeItem(
                        ACTIVE_BATCH_KEY
                    );

                }
                catch {

                    localStorage.removeItem(
                        ACTIVE_BATCH_KEY
                    );

                }

            })();


            return () => {

                cancelled =
                    true;

                pollingRunRef.current++;

            };

        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [token]
    );


    function validateFiles() {

        if (
            files.length >
            MAX_FILES
        ) {

            throw new Error(
                `За один импорт можно выбрать не более ${MAX_FILES} файлов`
            );

        }


        const tooLarge =
            files.find(
                (file) =>
                    file.size >
                    MAX_FILE_SIZE
            );


        if (tooLarge) {

            throw new Error(
                `Файл "${tooLarge.name}" превышает лимит 15 МБ`
            );

        }

    }


    async function handleBulkSubmit() {

        validateFiles();


        setBulkError(null);

        setFailedFiles([]);

        setUploadedCount(0);

        setBulkProgress(null);

        setBulkPhase(
            "creating"
        );


        const created =
            await createBulkImport(
                files.length,
                token
            );


        const batchId =
            created.id;


        setBulkBatchId(
            batchId
        );

        setBulkProgress(
            created
        );

        setBulkPhase(
            "uploading"
        );


        const chunks =
            makeChunks(files);

        let uploaded =
            0;


        for (
            const chunk
            of chunks
        ) {

            const progress =
                await uploadBulkImportChunk(
                    batchId,
                    chunk,
                    token
                );


            uploaded +=
                chunk.length;


            setUploadedCount(
                uploaded
            );

            setBulkProgress(
                progress
            );

        }


        setBulkPhase(
            "starting"
        );


        const started =
            await startBulkImport(
                batchId,
                token
            );


        setBulkProgress(
            started
        );


        localStorage.setItem(
            ACTIVE_BATCH_KEY,
            batchId
        );


        setBulkPhase(
            "processing"
        );


        await pollBatch(
            batchId
        );

    }


    async function handleStop() {

        if (
            !bulkBatchId ||
            bulkPhase !== "processing"
        ) {
            return;
        }


        try {

            setBulkPhase(
                "stopping"
            );


            const progress =
                await stopBulkImport(
                    bulkBatchId,
                    token
                );


            pollingRunRef.current++;


            setBulkProgress(
                progress
            );

            setBulkPhase(
                "paused"
            );

        }
        catch (error) {

            setBulkError(
                error?.message ||
                "Не удалось остановить импорт"
            );

            setBulkPhase(
                "error"
            );

        }

    }


    async function handleResume() {

        if (
            !bulkBatchId ||
            bulkPhase !== "paused"
        ) {
            return;
        }


        try {

            setBulkError(null);


            const progress =
                await resumeBulkImport(
                    bulkBatchId,
                    token
                );


            setBulkProgress(
                progress
            );


            localStorage.setItem(
                ACTIVE_BATCH_KEY,
                bulkBatchId
            );


            setBulkPhase(
                "processing"
            );


            await pollBatch(
                bulkBatchId
            );

        }
        catch (error) {

            setBulkError(
                error?.message ||
                "Не удалось продолжить импорт"
            );

            setBulkPhase(
                "error"
            );

        }

    }


    const processingDone =
        (
            bulkProgress?.completed ||
            0
        ) +
        (
            bulkProgress?.failed ||
            0
        );


    const processingTotal =
        bulkProgress?.total ||
        files.length ||
        0;


    const statusText =
        getStatusText(
            bulkPhase,
            bulkProgress
        );


    return {
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
    };

}
