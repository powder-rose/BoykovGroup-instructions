import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import Header from '../Header/Header.jsx';
import InstructionResultsToolbar from './InstructionResultsToolbar.jsx';
import InstructionListPagination from '../InstructionList/InstructionListPagination.jsx';
import RichTextContent from '../RichTextContent/RichTextContent.jsx';
import TaxonomyPageSeo, { TaxonomyPendingSeo } from '../TaxonomyLandingPage/TaxonomyPageSeo.jsx';
import useTaxonomyNavigation from '../TaxonomyLandingPage/useTaxonomyNavigation.js';

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
  const { navigation, error: navigationError } = useTaxonomyNavigation();
  const root = navigation?.root;
  const { isCompactHeader, stickyIntroRef, stickyTriggerRef } = useHomeCompactHeader();
  const {
    queryInput,
    setQueryInput,
    query,
    category,
    tag,
    catalogId,
    hasParameters,
    filterOptions,
    filterError,
    filtersLoading,
    changeCategory,
    changeTag,
    changeCatalog,
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
      {navigation ? (
        <TaxonomyPageSeo
          page={
            root || {
              path: '/instrukcii-po-ohrane-truda',
              h1: 'Инструкции по охране труда',
              seo: {
                title: 'Инструкции по охране труда | БОЙКОВГРУПП',
                description:
                  'Готовые инструкции по охране труда для различных профессий. База документов по охране труда для организаций.',
                canonicalUrl: new URL('/instrukcii-po-ohrane-truda', window.location.origin).href,
                robots: 'index, follow',
              },
            }
          }
          robots={hasParameters ? 'noindex, follow' : undefined}
        />
      ) : (
        <TaxonomyPendingSeo failed={Boolean(navigationError)} />
      )}

      <Header query={queryInput} onQueryChange={setQueryInput} />

      <HomeCompactHeader
        visible={isCompactHeader}
        query={queryInput}
        onQueryChange={setQueryInput}
      />

      <div ref={stickyTriggerRef} className={homeStyles.stickyTrigger} aria-hidden="true" />

      <HomeIntro
        query={queryInput}
        onQueryChange={setQueryInput}
        containerRef={stickyIntroRef}
        heading={root?.h1}
        description={root ? '' : undefined}
      />

      <main className={styles.content}>
        <a id="boykovCatalogHomeButton" className={styles.homeLink} href="/">
          <span aria-hidden="true">←</span> На главную
        </a>
        {root && <RichTextContent content={root.introContent} />}
        <CatalogTaxonomyFilters
          options={filterOptions}
          navigation={navigation}
          category={category}
          tag={tag}
          catalogId={catalogId}
          onCatalogChange={changeCatalog}
          onCategoryChange={changeCategory}
          onTagChange={changeTag}
          onReset={clearTaxonomy}
          error={filterError}
          loading={filtersLoading}
        />
        {navigationError && (
          <p className={styles.status} role="status">
            {navigationError}
          </p>
        )}

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
              <InstructionResultsToolbar
                total={total}
                filtered={Boolean(query || category || tag || catalogId)}
              />

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
              {(category || tag || catalogId) && (
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
        {root && <RichTextContent content={root.seoContent} />}
      </main>
    </div>
  );
}
