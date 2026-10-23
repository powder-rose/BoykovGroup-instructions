import { Link } from 'react-router-dom';
import styles from './InstructionTaxonomy.module.css';

export default function InstructionTaxonomy({ taxonomy, navigation }) {
  const category = navigation?.category || taxonomy?.category;
  const tags = Array.isArray(navigation?.tags)
    ? navigation.tags
    : Array.isArray(taxonomy?.tags)
      ? taxonomy.tags
      : [];

  if (!category && tags.length === 0) return null;

  return (
    <div className={styles.root} aria-label="Основной раздел и теги инструкции">
      {category && (
        <Link
          to={
            category.path ||
            `/instrukcii-po-ohrane-truda?category=${encodeURIComponent(category.id)}`
          }
          className={styles.category}
        >
          Раздел: {category.label}
        </Link>
      )}
      {tags.length > 0 && (
        <div className={styles.tags} aria-label="Теги инструкции">
          {tags.map(tag => (
            <Link
              key={tag.id}
              to={tag.path || `/instrukcii-po-ohrane-truda?tag=${encodeURIComponent(tag.id)}`}
              className={styles.tag}
            >
              {tag.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
