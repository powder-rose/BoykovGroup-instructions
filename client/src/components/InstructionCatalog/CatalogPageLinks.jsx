import { Link } from 'react-router-dom';
import styles from './CatalogPageLinks.module.css';

export default function CatalogPageLinks({ items, label }) {
  const links = items.filter(item => item?.path);
  if (!links.length) return null;
  return (
    <nav className={styles.root} aria-label={label}>
      {links.map(item => (
        <Link key={item.id} to={item.path}>
          {item.label} →
        </Link>
      ))}
    </nav>
  );
}
