import { useState } from 'react';
import { Link } from 'react-router-dom';

import SearchBar from '../SearchBar/SearchBar.jsx';
import SiteLinkButton from '../SiteLinkButton/SiteLinkButton.jsx';
import Navigation from '../Navigation/Navigation.jsx';
import HeroPortrait from '../HeroPortrait/HeroPortrait.jsx';
import AuthControl from '../AuthControl/AuthControl.jsx';
import catalogStyles from '../InstructionCatalog/InstructionsCatalog.module.css';

import styles from './InstructionStickyHeader.module.css';

export default function InstructionStickyHeader() {
  const [query, setQuery] = useState('');

  function handleSearch(value) {
    const normalized = String(value ?? '').trim();

    const target = normalized ? `/?q=${encodeURIComponent(normalized)}` : '/';

    /*
     * Полная навигация намеренная:
     * главная страница прочитает q
     * при инициализации поиска.
     */
    window.location.assign(target);
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.controls}>
          <div className={styles.search}>
            <SearchBar value={query} onChange={setQuery} onSubmit={handleSearch} />
          </div>

          <div className={styles.logo}>
            <AuthControl compact />
            <SiteLinkButton />
          </div>
        </div>

        <div className={styles.navigation}>
          <Navigation />
        </div>

        <div className={styles.profileRow}>
          <Link to="/" className={styles.titleLink} aria-label="На главную страницу">
            <div className={styles.title}>Инструкции по охране труда</div>
          </Link>

          <div className={styles.profileActions}>
            <Link to="/" className={catalogStyles.homeButton}>
              <span aria-hidden="true">←</span> На главную
            </Link>
            <Link to="/" className={styles.profileLink} aria-label="На главную страницу">
              <div className={styles.profile}>
                <HeroPortrait compact />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
