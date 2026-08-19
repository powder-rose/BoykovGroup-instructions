import styles from "./CategoryNav.module.css";

// Пока это заглушки (href="#"), без реальных страниц — просто панель
// разделов, как на макете. Когда разделы будут готовы, достаточно
// проставить настоящие href.
const NAV_ITEMS = [
  { label: "Охрана труда" },
  { label: "Пожарная безопасность" },
  { label: "Роспотребнадзор" },
  { divider: true },
  { label: "ГО и ЧС" },
  { label: "Антитеррористическая безопасность" },
  { label: "Иные услуги" },
];

function handlePlaceholderClick(e) {
  e.preventDefault();
}

/** Панель разделов услуг под шапкой — как на макете. Ссылки пока заглушки. */
export default function CategoryNav() {
  return (
    <nav className={styles.nav} aria-label="Разделы услуг">
      {NAV_ITEMS.map((item, idx) =>
        item.divider ? (
          <span key={`divider-${idx}`} className={styles.divider} aria-hidden="true" />
        ) : (
          <a key={item.label} href="#" className={styles.link} onClick={handlePlaceholderClick}>
            {item.label}
          </a>
        )
      )}
    </nav>
  );
}
