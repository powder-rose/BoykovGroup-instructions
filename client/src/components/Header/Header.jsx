import SearchBar from "../SearchBar/SearchBar.jsx";
import AuthControl from "../AuthControl/AuthControl.jsx";
import SiteLinkButton from "../SiteLinkButton/SiteLinkButton.jsx";
import styles from "./Header.module.css";

export default function Header({ query, onQueryChange }) {
  return (
    <header className={styles.header}>
      <SearchBar
        value={query}
        onChange={onQueryChange}
      />

      <div className={styles.actions}>
        <AuthControl />
        <SiteLinkButton />
      </div>
    </header>
  );
}