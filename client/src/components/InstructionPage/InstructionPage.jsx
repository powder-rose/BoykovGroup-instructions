import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "../SEO/SEO.jsx";
import Header from "../Header/Header.jsx";
import Navigation from "../Navigation/Navigation.jsx";
import StructuredData from "../StructuredData/StructuredData.jsx";
import styles from "./InstructionPage.module.css";
import Breadcrumbs from "../Breadcrumbs/Breadcrumbs.jsx";

export default function InstructionPage() {
    const {id} = useParams();

    const [instruction, setInstruction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadInstruction() {
        try {
            setLoading(true);

            const response = await fetch(
                `http://localhost:4000/api/instructions/${id}`
            );

            if (!response.ok) {
                throw new Error("Инструкция не найдена");
            }

            const data = await response.json();

            setInstruction(data);

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
      "item": `https://boykovgroup.ru/instrukciya-po-ohrane-truda/${instruction.id}`
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
                    onQueryChange={() => {
                    }}
                />

                <Navigation/>

            </div>


            <main className={styles.content}>
<SEO
  title={`${instruction.title} | БОЙКОВГРУПП`}
  description={`Инструкция по охране труда для профессии ${instruction.profession}. Требования безопасности, порядок выполнения работ и обязанности работника.`}
/>
                <Link
                    to="/"
                    className={styles.back}
                >
                    ← Все инструкции
                </Link>
<StructuredData
  instruction={instruction}
/>

                <article>
<Breadcrumbs instruction={instruction} />
                    <h1 className={styles.title}>
                        {instruction.title}
                    </h1>


                    <p className={styles.intro}>
                        {instruction.intro}
                    </p>


                    <div className={styles.toc}>

                        <h2>
                            Содержание
                        </h2>


                        {instruction.sections.map((section) => (
                            <a
                                key={section.number}
                                href={`#section-${section.number}`}
                            >
                                Раздел {section.number}. {section.heading}
                            </a>
                        ))}

                    </div>


                    <div className={styles.sections}>

                        {instruction.sections.map((section) => (

                            <section
                                key={section.number}
                                id={`section-${section.number}`}
                                className={styles.section}
                            >

                                <h2>
                                    {section.heading}
                                </h2>


                                {section.paragraphs.map((paragraph, index) => (

                                    <p key={index}>
                                        {paragraph}
                                    </p>

                                ))}

                            </section>

                        ))}

                    </div>


                </article>

            </main>

        </div>
    );
}