import InstructionSort from '../InstructionSort/InstructionSort.jsx';
import styles from './InstructionResultsToolbar.module.css';

export default function InstructionResultsToolbar({ total, filtered = false }) {
  return (
    <div className={styles.root}>
      <span className={styles.count}>
        {filtered ? 'Найдено инструкций' : 'Всего инструкций'}: {total.toLocaleString('ru-RU')}
      </span>
      <InstructionSort compact />
    </div>
  );
}
