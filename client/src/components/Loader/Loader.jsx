import styles from "./Loader.module.css";

export default function Loader({ label = "Загрузка..." }) {
  return (
    <div className={styles.wrapper} role="status">
      <span>{label}</span>
      <span className={styles.cursor} aria-hidden="true" />
    </div>
  );
}
