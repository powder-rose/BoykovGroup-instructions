import styles from './InstructionPage.module.css';

function makeStableTextEntries(values, prefix) {
  const occurrences = new Map();

  return values.map(value => {
    const text = String(value ?? '');
    const occurrence = occurrences.get(text) ?? 0;

    occurrences.set(text, occurrence + 1);

    return {
      key: `${prefix}:${text}:${occurrence}`,
      value,
    };
  });
}

function renderInstructionParagraph(paragraph, paragraphKey) {
  const text = String(paragraph ?? '').trim();

  /*
   * Встроенный список:
   *
   * 1.4. Работник должен: - пункт; - пункт; - пункт.
   */
  if (!/:\\s*-\\s+/.test(text)) {
    return <p key={paragraphKey}>{text}</p>;
  }

  const parts = text.split(/\\s+-\\s+/);

  const lead = parts.shift()?.trim();

  const items = parts.map(item => item.trim().replace(/;\\s*$/, '')).filter(Boolean);

  /*
   * Один дефис ещё не считаем списком.
   */
  if (!lead || items.length < 2) {
    return <p key={paragraphKey}>{text}</p>;
  }

  return (
    <div key={paragraphKey} className={styles.paragraphWithList}>
      <p className={styles.paragraphLead}>{lead}</p>

      <ul className={styles.inlineList}>
        {makeStableTextEntries(items, `${paragraphKey}:item`).map(entry => (
          <li key={entry.key}>{entry.value}</li>
        ))}
      </ul>
    </div>
  );
}

export default function InstructionSections({ sections }) {
  return (
    <div className={styles.sections}>
      {sections.map(section => (
        <section
          key={section.number}

          id={`section-${section.number}`}

          className={styles.section}
        >
          <h2>{section.heading}</h2>

          {makeStableTextEntries(section.paragraphs, `section-${section.number}:paragraph`).map(
            entry => renderInstructionParagraph(entry.value, entry.key),
          )}
        </section>
      ))}
    </div>
  );
}
