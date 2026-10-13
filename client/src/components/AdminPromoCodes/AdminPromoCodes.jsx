import PromoCodeCard
  from "./PromoCodeCard.jsx";

import PromoCodeCreateForm
  from "./PromoCodeCreateForm.jsx";

import useAdminPromoCodes
  from "./hooks/useAdminPromoCodes.js";
import "./AdminPromoCodes.css";


export default function AdminPromoCodes({
  token,
  hidden = false
}) {

  const {
    items,
    loading,
    createForm,
    creating,
    message,
    showMessage,
    loadItems,
    changeCreate,
    handleCreate
  } =
    useAdminPromoCodes({
      token
    });


  return (
    <section
      id="boykovPromoAdmin"
      data-boykov-admin-tab-section="promocodes"
      className={[
        "boykovPromoAdmin",

        hidden
          ? "boykovAdminDashboardSection--hidden"
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >

      <div
        className="boykovPromoAdmin__header"
      >

        <div>

          <div
            className="boykovPromoAdmin__eyebrow"
          >
            Оплата
          </div>

          <h2
            className="boykovPromoAdmin__title"
          >
            Промокоды
          </h2>

          <p
            className="boykovPromoAdmin__description"
          >
            Создание и управление скидками для срочной генерации инструкций.
            Использование засчитывается только после подтверждённой оплаты.
          </p>

        </div>


        <div
          className="boykovPromoAdmin__count"
        >
          {items.length}
        </div>

      </div>


      <div
        className={[
          "boykovPromoAdmin__message",

          message.text
            ? "boykovPromoAdmin__message--visible"
            : "",

          message.type
            ? `boykovPromoAdmin__message--${message.type}`
            : ""
        ]
          .filter(Boolean)
          .join(" ")}
        aria-live="polite"
      >
        {message.text}
      </div>


      <PromoCodeCreateForm
        createForm={
          createForm
        }
        creating={
          creating
        }
        changeCreate={
          changeCreate
        }
        handleCreate={
          handleCreate
        }
      />


      <div
        className="boykovPromoAdmin__list"
      >

        {
          loading &&
          (
            <div
              className="boykovPromoAdmin__empty"
            >
              Загружаем промокоды...
            </div>
          )
        }


        {
          !loading &&
          items.length ===
            0 &&
          (
            <div
              className="boykovPromoAdmin__empty"
            >
              Промокодов пока нет.
            </div>
          )
        }


        {
          !loading &&
          items.map(
            promo => (

              <PromoCodeCard
                key={
                  promo.id
                }
                promo={
                  promo
                }
                token={
                  token
                }
                onReload={
                  loadItems
                }
                onMessage={
                  showMessage
                }
              />

            )
          )
        }

      </div>

    </section>
  );

}
