import { useId } from 'react';
import CatalogPageLinks from './CatalogPageLinks.jsx';
import styles from './InstructionCatalogChoice.module.css';

const choices = [
  {
    id: 'H01',
    label: 'По профессиям и должностям',
    description: 'Для вашей специальности или должности',
  },
  {
    id: 'H02',
    label: 'По видам работ',
    description: 'Для нужной работы, оборудования или процесса',
  },
];

export default function InstructionCatalogChoice({
  value,
  catalogs = [],
  onChange,
  expanded = Boolean(value),
  children,
}) {
  const panelId = useId();
  const activeChoice = choices.find(choice => choice.id === value);
  const counts = new Map(catalogs.map(item => [item.id, item.count]));
  return (
    <section className={styles.root} aria-label="Выбор каталога инструкций">
      <div className={styles.heading}>
        <h2>Какая инструкция вам нужна?</h2>
        <button
          type="button"
          className={styles.all}
          aria-pressed={!value}
          onClick={() => onChange('')}
        >
          Все инструкции
        </button>
      </div>
      <div className={styles.choices}>
        {choices.map(choice => (
          <button
            key={choice.id}
            type="button"
            className={styles.choice}
            aria-pressed={value === choice.id}
            aria-expanded={value === choice.id && expanded}
            aria-controls={panelId}
            id={`${panelId}-${choice.id}`}
            onClick={() => onChange(choice.id)}
          >
            <span className={styles.body}>
              <span className={styles.title}>{choice.label}</span>
              <span className={styles.description}>{choice.description}</span>
            </span>
            <span className={styles.count}>
              {counts.has(choice.id) && (
                <span>{counts.get(choice.id).toLocaleString('ru-RU')}</span>
              )}
              <span className={styles.indicator} aria-hidden="true">
                {value === choice.id ? '↓' : '→'}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div
        id={panelId}
        className={styles.panel}
        role="region"
        aria-labelledby={activeChoice ? `${panelId}-${activeChoice.id}` : undefined}
        aria-label={activeChoice ? undefined : 'Разделы и теги'}
        hidden={!expanded}
      >
        {expanded && children}
      </div>
      <CatalogPageLinks
        items={catalogs.map(item => ({ ...item, label: `Открыть каталог: ${item.label}` }))}
        label="Полные каталоги инструкций"
      />
    </section>
  );
}
