import styles
    from "./InstructionPage.module.css";


export default function InstructionTableOfContents({
    sections
}) {

    return (

        <div className={styles.toc}>


            <h2>
                Содержание
            </h2>



            {sections.map(section => (

                <a
                    key={section.number}
                    href={`#section-${section.number}`}
                >

                    Раздел {section.number}. {section.heading}

                </a>

            ))}


        </div>

    );

}
