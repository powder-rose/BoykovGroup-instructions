import HeroPortrait
  from "../../../../components/HeroPortrait/HeroPortrait.jsx";

import styles
  from "../../../../App.module.css";


export default function HomeHero({
  compact = false
}) {

  return (
    <section
      className={
        styles.hero
      }
    >

      <div
        className={
          styles.heroText
        }
      >

        <h1
          className={
            styles.title
          }
        >
          Инструкции по охране труда
        </h1>


        <p
          className={
            styles.subtitle
          }
        >
          Найдите готовую инструкцию для нужной профессии.
          База пополняется автоматически каждый день.
        </p>

      </div>


      <div
        className={
          styles.heroPortraitWrap
        }
      >

        <HeroPortrait
          compact={
            compact
          }
        />

      </div>

    </section>
  );

}
