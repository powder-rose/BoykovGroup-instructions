import RichTextContent from '../RichTextContent/RichTextContent.jsx';
import { getInstructionDocument } from '../../../../server/src/shared/instructionDocument.js';

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

  const document = getInstructionDocument({
    ...instruction,
    sections: (Array.isArray(instruction.sections) ? instruction.sections : []).map(section => ({
      ...section,
      paragraphs: normalizeLines(section),
    })),
  });

  return (
    <article className={compact ? `${styles.instruction} ${styles.compact}` : styles.instruction}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          {instruction.title || `Инструкция по охране труда: ${instruction.profession || ''}`}
        </h2>
      </header>

      <div className={styles.sections}>
        <RichTextContent content={document} />
      </div>
    </article>
  );
}
