import { Link } from "react-router-dom";
import styles from "./Breadcrumbs.module.css";


export default function Breadcrumbs({ instruction }) {

  return (
    <nav
      className={styles.breadcrumbs}
      aria-label="Хлебные крошки"
    >

      <Link to="/">
        Главная
      </Link>


      <span>
        →
      </span>


      <Link to="/instrukcii-po-ohrane-truda">
        Инструкции по охране труда
      </Link>


      <span>
        →
      </span>


      <span>
        {instruction.profession}
      </span>

    </nav>
  );
}