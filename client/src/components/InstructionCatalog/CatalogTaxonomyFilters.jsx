import CatalogTagPicker from './CatalogTagPicker.jsx';
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
  const categories = options?.categories || [];
  const tags = options?.tags || [];
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
        <CatalogTagPicker tags={tags} selectedId={tag} onChange={onTagChange} />
      </div>
      {error && (
        <p className={styles.message} role="status">
          {error}
        </p>
      )}
      {!error && !categories.length && !tags.length && (
        <p className={styles.message}>Размеченных инструкций пока нет — обычный поиск доступен.</p>
      )}
    </section>
  );
}
