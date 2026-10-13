import {
    useEffect,
    useState
} from "react";

import {
    useParams
} from "react-router-dom";

import {
    useSelector
} from "react-redux";

import {
    selectAuthToken,
    selectIsAdmin,
    selectIsRestoringSession
} from "../../../store/authSlice.js";

import {
    getInstructionViews,
    recordInstructionView,
    updateInstruction
} from "../../../api/instructionsApi.js";


export default function useInstructionPage() {

    const { id } = useParams();

    const isAdmin =
        useSelector(
            selectIsAdmin
        );

    const authToken =
        useSelector(
            selectAuthToken
        );

    const isRestoringSession =
        useSelector(
            selectIsRestoringSession
        );

    const [instruction, setInstruction] = useState(null);
    const [allInstructions, setAllInstructions] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [editOpen, setEditOpen] = useState(false);

    const [
        viewStats,
        setViewStats
    ] =
        useState(null);



    async function loadInstruction() {

        try {

            setLoading(true);

            const response = await fetch(
                `/api/instructions/${id}`
            );


            if (!response.ok) {
                throw new Error("Инструкция не найдена");
            }


            const data = await response.json();

            setInstruction(data);



            const listResponse = await fetch(
                "/api/instructions?page=1&pageSize=200"
            );


            const listData = await listResponse.json();

            setAllInstructions(
                listData.items || []
            );


            document.title =
                `${data.title} | БОЙКОВГРУПП`;


        } catch (err) {

            setError(err.message);

        } finally {

            setLoading(false);

        }

    }



    useEffect(() => {

        loadInstruction();

    }, [id]);



    /*
     * Один просмотр на одно открытие инструкции.
     *
     * Просмотры администратора production
     * намеренно не считает.
     */
    useEffect(() => {

        if (
            !id ||
            isRestoringSession
        ) {
            return;
        }


        if (isAdmin) {
            return;
        }


        recordInstructionView(
            id
        )
        .catch(
            () => {}
        );

    }, [
        id,
        isAdmin,
        isRestoringSession
    ]);


    /*
     * Статистика просмотров видна
     * только администратору.
     */
    useEffect(() => {

        if (
            !id ||
            isRestoringSession ||
            !isAdmin ||
            !authToken
        ) {

            setViewStats(
                null
            );

            return undefined;

        }


        let cancelled =
            false;


        getInstructionViews(
            id,
            authToken
        )
        .then(
            data => {

                if (!cancelled) {

                    setViewStats(
                        data
                    );

                }

            }
        )
        .catch(
            () => {

                if (!cancelled) {

                    setViewStats(
                        null
                    );

                }

            }
        );


        return () => {

            cancelled =
                true;

        };

    }, [
        id,
        authToken,
        isAdmin,
        isRestoringSession
    ]);




    async function saveInstruction(updated) {

        if (!authToken) {
            return;
        }


        try {

            const saved =
                await updateInstruction(
                    instruction.id,
                    updated,
                    authToken
                );


            setInstruction(
                saved
            );


            setEditOpen(
                false
            );

        }
        catch(error) {

            console.error(
                "Instruction save error:",
                error
            );

        }

    }


    return {
        instruction,
        allInstructions,
        loading,
        error,
        editOpen,
        setEditOpen,
        isAdmin,
        viewStats,
        saveInstruction
    };

}
