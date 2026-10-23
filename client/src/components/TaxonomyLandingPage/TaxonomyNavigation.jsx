import { Link } from 'react-router-dom';
import styles from './TaxonomyLandingPage.module.css';

function Count({ value }) {
  return <span className={styles.count}>{Number(value || 0).toLocaleString('ru-RU')}</span>;
}

function NavigationLink({ path, className, children }) {
  return path ? (
    <Link className={className} to={path}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
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
                <NavigationLink className={styles.catalogLink} path={catalog.path}>
                  {catalog.name}
                  <Count value={catalog.count} />
                </NavigationLink>
              </h2>
              {catalog.sections.length > 0 && (
                <ul className={styles.sectionList}>
                  {catalog.sections.map(section => (
                    <li key={section.code}>
                      <NavigationLink className={styles.sectionLink} path={section.path}>
                        {section.name}
                        <Count value={section.count} />
                      </NavigationLink>
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
                <NavigationLink className={styles.sectionLink} path={section.path}>
                  {section.name}
                  <Count value={section.count} />
                </NavigationLink>
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
                <NavigationLink className={styles.tag} path={tag.path}>
                  {tag.name}
                  <Count value={tag.count} />
                </NavigationLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </nav>
  );
}
