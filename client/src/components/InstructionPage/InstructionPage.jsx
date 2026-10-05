import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector } from "react-redux";

import SEO from "../SEO/SEO.jsx";
import InstructionStickyHeader from "../InstructionStickyHeader/InstructionStickyHeader.jsx";
import StructuredData from "../StructuredData/StructuredData.jsx";
import Breadcrumbs from "../Breadcrumbs/Breadcrumbs.jsx";
import MetaTags from "../MetaTags/MetaTags.jsx";
import InstructionSeoBlock from "../InstructionSeoBlock/InstructionSeoBlock.jsx";
import RelatedInstructions from "../RelatedInstructions/RelatedInstructions.jsx";
import EditInstructionModal from "../EditInstructionModal/EditInstructionModal.jsx";
import InstructionPdfDownload from "../InstructionPdfDownload/InstructionPdfDownload.jsx";

import {
    selectAuthToken,
    selectIsAdmin,
    selectIsRestoringSession
} from "../../store/authSlice.js";

import {
    getInstructionViews,
    recordInstructionView,
    updateInstruction
} from "../../api/instructionsApi.js";

import styles from "./InstructionPage.module.css";



function renderInstructionParagraph(
    paragraph,
    index
) {
    const text =
        String(paragraph ?? "").trim();

    /*
     * Встроенный список:
     *
     * 1.4. Работник должен: - пункт; - пункт; - пункт.
     */
    if (!/:\\s*-\\s+/.test(text)) {
        return (
            <p key={index}>
                {text}
            </p>
        );
    }

    const parts =
        text.split(/\\s+-\\s+/);

    const lead =
        parts.shift()?.trim();

    const items =
        parts
            .map(item =>
                item
                    .trim()
                    .replace(/;\\s*$/, "")
            )
            .filter(Boolean);

    /*
     * Один дефис ещё не считаем списком.
     */
    if (
        !lead ||
        items.length < 2
    ) {
        return (
            <p key={index}>
                {text}
            </p>
        );
    }

    return (
        <div
            key={index}
            className={styles.paragraphWithList}
        >
            <p className={styles.paragraphLead}>
                {lead}
            </p>

            <ul className={styles.inlineList}>
                {items.map(
                    (item, itemIndex) => (
                        <li key={itemIndex}>
                            {item}
                        </li>
                    )
                )}
            </ul>
        </div>
    );
}


export default function InstructionPage() {

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



    if (loading) {

        return (
            <div className={styles.page}>
                Загрузка инструкции...
            </div>
        );

    }



    if (error || !instruction) {

        return (
            <div className={styles.page}>

                <h1>
                    Инструкция не найдена
                </h1>

                <Link to="/">
                    Вернуться на главную
                </Link>

            </div>
        );

    }




    const breadcrumbSchema = {

        "@context": "https://schema.org",

        "@type": "BreadcrumbList",

        "itemListElement": [

            {
                "@type": "ListItem",
                "position": 1,
                "name": "Главная",
                "item": "https://boykovdocs.ru/"
            },


            {
                "@type": "ListItem",
                "position": 2,
                "name": "Инструкции по охране труда",
                "item": "https://boykovdocs.ru/instrukcii-po-ohrane-truda"
            },


            {
                "@type": "ListItem",
                "position": 3,
                "name": instruction.title,
                "item":
                    `https://boykovdocs.ru/instrukciya-po-ohrane-truda/${instruction.id}`
            }

        ]

    };




    return (

        <div className={styles.page}>


            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumbSchema)
                }}
            />



            <InstructionStickyHeader />

            <main className={styles.content}>


                <SEO
                    title={`${instruction.title} | БОЙКОВГРУПП`}
                    description={
                        `Инструкция по охране труда для профессии ${instruction.profession}. Требования безопасности, порядок выполнения работ и обязанности работника.`
                    }
                />



                <StructuredData
                    instruction={instruction}
                />



                <MetaTags

                    title={`${instruction.title} | БОЙКОВГРУПП`}

                    description={
                        `Инструкция по охране труда для профессии ${instruction.profession}. Требования безопасности и порядок выполнения работ.`
                    }

                />



                <Link
                    to="/"
                    className={styles.back}
                >
                    ← Все инструкции
                </Link>




                <article>


                    <Breadcrumbs
                        instruction={instruction}
                    />



                    <h1 className={styles.title}>
                        {instruction.title}
                    </h1>


                    <InstructionPdfDownload
                        instructionId={
                            instruction.id
                        }
                    />



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

                                onClick={() => setEditOpen(true)}

                            >

                                Редактировать статью

                            </button>

                        )}


                    </div>





                    <p className={styles.intro}>
                        {instruction.intro}
                    </p>



                    <InstructionSeoBlock
                        instruction={instruction}
                    />





                    <div className={styles.toc}>


                        <h2>
                            Содержание
                        </h2>



                        {instruction.sections.map(section => (

                            <a
                                key={section.number}
                                href={`#section-${section.number}`}
                            >

                                Раздел {section.number}. {section.heading}

                            </a>

                        ))}


                    </div>






                    <div className={styles.sections}>


                        {instruction.sections.map(section => (

                            <section

                                key={section.number}

                                id={`section-${section.number}`}

                                className={styles.section}

                            >

                                <h2>
                                    {section.heading}
                                </h2>


                                {section.paragraphs.map(
                                    (paragraph, index) =>
                                        renderInstructionParagraph(
                                            paragraph,
                                            index
                                        )
                                )}


                            </section>

                        ))}


                    </div>






                    <RelatedInstructions

                        currentId={instruction.id}

                        instructions={allInstructions}

                    />



                </article>



            </main>





            {editOpen && (

                <EditInstructionModal

                    instruction={instruction}

                    onClose={() => setEditOpen(false)}

                    onSave={saveInstruction}

                />

            )}



        </div>

    );

}
