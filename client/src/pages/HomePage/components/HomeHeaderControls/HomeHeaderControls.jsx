import SearchBar from '../../../../components/SearchBar/SearchBar.jsx';

import SiteLinkButton from '../../../../components/SiteLinkButton/SiteLinkButton.jsx';
import WalletBalanceBadge from '../../../../components/WalletBalanceBadge/WalletBalanceBadge.jsx';

import styles from '../../../../App.module.css';

export default function HomeHeaderControls({ query, onQueryChange }) {
  return (
    <div className={styles.compactControls}>
      <div className={styles.compactSearch}>
        <SearchBar value={query} onChange={onQueryChange} />
      </div>

      <div className={styles.compactLogo}>
        <WalletBalanceBadge />
        <SiteLinkButton />
      </div>
    </div>
  );
}
