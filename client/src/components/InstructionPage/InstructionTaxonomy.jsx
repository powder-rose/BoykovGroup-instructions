import styles from './InstructionTaxonomy.module.css';

// Display-only until the separate catalog-filtering PR supplies stable destinations.
export default function InstructionTaxonomy({ taxonomy }) {
  const category = taxonomy?.category;
  const tags = Array.isArray(taxonomy?.tags) ? taxonomy.tags : [];

  if (!category && tags.length === 0) return null;

  return (
    <div className={styles.root} aria-label="Категория и теги инструкции">
      {category && <span className={styles.category}>Категория: {category.label}</span>}
      {tags.map(tag => (
        <span key={tag.id} className={styles.tag}>
          {tag.label}
        </span>
      ))}
    </div>
  );
}
