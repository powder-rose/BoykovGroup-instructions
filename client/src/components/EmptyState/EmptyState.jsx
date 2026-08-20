import styles from "./EmptyState.module.css";

export default function EmptyState({ query, isAdmin, isGenerating, error, onGenerate }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.iconWrap} aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <p className={styles.text}>  {query}   </p>

      {isAdmin ? (
        <>
          <button
            type="button"
            className={styles.button}
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? " ..." : "  YandexGPT"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </>
      ) : (
        <p className={styles.hint}>
                 .
        </p>
      )}
    </div>
  );
}
