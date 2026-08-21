import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector } from "react-redux";

import SEO from "../SEO/SEO.jsx";
import Header from "../Header/Header.jsx";
import Navigation from "../Navigation/Navigation.jsx";
import StructuredData from "../StructuredData/StructuredData.jsx";
import Breadcrumbs from "../Breadcrumbs/Breadcrumbs.jsx";
import MetaTags from "../MetaTags/MetaTags.jsx";
import InstructionSeoBlock from "../InstructionSeoBlock/InstructionSeoBlock.jsx";
import RelatedInstructions from "../RelatedInstructions/RelatedInstructions.jsx";
import EditInstructionModal from "../EditInstructionModal/EditInstructionModal.jsx";

import { selectIsAdmin } from "../../store/authSlice.js";

import styles from "./InstructionPage.module.css";


export default function InstructionPage() {

    const { id } = useParams();

    const isAdmin = useSelector(selectIsAdmin);

    const [instruction, setInstruction] = useState(null);
    const [allInstructions, setAllInstructions] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [editOpen, setEditOpen] = useState(false);



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




    async function saveInstruction(updated) {

        const response = await fetch(
            `/api/instructions/${instruction.id}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(updated)
            }
        );


        if (response.ok) {

            const saved = await response.json();

            setInstruction(saved);

            setEditOpen(false);

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
                "item": "https://boykovgroup.ru/"
            },


            {
                "@type": "ListItem",
                "position": 2,
                "name": "Инструкции по охране труда",
                "item": "https://boykovgroup.ru/instrukcii-po-ohrane-truda"
            },


            {
                "@type": "ListItem",
                "position": 3,
                "name": instruction.title,
                "item":
                    `https://boykovgroup.ru/instrukciya-po-ohrane-truda/${instruction.id}`
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



            <div className={styles.siteHeader}>

                <Header
                    query=""
                    onQueryChange={() => {}}
                />

                <Navigation />

            </div>




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
                                    (paragraph,index)=>(

                                    <p key={index}>
                                        {paragraph}
                                    </p>

                                ))}


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