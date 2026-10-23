import { Link } from 'react-router-dom';
import InstructionsCatalogGrid from '../InstructionCatalog/InstructionsCatalogGrid.jsx';
import RichTextContent from '../RichTextContent/RichTextContent.jsx';
import TaxonomyNavigation from './TaxonomyNavigation.jsx';
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

function PageControl({ to, onClick, children, ...attributes }) {
  return onClick ? (
    <button type="button" onClick={onClick} {...attributes}>
      {children}
    </button>
  ) : (
    <Link to={to} {...attributes}>
      {children}
    </Link>
  );
}

export default function TaxonomyPageContent({ page, isAdmin, onSort, onPage }) {
  return (
    <>
      <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
        {page.breadcrumbs.map((item, index) => (
          <span
            key={
              item.path || `${item === page.breadcrumbs.at(-1) ? 'page' : 'ancestor'}/${item.name}`
            }
          >
            {index > 0 && <span aria-hidden="true"> → </span>}
            {item.path ? (
              <Link to={item.path}>{item.name}</Link>
            ) : (
              <span aria-current={index === page.breadcrumbs.length - 1 ? 'page' : undefined}>
                {item.name}
              </span>
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
            <PageControl
              key={mode}
              to={onSort ? undefined : sortPath(page, mode)}
              onClick={onSort ? () => onSort(mode) : undefined}
              className={`${sortStyles.button} ${styles.controlLink} ${page.sort === mode ? sortStyles.active : ''}`}
              aria-current={page.sort === mode ? 'true' : undefined}
            >
              {label}
            </PageControl>
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
          {(onPage ? page.page > 1 : page.previousPath) && (
            <PageControl
              className={`${pagerStyles.arrow} ${styles.controlLink}`}
              to={page.previousPath}
              onClick={onPage ? () => onPage(page.page - 1) : undefined}
              aria-label="Предыдущая страница"
            >
              ←
            </PageControl>
          )}
          {page.pagination.map(item => (
            <PageControl
              key={item.page}
              className={`${pagerStyles.page} ${styles.controlLink} ${item.page === page.page ? pagerStyles.active : ''}`}
              to={item.path}
              onClick={onPage ? () => onPage(item.page) : undefined}
              aria-current={item.page === page.page ? 'page' : undefined}
            >
              {item.page}
            </PageControl>
          ))}
          {(onPage ? page.page < page.totalPages : page.nextPath) && (
            <PageControl
              className={`${pagerStyles.arrow} ${styles.controlLink}`}
              to={page.nextPath}
              onClick={onPage ? () => onPage(page.page + 1) : undefined}
              aria-label="Следующая страница"
            >
              →
            </PageControl>
          )}
        </nav>
      )}
      <div className={styles.seoText}>
        <RichTextContent content={page.seoContent} />
      </div>
    </>
  );
}
