import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './InstructionButton.module.css';
import GeneratedInstructionBadge from '../GeneratedInstructionBadge/GeneratedInstructionBadge.jsx';
import { getInstructionPath } from '../../lib/instructionLinks.js';

export default function InstructionButton({
  instruction,
  isAdmin,
  onDelete,
  onEdit,
  isDeleting,
  showAdminActions = true,
}) {
  const [confirming, setConfirming] = useState(false);
  const tags = Array.isArray(instruction.taxonomyDisplay?.tags)
    ? instruction.taxonomyDisplay.tags
    : [];

  return (
    <div className={`${styles.card} ${styles.normalCard}`}>
      <Link className={styles.clickArea} to={getInstructionPath(instruction)}>
        <span className={styles.index} aria-hidden="true" />

        <span className={styles.body}>
          <span className={styles.title}>{instruction.title}</span>
        </span>

        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </Link>

      {tags.length > 0 && (
        <ul className={styles.tags} aria-label="Теги инструкции">
          {tags.map(tag => (
            <li key={tag.id} className={styles.tagItem}>
              <Link
                className={styles.tag}
                to={`/instrukcii-po-ohrane-truda?tag=${encodeURIComponent(tag.id)}`}
                aria-label={`Показать инструкции с тегом «${tag.label}»`}
              >
                {tag.label}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && instruction?.source === 'generated' && <GeneratedInstructionBadge />}

      {isAdmin && showAdminActions && (
        <div className={styles.adminBar}>
          <button type="button" className={styles.adminBtn} onClick={() => onEdit(instruction)}>
            [ редактировать ]
          </button>

          {!confirming ? (
            <button type="button" className={styles.adminBtn} onClick={() => setConfirming(true)}>
              [ удалить ]
            </button>
          ) : (
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>удалить статью?</span>

              <button
                type="button"
                className={styles.confirmYes}
                disabled={isDeleting}
                onClick={() => onDelete(instruction.id)}
              >
                {isDeleting ? '...' : 'да'}
              </button>

              <button
                type="button"
                className={styles.confirmNo}
                onClick={() => setConfirming(false)}
              >
                нет
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
