import { useState } from "react";
import styles from "./InstructionButton.module.css";

export default function InstructionButton({ instruction, onSelect, isAdmin, onDelete, isDeleting }) {
  const [confirming, setConfirming] = useState(false);

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(instruction.id);
    }
  }

  return (
    <div className={styles.card}>
      <div
        className={styles.clickArea}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(instruction.id)}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.index} aria-hidden="true" />

        <span className={styles.body}>
          <span className={styles.title}>{instruction.title}</span>
        </span>

        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </div>

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
              <span className={styles.confirmLabel}>удалить статью?</span>
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