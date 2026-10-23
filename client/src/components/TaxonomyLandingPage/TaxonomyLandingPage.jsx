import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Header from '../Header/Header.jsx';
import HomeCompactHeader from '../../pages/HomePage/components/HomeCompactHeader/HomeCompactHeader.jsx';
import HomeIntro from '../../pages/HomePage/components/HomeIntro/HomeIntro.jsx';
import useHomeCompactHeader from '../../pages/HomePage/hooks/useHomeCompactHeader.js';
import InstructionsCatalogGrid from '../InstructionCatalog/InstructionsCatalogGrid.jsx';
import RichTextContent from '../RichTextContent/RichTextContent.jsx';
import SEO from '../SEO/SEO.jsx';
import { selectIsAdmin } from '../../store/authSlice.js';
import TaxonomyNavigation from './TaxonomyNavigation.jsx';
import TaxonomyPageSeo from './TaxonomyPageSeo.jsx';
import useTaxonomyPage from './useTaxonomyPage.js';
import homeStyles from '../../App.module.css';
import catalogStyles from '../InstructionCatalog/InstructionsCatalog.module.css';
import sortStyles from '../InstructionSort/InstructionSort.module.css';
import pagerStyles from '../InstructionList/InstructionListPagination.module.css';
import styles from './TaxonomyLandingPage.module.css';

function sortPath(page, mode) {
  const params = new URLSearchParams();
  if (page.query) params.set('q', page.query);
  if (mode !== 'title') params.set('sort', mode);
  const search = params.toString();
  return page.path + (search ? `?${search}` : '');
}

export default function TaxonomyLandingPage() {
  const { page, status, queryInput, setQueryInput, retry } = useTaxonomyPage();
  const isAdmin = useSelector(selectIsAdmin);
  const { isCompactHeader, stickyIntroRef, stickyTriggerRef } = useHomeCompactHeader();
  const heading =
    page?.h1 ||
    (status === 'not-found'
      ? 'Страница не найдена'
      : status === 'error'
        ? 'Не удалось загрузить страницу'
        : 'Инструкции по охране труда');

  return (
    <div className={homeStyles.page}>
      {page ? (
        <TaxonomyPageSeo page={page} />
      ) : (
        status !== 'loading' && (
          <SEO title={heading} description="" noindex canonical={window.location.pathname} />
        )
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
        heading={heading}
        description=""
      />

      <main className={catalogStyles.content}>
        {status === 'loading' && (
          <p className={catalogStyles.status} role="status">
            Загрузка инструкций…
          </p>
        )}
        {status === 'not-found' && (
          <div className={styles.empty}>
            <p>Возможно, страница ещё не опубликована или была удалена.</p>
            <Link to="/instrukcii-po-ohrane-truda">Перейти к каталогу инструкций</Link>
          </div>
        )}
        {status === 'error' && (
          <div className={styles.empty} role="alert">
            <p>Проверьте соединение и попробуйте ещё раз.</p>
            <button className={catalogStyles.homeButton} type="button" onClick={retry}>
              Повторить загрузку
            </button>
          </div>
        )}
        {page && (
          <>
            <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
              {page.breadcrumbs.map((item, index) => (
                <span key={`${item.path || page.path}/${item.name}`}>
                  {index > 0 && <span aria-hidden="true"> → </span>}
                  {item.path ? (
                    <Link to={item.path}>{item.name}</Link>
                  ) : (
                    <span aria-current="page">{item.name}</span>
                  )}
                </span>
              ))}
            </nav>
            <div className={styles.intro}>
              <RichTextContent content={page.introContent} />
            </div>
            <TaxonomyNavigation sections={page.sections} />
            <div className={catalogStyles.toolbar}>
              <span className={homeStyles.count}>
                {page.query ? 'Найдено инструкций' : 'Всего инструкций'}:{' '}
                {page.total.toLocaleString('ru-RU')}
              </span>
            </div>
            <div className={sortStyles.root}>
              <span className={sortStyles.label}>Сортировка:</span>
              <div className={sortStyles.buttons}>
                {[
                  ['title', 'По алфавиту'],
                  ['newest', 'Сначала новые'],
                ].map(([mode, label]) => (
                  <Link
                    key={mode}
                    to={sortPath(page, mode)}
                    className={`${sortStyles.button} ${styles.controlLink} ${page.sort === mode ? sortStyles.active : ''}`}
                    aria-current={page.sort === mode ? 'true' : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            {page.items.length ? (
              <InstructionsCatalogGrid items={page.items} isAdmin={isAdmin} />
            ) : (
              <p className={catalogStyles.status}>Инструкции не найдены.</p>
            )}
            {page.totalPages > 1 && (
              <nav className={pagerStyles.pagination} aria-label="Страницы каталога инструкций">
                {page.previousPath && (
                  <Link
                    className={`${pagerStyles.arrow} ${styles.controlLink}`}
                    to={page.previousPath}
                    aria-label="Предыдущая страница"
                  >
                    ←
                  </Link>
                )}
                {page.pagination.map(item => (
                  <Link
                    key={item.page}
                    className={`${pagerStyles.page} ${styles.controlLink} ${item.page === page.page ? pagerStyles.active : ''}`}
                    to={item.path}
                    aria-current={item.page === page.page ? 'page' : undefined}
                  >
                    {item.page}
                  </Link>
                ))}
                {page.nextPath && (
                  <Link
                    className={`${pagerStyles.arrow} ${styles.controlLink}`}
                    to={page.nextPath}
                    aria-label="Следующая страница"
                  >
                    →
                  </Link>
                )}
              </nav>
            )}
            <div className={styles.seoText}>
              <RichTextContent content={page.seoContent} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
