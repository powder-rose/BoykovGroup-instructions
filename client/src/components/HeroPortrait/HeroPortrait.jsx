import styles from './HeroPortrait.module.css';

/*
 * Портрет руководителя в hero-блоке.
 *
 * compact=true используется,
 * когда верхний hero закреплён при прокрутке.
 */
export default function HeroPortrait({ compact = false }) {
  return (
    <figure className={[styles.wrap, compact ? styles.compact : ''].filter(Boolean).join(' ')}>
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
