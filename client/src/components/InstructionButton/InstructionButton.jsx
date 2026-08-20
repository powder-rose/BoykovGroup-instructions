import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./InstructionButton.module.css";

export default function InstructionButton({
  instruction,
  isAdmin,
  onDelete,
  isDeleting
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={styles.card}>
      <Link
        className={styles.clickArea}
        to={`/instrukciya-po-ohrane-truda/${instruction.id}`}
      >
        <span
          className={styles.index}
          aria-hidden="true"
        />

        <span className={styles.body}>
          <span className={styles.title}>
            {instruction.title}
          </span>
        </span>

        <span
          className={styles.arrow}
          aria-hidden="true"
        >
          →
        </span>
      </Link>

      {isAdmin && (
        <div className={styles.adminBar}>
          {!confirming ? (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => setConfirming(true)}
            >
              [ удалить ]
            </button>
          ) : (
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>
                удалить статью?
              </span>

              <button
                type="button"
                className={styles.confirmYes}
                disabled={isDeleting}
                onClick={() => onDelete(instruction.id)}
              >
                {isDeleting ? "..." : "да"}
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