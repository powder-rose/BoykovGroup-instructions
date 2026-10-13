import styles
    from "./InstructionPage.module.css";


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


export default function InstructionSections({
    sections
}) {

    return (

        <div className={styles.sections}>


            {sections.map(section => (

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

    );

}
