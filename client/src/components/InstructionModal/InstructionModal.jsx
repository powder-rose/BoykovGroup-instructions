import { useEffect } from "react";
import styles from "./InstructionModal.module.css";

export default function InstructionModal({ instruction, isLoading, error, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        {isLoading && <p className={styles.status}>Загрузка инструкции...</p>}
        {error && <p className={styles.errorStatus}>{error}</p>}

        {instruction && !isLoading && (
          <article>
            <h1 className={styles.title}>{instruction.title}</h1>
            {instruction.intro && <p className={styles.intro}>{instruction.intro}</p>}
            {instruction.sections.map((section) => (
              <section key={section.number} className={styles.section}>
                <h2 className={styles.sectionHeading}>
                  {section.number}. {section.heading}
                </h2>
                {section.paragraphs.map((paragraph, idx) => (
                  <p key={idx} className={styles.paragraph}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </article>
        )}
      </div>
    </div>
  );
}