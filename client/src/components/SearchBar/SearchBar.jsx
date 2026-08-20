import styles from "./SearchBar.module.css";

export default function SearchBar({ value, onChange }) {
  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        className={styles.input}
        type="text"
        placeholder="Поиск инструкций..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Поиск инструкций по охране труда"
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange("")}
          aria-label="Очистить поиск"
        >
          ×
        </button>
      )}
    </div>
  );
}
