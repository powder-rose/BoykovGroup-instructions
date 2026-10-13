import {
  Link
} from "react-router-dom";

import cardStyles
  from "../InstructionButton/InstructionButton.module.css";

import styles
  from "./InstructionGenerationCard.module.css";

import RevealItem
  from "./InstructionListRevealItem.jsx";


export default function InstructionGenerationCard({
  delay
}) {

  return (
    <RevealItem
      delay={
        delay
      }
    >

      <div
        className={`${cardStyles.card} ${styles.card}`}
      >

        <div
          className={`${cardStyles.clickArea} ${styles.inner}`}
        >

          <span
            className={`${cardStyles.body} ${styles.body}`}
          >

            <span
              className={styles.eyebrow}
            >
              [ своя инструкция ]
            </span>


            <span
              className={`${cardStyles.title} ${styles.title}`}
            >
              Не нашли нужную инструкцию?
            </span>


            <span
              className={styles.text}
            >
              Создадим её за 2 минуты!
            </span>


            <Link
              to="/srochnaya-generaciya-instrukcii"
              className={styles.button}
            >
              Сгенерировать
            </Link>

          </span>

        </div>

      </div>

    </RevealItem>
  );

}
