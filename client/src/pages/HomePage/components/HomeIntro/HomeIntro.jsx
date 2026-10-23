import Navigation from '../../../../components/Navigation/Navigation.jsx';

import HomeHeaderControls from '../HomeHeaderControls/HomeHeaderControls.jsx';

import HomeHero from '../HomeHero/HomeHero.jsx';

import styles from '../../../../App.module.css';

export default function HomeIntro({ query, onQueryChange, containerRef, heading, description }) {
  return (
    <div ref={containerRef} className={styles.stickyIntro}>
      <HomeHeaderControls query={query} onQueryChange={onQueryChange} />

      <Navigation />

      <HomeHero heading={heading} description={description} />
    </div>
  );
}
