import { Link } from 'react-router-dom';
import styles from './InstructionTaxonomy.module.css';

// Query-parameter filters navigate within the canonical catalog; they are not SEO landing pages.
export default function InstructionTaxonomy({ taxonomy }) {
  const category = taxonomy?.category;
  const tags = Array.isArray(taxonomy?.tags) ? taxonomy.tags : [];

  if (!category && tags.length === 0) return null;

  return (
    <div className={styles.root} aria-label="Основной раздел и теги инструкции">
      {category && (
        <Link
          to={`/instrukcii-po-ohrane-truda?category=${encodeURIComponent(category.id)}`}
          className={styles.category}
        >
          Раздел: {category.label}
        </Link>
      )}
      {tags.map(tag => (
        <Link
          key={tag.id}
          to={`/instrukcii-po-ohrane-truda?tag=${encodeURIComponent(tag.id)}`}
          className={styles.tag}
        >
          {tag.label}
        </Link>
      ))}
    </div>
  );
}
