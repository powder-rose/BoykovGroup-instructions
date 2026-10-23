import { Link } from 'react-router-dom';
import { getInstructionBreadcrumbs } from '../../../../server/src/shared/instructionBreadcrumbs.js';
import styles from './Breadcrumbs.module.css';

export default function Breadcrumbs({ instruction }) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
      {getInstructionBreadcrumbs(instruction).map((item, index) => (
        <span key={`${item.path || 'current'}/${item.name}`}>
          {index > 0 && <span aria-hidden="true">→ </span>}
          {item.path ? (
            <Link to={item.path}>{item.name}</Link>
          ) : (
            <span aria-current="page">{item.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
