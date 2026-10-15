import styles from './InstructionPage.module.css';

export default function InstructionTableOfContents({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav className={styles.toc} aria-label="Содержание инструкции">
      <h2>Содержание инструкции</h2>
      <ul>
        {items.map(item => (
          <li key={item.id} className={item.level === 3 ? styles.tocNested : undefined}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
