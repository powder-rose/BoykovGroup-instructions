import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Header from '../Header/Header.jsx';
import HomeCompactHeader from '../../pages/HomePage/components/HomeCompactHeader/HomeCompactHeader.jsx';
import HomeIntro from '../../pages/HomePage/components/HomeIntro/HomeIntro.jsx';
import useHomeCompactHeader from '../../pages/HomePage/hooks/useHomeCompactHeader.js';
import SEO from '../SEO/SEO.jsx';
import { selectIsAdmin } from '../../store/authSlice.js';
import TaxonomyPageContent from './TaxonomyPageContent.jsx';
import TaxonomyPageSeo from './TaxonomyPageSeo.jsx';
import useTaxonomyPage from './useTaxonomyPage.js';
import homeStyles from '../../App.module.css';
import catalogStyles from '../InstructionCatalog/InstructionsCatalog.module.css';
import styles from './TaxonomyLandingPage.module.css';

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
        {page && <TaxonomyPageContent page={page} isAdmin={isAdmin} />}
      </main>
    </div>
  );
}
