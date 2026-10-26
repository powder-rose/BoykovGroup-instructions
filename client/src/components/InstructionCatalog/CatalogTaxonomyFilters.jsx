import CatalogTagPicker from './CatalogTagPicker.jsx';
import InstructionCatalogChoice from './InstructionCatalogChoice.jsx';
import styles from './CatalogTaxonomyFilters.module.css';

export default function CatalogTaxonomyFilters({
  options,
  category,
  tag,
  catalogId,
  onCatalogChange,
  onCategoryChange,
  onTagChange,
  onReset,
  error,
  loading = false,
}) {
  const categories = (options?.categories || []).filter(
    item => !catalogId || item.catalogId === catalogId,
  );
  const tags = options?.tags || [];
  const active = Boolean(category || tag);

  return (
    <InstructionCatalogChoice
      value={catalogId}
      catalogs={options?.catalogs}
      onChange={onCatalogChange}
      expanded={Boolean(catalogId || category || tag)}
    >
      <section className={styles.root} aria-label="Фильтры инструкций" aria-busy={loading}>
        <div className={styles.heading}>
          <div>
            <h3>Разделы и теги</h3>
            <p>Уточните раздел или выберите тег — список инструкций обновится ниже.</p>
          </div>
          {active && (
            <button type="button" className={styles.reset} onClick={onReset}>
              Сбросить фильтры
            </button>
          )}
        </div>
        <div className={styles.controls}>
          <label className={styles.field}>
            <span>Раздел</span>
            <select
              value={category}
              disabled={loading && !categories.length}
              onChange={event => onCategoryChange(event.target.value)}
            >
              <option value="">Все разделы</option>
              {categories.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <CatalogTagPicker
            key={`${catalogId}:${category}`}
            tags={tags}
            selectedId={tag}
            onChange={onTagChange}
            disabled={loading || Boolean(error)}
          />
        </div>
        {loading && (
          <p className={styles.message} role="status">
            Загрузка разделов и тегов…
          </p>
        )}
        {error && (
          <p className={styles.message} role="status">
            {error}
          </p>
        )}
        {!loading && !error && !categories.length && !tags.length && (
          <p className={styles.message}>
            Размеченных инструкций пока нет — обычный поиск доступен.
          </p>
        )}
      </section>
    </InstructionCatalogChoice>
  );
}
