import styles from './PrivateInstructionView.module.css';

function normalizeLines(section) {
  const source = section?.paragraphs ?? section?.content ?? section?.items ?? section?.text ?? [];

  if (Array.isArray(source)) {
    return source
      .flatMap(item => {
        if (typeof item === 'string') {
          return [item];
        }

        if (item && typeof item === 'object') {
          const value = item.text ?? item.content ?? item.title ?? '';

          return [String(value)];
        }

        return [String(item ?? '')];
      })
      .map(value => value.trim())
      .filter(Boolean);
  }

  return String(source ?? '')
    .split(/\n+/u)
    .map(value => value.trim())
    .filter(Boolean);
}

export default function PrivateInstructionView({ instruction, compact = false }) {
  if (!instruction) {
    return null;
  }

  const sections = Array.isArray(instruction.sections) ? instruction.sections : [];

  return (
    <article className={compact ? `${styles.instruction} ${styles.compact}` : styles.instruction}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          {instruction.title || `Инструкция по охране труда: ${instruction.profession || ''}`}
        </h2>

        {instruction.intro && <p className={styles.intro}>{instruction.intro}</p>}
      </header>

      <div className={styles.sections}>
        {sections.map((section, sectionIndex) => {
          const lines = normalizeLines(section);

          return (
            <section className={styles.section} key={section.id ?? section.number ?? sectionIndex}>
              {section.title && <h3 className={styles.sectionTitle}>{section.title}</h3>}

              {lines.map((line, lineIndex) => (
                <p className={styles.paragraph} key={lineIndex}>
                  {line}
                </p>
              ))}
            </section>
          );
        })}
      </div>
    </article>
  );
}
