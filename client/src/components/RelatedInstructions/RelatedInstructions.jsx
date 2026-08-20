import { Link } from "react-router-dom";
import styles from "./RelatedInstructions.module.css";


export default function RelatedInstructions({
  currentId,
  instructions
}) {

  const related = instructions
    .filter(item => item.id !== currentId)
    .slice(0, 4);


  if (!related.length) {
    return null;
  }


  return (
    <section className={styles.block}>

      <h2>
        Похожие инструкции по охране труда
      </h2>


      <div className={styles.grid}>

        {related.map((item) => (

          <Link
            key={item.id}
            to={`/instrukciya-po-ohrane-truda/${item.id}`}
            className={styles.card}
          >

            {item.title}

          </Link>

        ))}

      </div>


    </section>
  );
}