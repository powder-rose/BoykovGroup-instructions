import { Link } from 'react-router-dom';
import styles from './TaxonomyLandingPage.module.css';

function Count({ value }) {
  return <span className={styles.count}>{Number(value || 0).toLocaleString('ru-RU')}</span>;
}

export default function TaxonomyNavigation({ catalogs = [], sections = [], tags = [] }) {
  if (!catalogs.length && !sections.length && !tags.length) return null;

  return (
    <nav className={styles.navigation} aria-label="Каталоги, разделы и темы инструкций">
      {catalogs.length > 0 && (
        <div className={styles.catalogs}>
          {catalogs.map(catalog => (
            <section key={catalog.code} className={styles.catalog}>
              <h2>
                <Link className={styles.catalogLink} to={catalog.path}>
                  {catalog.name}
                  <Count value={catalog.count} />
                </Link>
              </h2>
              {catalog.sections.length > 0 && (
                <ul className={styles.sectionList}>
                  {catalog.sections.map(section => (
                    <li key={section.code}>
                      <Link className={styles.sectionLink} to={section.path}>
                        {section.name}
                        <Count value={section.count} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      {sections.length > 0 && (
        <section className={styles.catalog}>
          <h2>Разделы каталога</h2>
          <ul className={styles.sectionList}>
            {sections.map(section => (
              <li key={section.code}>
                <Link className={styles.sectionLink} to={section.path}>
                  {section.name}
                  <Count value={section.count} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tags.length > 0 && (
        <section className={styles.catalog}>
          <h2>Темы инструкций</h2>
          <ul className={styles.tags}>
            {tags.map(tag => (
              <li key={tag.code}>
                <Link className={styles.tag} to={tag.path}>
                  {tag.name}
                  <Count value={tag.count} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </nav>
  );
}
