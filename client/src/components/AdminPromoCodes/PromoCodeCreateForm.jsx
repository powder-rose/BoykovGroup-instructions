import "./AdminPromoCodes.css";


export default function PromoCodeCreateForm({

  createForm,
  creating,
  changeCreate,
  handleCreate

}) {

  return (

    <form
      className="boykovPromoAdmin__create"
      onSubmit={
        handleCreate
      }
    >

      <h3
        className="boykovPromoAdmin__createTitle"
      >
        Новый промокод
      </h3>


      <div
        className="boykovPromoAdmin__grid"
      >

        <label
          className="boykovPromoAdmin__field"
        >
          <span
            className="boykovPromoAdmin__label"
          >
            Код
          </span>

          <input
            className="boykovPromoAdmin__input"
            maxLength="40"
            placeholder="Например: TEST10"
            required
            value={
              createForm.code
            }
            onChange={
              event =>
                changeCreate(
                  "code",
                  event.target.value
                )
            }
          />
        </label>


        <label
          className="boykovPromoAdmin__field"
        >
          <span
            className="boykovPromoAdmin__label"
          >
            Тип
          </span>

          <select
            className="boykovPromoAdmin__select"
            value={
              createForm.type
            }
            onChange={
              event =>
                changeCreate(
                  "type",
                  event.target.value
                )
            }
          >
            <option value="fixed_price">
              Итоговая цена
            </option>

            <option value="percent">
              Скидка в процентах
            </option>
          </select>
        </label>


        <label
          className="boykovPromoAdmin__field"
        >
          <span
            className="boykovPromoAdmin__label"
          >
            {
              createForm.type ===
                "percent"
                ? "Скидка, %"
                : "Цена, ₽"
            }
          </span>

          <input
            className="boykovPromoAdmin__input"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={
              createForm.value
            }
            onChange={
              event =>
                changeCreate(
                  "value",
                  event.target.value
                )
            }
          />
        </label>


        <label
          className="boykovPromoAdmin__field"
        >
          <span
            className="boykovPromoAdmin__label"
          >
            Лимит использований
          </span>

          <input
            className="boykovPromoAdmin__input"
            type="number"
            min="1"
            step="1"
            placeholder="Без лимита"
            value={
              createForm.maxUses
            }
            onChange={
              event =>
                changeCreate(
                  "maxUses",
                  event.target.value
                )
            }
          />
        </label>


        <label
          className="boykovPromoAdmin__field"
        >
          <span
            className="boykovPromoAdmin__label"
          >
            Действует до
          </span>

          <input
            className="boykovPromoAdmin__input"
            type="datetime-local"
            value={
              createForm.expiresAt
            }
            onChange={
              event =>
                changeCreate(
                  "expiresAt",
                  event.target.value
                )
            }
          />
        </label>

      </div>


      <div
        className="boykovPromoAdmin__createActions"
      >

        <label
          className="boykovPromoAdmin__checkbox"
        >
          <input
            type="checkbox"
            checked={
              createForm.active
            }
            onChange={
              event =>
                changeCreate(
                  "active",
                  event.target.checked
                )
            }
          />

          Активировать сразу
        </label>


        <button
          className="
            boykovPromoAdmin__button
            boykovPromoAdmin__button--primary
          "
          type="submit"
          disabled={
            creating
          }
        >
          {
            creating
              ? "Создаём..."
              : "Создать промокод"
          }
        </button>

      </div>

    </form>

  );

}
