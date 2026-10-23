import { Link } from 'react-router-dom';
import styles from './RelatedInstructions.module.css';
import { getInstructionPath } from '../../lib/instructionLinks.js';

export default function RelatedInstructions({ currentId, instructions = [] }) {
  const seen = new Set([currentId]);
  const related = instructions
    .filter(item => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 8);

  if (!related.length) {
    return null;
  }

  return (
    <section className={styles.block}>
      <h2>Похожие инструкции по охране труда</h2>

      <div className={styles.grid}>
        {related.map(item => (
          <Link key={item.id} to={getInstructionPath(item)} className={styles.card}>
            {item.title}
          </Link>
        ))}
      </div>
    </section>
  );
}
