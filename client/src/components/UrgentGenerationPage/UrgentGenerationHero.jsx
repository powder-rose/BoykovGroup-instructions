import HeroPortrait
  from "../HeroPortrait/HeroPortrait.jsx";

import {
  formatAmount
} from "./urgentGenerationUtils.js";

import styles
  from "./UrgentGenerationPage.module.css";


export default function UrgentGenerationHero({

  displayOriginalAmount,
  displayAmount,
  hasPromoDiscount

}) {

  return (

    <section
      className={
        styles.hero
      }
    >

      <div
        className={
          styles.heroCopy
        }
      >

        <div
          className={
            styles.eyebrow
          }
        >
          [ профессия или вид работ ]
        </div>


        <h1
          className={
            styles.title
          }
        >
          Срочная инструкция
          по охране труда
        </h1>


        <p
          className={
            styles.lead
          }
        >
          Укажите профессию, должность
          или вид работ — подготовим
          проект инструкции с опорой
          на требования законодательства
          Российской Федерации и принятую
          структуру документов по охране труда.
        </p>


        <div
          className={
            styles.notice
          }
        >
          Перед утверждением инструкции
          работодателем документ необходимо
          проверить с учётом конкретных
          условий труда, оборудования
          и локальных требований организации.
        </div>

      </div>


      <div
        className={
          styles.heroProfile
        }
      >

        <HeroPortrait
          compact
        />

      </div>


      <div
        className={
          styles.priceCard
        }
      >

        <div
          className={
            styles.priceLabel
          }
        >
          Стоимость
        </div>


        <div
          className={
            styles.price
          }
        >
          {
            hasPromoDiscount
              ? (
                  <>
                    <span
                      className={
                        styles.promoPriceOld
                      }
                    >
                      {formatAmount(
                        displayOriginalAmount
                      )} ₽
                    </span>

                    {" "}

                    <span
                      className={
                        styles.promoPriceNew
                      }
                    >
                      {formatAmount(
                        displayAmount
                      )} ₽
                    </span>
                  </>
                )
              : `${formatAmount(
                  displayAmount
                )} ₽`
          }
        </div>


        <div
          className={
            styles.priceDescription
          }
        >
          за подготовку
          одной инструкции
        </div>

      </div>

    </section>

  );

}
