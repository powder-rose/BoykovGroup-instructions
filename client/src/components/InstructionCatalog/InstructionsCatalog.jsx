import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import Header from '../Header/Header.jsx';
import InstructionSort from '../InstructionSort/InstructionSort.jsx';
import InstructionListPagination from '../InstructionList/InstructionListPagination.jsx';
import SEO from '../SEO/SEO.jsx';

import { selectIsAdmin } from '../../store/authSlice.js';
import HomeCompactHeader from '../../pages/HomePage/components/HomeCompactHeader/HomeCompactHeader.jsx';
import HomeIntro from '../../pages/HomePage/components/HomeIntro/HomeIntro.jsx';
import useHomeCompactHeader from '../../pages/HomePage/hooks/useHomeCompactHeader.js';

import InstructionsCatalogGrid from './InstructionsCatalogGrid.jsx';
import CatalogTaxonomyFilters from './CatalogTaxonomyFilters.jsx';
import useInstructionsCatalog from './hooks/useInstructionsCatalog.js';

import homeStyles from '../../App.module.css';
import styles from './InstructionsCatalog.module.css';

export default function InstructionsCatalog() {
  const isAdmin = useSelector(selectIsAdmin);
  const { isCompactHeader, stickyIntroRef, stickyTriggerRef } = useHomeCompactHeader();
  const {
    queryInput,
    setQueryInput,
    query,
    category,
    tag,
    hasParameters,
    filterOptions,
    filterError,
    changeCategory,
    changeTag,
    clearTaxonomy,
    items,
    total,
    loading,
    page,
    totalPages,
    error,
    paginationItems,
    changePage,
  } = useInstructionsCatalog();

  return (
    <div className={homeStyles.page}>
      <SEO
        title="Инструкции по охране труда | БОЙКОВГРУПП"
        description="Готовые инструкции по охране труда для различных профессий. База документов по охране труда для организаций."
        noindex={hasParameters}
      />

      <Header query={queryInput} onQueryChange={setQueryInput} />

      <HomeCompactHeader
        visible={isCompactHeader}
        query={queryInput}
        onQueryChange={setQueryInput}
      />

      <div ref={stickyTriggerRef} className={homeStyles.stickyTrigger} aria-hidden="true" />

      <HomeIntro query={queryInput} onQueryChange={setQueryInput} containerRef={stickyIntroRef} />

      <main className={styles.content}>
        <div className={styles.toolbar}>
          <a id="boykovCatalogHomeButton" className={styles.homeButton} href="/">
            <span aria-hidden="true">←</span> На главную
          </a>

          {!loading && !error && items.length > 0 && (
            <span className={homeStyles.count}>
              {query || category || tag ? 'Найдено инструкций' : 'Всего инструкций'}:{' '}
              {total.toLocaleString('ru-RU')}
            </span>
          )}
        </div>

        <CatalogTaxonomyFilters
          options={filterOptions}
          category={category}
          tag={tag}
          onCategoryChange={changeCategory}
          onTagChange={changeTag}
          onReset={clearTaxonomy}
          error={filterError}
        />

        {loading && (
          <p className={styles.status} role="status">
            Загрузка инструкций…
          </p>
        )}

        {!loading && error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          (items.length > 0 ? (
            <>
              <InstructionSort />

              <InstructionsCatalogGrid items={items} isAdmin={isAdmin} />

              <InstructionListPagination
                currentPage={page}
                totalPages={totalPages}
                paginationItems={paginationItems}
                isPageLoading={loading}
                onChangePage={changePage}
              />
            </>
          ) : (
            <section className={styles.empty} aria-labelledby="catalog-empty-title">
              <span className={styles.emptyEyebrow}>[ СВОЯ ИНСТРУКЦИЯ ]</span>

              <h2 id="catalog-empty-title" className={styles.emptyTitle}>
                Не нашли нужную инструкцию?
              </h2>

              <p className={styles.emptyDescription}>
                Создадим индивидуальную инструкцию по охране труда за 2 минуты.
              </p>

              {query && (
                <p className={styles.emptyQuery}>По запросу «{query}» ничего не найдено.</p>
              )}
              {(category || tag) && (
                <p className={styles.emptyQuery}>
                  С такими фильтрами пока нет инструкций. Попробуйте другую категорию или тег.
                </p>
              )}

              <Link to="/srochnaya-generaciya-instrukcii" className={styles.emptyAction}>
                Сгенерировать инструкцию
                <span aria-hidden="true">→</span>
              </Link>
            </section>
          ))}
      </main>
    </div>
  );
}
