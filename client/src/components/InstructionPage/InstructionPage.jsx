import { Link } from "react-router-dom";
import SEO from "../SEO/SEO.jsx";
import InstructionStickyHeader from "../InstructionStickyHeader/InstructionStickyHeader.jsx";
import StructuredData from "../StructuredData/StructuredData.jsx";
import Breadcrumbs from "../Breadcrumbs/Breadcrumbs.jsx";
import MetaTags from "../MetaTags/MetaTags.jsx";
import InstructionSeoBlock from "../InstructionSeoBlock/InstructionSeoBlock.jsx";
import RelatedInstructions from "../RelatedInstructions/RelatedInstructions.jsx";
import EditInstructionModal from "../EditInstructionModal/EditInstructionModal.jsx";
import InstructionPdfDownload from "../InstructionPdfDownload/InstructionPdfDownload.jsx";

import InstructionArticleMeta
    from "./InstructionArticleMeta.jsx";

import InstructionSections
    from "./InstructionSections.jsx";

import InstructionTableOfContents
    from "./InstructionTableOfContents.jsx";

import useInstructionPage
    from "./hooks/useInstructionPage.js";

import styles from "./InstructionPage.module.css";



export default function InstructionPage() {

    const {
        instruction,
        allInstructions,
        loading,
        error,
        editOpen,
        setEditOpen,
        isAdmin,
        viewStats,
        saveInstruction
    } =
        useInstructionPage();


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



                    <InstructionArticleMeta
                        instruction={
                            instruction
                        }
                        isAdmin={
                            isAdmin
                        }
                        viewStats={
                            viewStats
                        }
                        onEdit={
                            () =>
                                setEditOpen(
                                    true
                                )
                        }
                    />





                    <p className={styles.intro}>
                        {instruction.intro}
                    </p>



                    <InstructionSeoBlock
                        instruction={instruction}
                    />





                    <InstructionTableOfContents
                        sections={
                            instruction.sections
                        }
                    />






                    <InstructionSections
                        sections={
                            instruction.sections
                        }
                    />






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
