import { Link } from 'react-router-dom';

import GeneratedInstructionBadge from '../GeneratedInstructionBadge/GeneratedInstructionBadge.jsx';
import { getInstructionPath } from '../../lib/instructionLinks.js';

import styles from './InstructionsCatalog.module.css';

export default function InstructionsCatalogGrid({ items, isAdmin }) {
  return (
    <div className={styles.grid}>
      {items.map(item => (
        <Link key={item.id} to={getInstructionPath(item)} className={styles.card}>
          <h2>{item.title}</h2>

          {isAdmin && item?.source === 'generated' && <GeneratedInstructionBadge />}

          <span>Открыть инструкцию →</span>
        </Link>
      ))}

      <div className={styles.generationStandalone}>
        <div className={styles.generationEyebrow}>Нужной инструкции нет?</div>

        <h2 className={styles.generationTitle}>Не нашли нужную инструкцию?</h2>

        <p className={styles.generationText}>Сгенерируйте её!</p>

        <Link to="/srochnaya-generaciya-instrukcii" className={styles.generationButton}>
          Сгенерировать
        </Link>
      </div>
    </div>
  );
}
