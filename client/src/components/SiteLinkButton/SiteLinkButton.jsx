import styles from "./SiteLinkButton.module.css";

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://boykovgroup.ru";

export default function SiteLinkButton() {
  return (
    <a
      className={styles.button}
      href={SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Перейти на сайт boykovgroup.ru"
    >
      <img
        className={styles.badge}
        src="/brand/logo-icon.png"
        alt=""
        width={46}
        height={46}
      />

      <span className={styles.text}>
        <span className={styles.title}>
          БОЙКОВГРУПП
        </span>

        <span className={styles.subtitle}>
          ООО «Спецконс»
        </span>
      </span>
    </a>
  );
}