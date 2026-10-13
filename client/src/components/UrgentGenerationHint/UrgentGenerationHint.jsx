import { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import styles from './UrgentGenerationHint.module.css';

export default function UrgentGenerationHint() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let frameId = null;

    const update = () => {
      frameId = null;

      setIsVisible(window.scrollY >= 280);
    };

    const onScroll = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(update);
    };

    update();

    window.addEventListener('scroll', onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', onScroll);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <aside
      className={[styles.hint, isVisible ? styles.visible : ''].filter(Boolean).join(' ')}
      aria-hidden={!isVisible}
    >
      <div className={styles.eyebrow}>[ срочная инструкция ]</div>

      <div className={styles.text}>
        Не нашли нужную инструкцию?
        <br />
        Сгенерируйте её!
      </div>

      <div className={styles.price}>50 ₽</div>

      <Link
        to="/srochnaya-generaciya-instrukcii"
        className={styles.button}
        tabIndex={isVisible ? 0 : -1}
      >
        Сгенерировать
      </Link>
    </aside>
  );
}
