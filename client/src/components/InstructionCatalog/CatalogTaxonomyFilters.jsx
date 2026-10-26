import { Link } from 'react-router-dom';
import CatalogPageLinks from './CatalogPageLinks.jsx';
import CatalogOptionPicker from './CatalogOptionPicker.jsx';
import CatalogTagPicker from './CatalogTagPicker.jsx';
import InstructionCatalogChoice from './InstructionCatalogChoice.jsx';
import TaxonomyNavigation from '../TaxonomyLandingPage/TaxonomyNavigation.jsx';
import styles from './CatalogTaxonomyFilters.module.css';

export default function CatalogTaxonomyFilters({
  options,
  navigation,
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
  const selectedCategory = categories.find(item => item.id === category);
  const selectedTag = tags.find(item => item.id === tag);
  const quickCategories = categories
    .filter(item => item.path)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  if (selectedCategory?.path && !quickCategories.some(item => item.id === category)) {
    quickCategories.splice(7, 1, selectedCategory);
  }

  return (
    <InstructionCatalogChoice
      value={catalogId}
      catalogs={options?.catalogs}
      onChange={onCatalogChange}
      expanded={Boolean(catalogId || category || tag)}
      directory={
        <TaxonomyNavigation
          compact
          catalogs={
            navigation?.catalogs ||
            (options?.catalogs || [])
              .filter(item => item.path)
              .map(item => ({
                code: item.id,
                name: item.label,
                count: item.count,
                path: item.path,
                sections: [],
              }))
          }
          tags={navigation?.tags}
        />
      }
    >
      <section className={styles.root} aria-label="Фильтры инструкций" aria-busy={loading}>
        <div className={styles.heading}>
          <span className={styles.hint}>Выберите раздел или найдите нужную тему</span>
          {active && (
            <button type="button" className={styles.reset} onClick={onReset}>
              Сбросить фильтры
            </button>
          )}
        </div>
        {catalogId && quickCategories.length > 0 && (
          <nav className={styles.quickCategories} aria-label="Страницы разделов">
            {quickCategories.map(item => (
              <Link key={item.id} to={item.path}>
                <span>{item.label}</span>
                <span className={styles.quickCount}>
                  {item.count.toLocaleString('ru-RU')}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </nav>
        )}
        <div className={styles.controls}>
          <CatalogOptionPicker
            key={catalogId}
            options={categories}
            selectedId={category}
            onChange={onCategoryChange}
            disabled={loading || Boolean(error)}
            label="Раздел"
            placeholder="Найдите нужный раздел"
            clearLabel="Сбросить выбранный раздел"
            showLabel="Показать список разделов"
            hideLabel="Скрыть список разделов"
          />
          <CatalogTagPicker
            key={`${catalogId}:${category}`}
            tags={tags}
            selectedId={tag}
            onChange={onTagChange}
            disabled={loading || Boolean(error)}
          />
        </div>
        <CatalogPageLinks
          label="Страницы выбранного раздела и тега"
          items={[
            selectedCategory && {
              ...selectedCategory,
              id: `category:${selectedCategory.id}`,
              label: `Раздел: ${selectedCategory.label}`,
            },
            selectedTag && {
              ...selectedTag,
              id: `tag:${selectedTag.id}`,
              label: `Тема: ${selectedTag.label}`,
            },
          ]}
        />
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
