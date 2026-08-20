import styles from "./HeroPortrait.module.css";

/** Портрет руководителя в hero-блоке — визуальный элемент доверия рядом с заголовком. */
export default function HeroPortrait() {
  return (
    <figure className={styles.wrap}>
      <div className={styles.photoCircle}>
        <picture>
          <source srcSet="/team/nikolay-boykov.webp" type="image/webp" />
          <img
            className={styles.photo}
            src="/team/nikolay-boykov.png"
            alt="Николай Бойков — генеральный директор ООО «Спецконс»"
            width={370}
            height={368}
          />
        </picture>
      </div>
      <figcaption className={styles.info}>
        <span className={styles.name}>Николай Бойков</span>
        <span className={styles.role}>
          Генеральный директор
          <br />
          ООО «Спецконс»
        </span>
      </figcaption>
    </figure>
  );
}
