import { Link } from 'react-router-dom';

import { PUBLIC_GENERATION_PRICE_RUB } from '../../lib/generationPricing.js';

import styles from './InstructionGenerationCard.module.css';

export default function InstructionGenerationCard() {
  return (
    <aside className={styles.banner} aria-label="Создание своей инструкции">
      <div className={styles.body}>
        <span className={styles.eyebrow}>[ своя инструкция ]</span>

        <h2 className={styles.title}>Не нашли нужную инструкцию?</h2>

        <p className={styles.text}>Создадим её за 2 минуты — {PUBLIC_GENERATION_PRICE_RUB} ₽.</p>
      </div>

      <Link to="/srochnaya-generaciya-instrukcii" className={styles.button}>
        Сгенерировать
      </Link>
    </aside>
  );
}
