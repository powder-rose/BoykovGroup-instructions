import styles from "./Navigation.module.css";

const links = [
  "Охрана труда",
  "Пожарная безопасность",
  "Роспотребнадзор",
  "ГО и ЧС",
  "Антитеррористическая безопасность",
  "Иные услуги",
];

export default function Navigation() {
  return (
    <nav className={styles.navigation}>
      {links.map((item) => (
        <a
          key={item}
          href="#"
          className={styles.link}
        >
          {item}
        </a>
      ))}
    </nav>
  );
}