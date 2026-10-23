import HeroPortrait from '../../../../components/HeroPortrait/HeroPortrait.jsx';

import styles from '../../../../App.module.css';

export default function HomeHero({
  compact = false,
  heading = 'Инструкции по охране труда',
  description = 'Найдите готовую инструкцию для нужной профессии. База пополняется автоматически каждый день.',
}) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <h1 className={styles.title}>{heading}</h1>

        {description && <p className={styles.subtitle}>{description}</p>}
      </div>

      <div className={styles.heroPortraitWrap}>
        <HeroPortrait compact={compact} />
      </div>
    </section>
  );
}
