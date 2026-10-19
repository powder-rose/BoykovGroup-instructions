import { useState } from 'react';
import styles from './CatalogTaxonomyFilters.module.css';

export default function CatalogTaxonomyFilters({
  options,
  category,
  tag,
  onCategoryChange,
  onTagChange,
  onReset,
  error,
}) {
  const [tagQuery, setTagQuery] = useState('');
  const categories = options?.categories || [];
  const tags = options?.tags || [];
  const normalizedQuery = tagQuery.trim().toLocaleLowerCase('ru-RU');
  const matching = normalizedQuery
    ? tags.filter(item => item.label.toLocaleLowerCase('ru-RU').includes(normalizedQuery))
    : tags;
  // Keep the current selection in the native select when the user searches for another tag.
  const selected = tags.find(item => item.id === tag);
  const visibleTags =
    selected && !matching.some(item => item.id === tag) ? [selected, ...matching] : matching;
  const active = Boolean(category || tag);

  return (
    <section className={styles.root} aria-label="Фильтры инструкций">
      <div className={styles.heading}>
        <div>
          <h2>Категории и теги</h2>
          <p>Выбирайте категорию и тег вместе или по отдельности.</p>
        </div>
        {active && (
          <button type="button" className={styles.reset} onClick={onReset}>
            Сбросить фильтры
          </button>
        )}
      </div>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span>Категория</span>
          <select value={category} onChange={event => onCategoryChange(event.target.value)}>
            <option value="">Все категории</option>
            {categories.map(item => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.count})
              </option>
            ))}
          </select>
        </label>
        <div className={styles.tagControls}>
          <label className={styles.field}>
            <span>Найти тег</span>
            <input
              type="search"
              value={tagQuery}
              onChange={event => setTagQuery(event.target.value)}
              placeholder="Например, слесарь или сварка"
              aria-label="Поиск по доступным тегам"
            />
          </label>
          <label className={styles.field}>
            <span>Тег</span>
            <select value={tag} onChange={event => onTagChange(event.target.value)}>
              <option value="">Все теги</option>
              {visibleTags.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && (
        <p className={styles.message} role="status">
          {error}
        </p>
      )}
      {!error && !categories.length && !tags.length && (
        <p className={styles.message}>Размеченных инструкций пока нет — обычный поиск доступен.</p>
      )}
      <p className={styles.hint}>
        Фильтры учитывают только уже назначенные категории и теги. Старые инструкции без разметки
        по-прежнему находятся обычным поиском.
      </p>
    </section>
  );
}
