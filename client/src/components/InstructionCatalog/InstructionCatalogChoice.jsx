import { useId } from 'react';
import styles from './InstructionCatalogChoice.module.css';

const choices = [
  { id: '', label: 'Все инструкции' },
  { id: 'H01', label: 'По профессиям' },
  { id: 'H02', label: 'По видам работ' },
];

export default function InstructionCatalogChoice({
  value,
  catalogs = [],
  onChange,
  expanded = Boolean(value),
  directory,
  children,
}) {
  const panelId = useId();
  const activeChoice = choices.find(choice => choice.id === value);
  const counts = new Map(catalogs.map(item => [item.id, item.count]));

  return (
    <section className={styles.root} aria-label="Выбор каталога инструкций">
      <div className={styles.choices} role="group" aria-label="Направление поиска">
        {choices.map(choice => (
          <button
            key={choice.id}
            id={`${panelId}-${choice.id || 'all'}`}
            type="button"
            className={styles.choice}
            aria-pressed={value === choice.id}
            aria-expanded={value === choice.id && expanded}
            aria-controls={panelId}
            onClick={() => onChange(choice.id)}
          >
            <span>{choice.label}</span>
            {counts.has(choice.id) && (
              <span className={styles.count}>{counts.get(choice.id).toLocaleString('ru-RU')}</span>
            )}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        className={styles.panel}
        role="region"
        aria-labelledby={activeChoice ? `${panelId}-${activeChoice.id || 'all'}` : undefined}
        aria-label={activeChoice ? undefined : 'Разделы и теги'}
        hidden={!expanded}
      >
        {expanded && children}
      </div>
      {directory}
    </section>
  );
}
