import {
    useEffect,
    useState
} from "react";

import {
    useSelector
} from "react-redux";

import {
    selectAuthToken
} from "../../../store/authSlice.js";


export default function useImportProgress({
    importId,
    onComplete
}) {

    const token =
        useSelector(
            selectAuthToken
        );


    const [
        progress,
        setProgress
    ] =
        useState(null);


    const [
        error,
        setError
    ] =
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
                    data.status ===
                    "completed"
                ) {

                    clearInterval(
                        timer
                    );


                    setTimeout(
                        () => {

                            if (
                                onComplete
                            ) {

                                onComplete();

                            }

                        },
                        2000
                    );

                }


                if (
                    data.status ===
                    "failed"
                ) {

                    clearInterval(
                        timer
                    );

                }

            }
            catch (err) {

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

            clearInterval(
                timer
            );

        };

    }, [
        importId,
        token
    ]);


    return {
        progress,
        error
    };

}
