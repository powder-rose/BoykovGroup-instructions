import {
  useEffect,
  useState
} from "react";

import {
  createPromoCode,
  deletePromoCode,
  getPromoCodes,
  updatePromoCode
} from "../../api/promoCodesApi.js";

import "./AdminPromoCodes.css";


function toLocalInput(
  value
) {

  if (!value) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  const local =
    new Date(
      date.getTime() -
      date.getTimezoneOffset() *
      60000
    );


  return local
    .toISOString()
    .slice(
      0,
      16
    );

}


function fromLocalInput(
  value
) {

  if (!value) {
    return null;
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date
    .toISOString();

}


function formatDate(
  value
) {

  if (!value) {
    return "без срока";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date
    .toLocaleString(
      "ru-RU"
    );

}


function formatNumber(
  value
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        2
    }
  )
    .format(
      Number(value) || 0
    );

}


function typeLabel(
  promo
) {

  if (
    promo.type ===
      "percent"
  ) {

    return (
      `Скидка ${formatNumber(
        promo.value
      )}%`
    );

  }


  return (
    `Цена ${formatNumber(
      promo.value
    )} ₽`
  );

}


function toDraft(
  promo
) {

  return {
    code:
      promo.code || "",

    type:
      promo.type ||
      "fixed_price",

    value:
      String(
        promo.value ?? ""
      ),

    maxUses:
      promo.maxUses ??
      "",

    expiresAt:
      toLocalInput(
        promo.expiresAt
      ),

    active:
      promo.active ===
      true
  };

}


function PromoCodeCard({
  promo,
  token,
  onReload,
  onMessage
}) {

  const [
    draft,
    setDraft
  ] =
    useState(
      () =>
        toDraft(
          promo
        )
    );


  const [
    busy,
    setBusy
  ] =
    useState(false);


  useEffect(() => {

    setDraft(
      toDraft(
        promo
      )
    );

  }, [
    promo
  ]);


  function change(
    name,
    value
  ) {

    setDraft(
      current => ({
        ...current,
        [name]:
          value
      })
    );

  }


  function payload() {

    const maxUsesText =
      String(
        draft.maxUses ?? ""
      )
        .trim();


    return {
      code:
        String(
          draft.code || ""
        )
          .trim()
          .toUpperCase(),

      type:
        draft.type ||
        "fixed_price",

      value:
        Number(
          draft.value
        ),

      maxUses:
        maxUsesText
          ? Number(
              maxUsesText
            )
          : null,

      expiresAt:
        fromLocalInput(
          draft.expiresAt
        ),

      active:
        draft.active ===
        true
    };

  }


  async function save() {

    setBusy(
      true
    );

    onMessage(
      "",
      ""
    );


    try {

      await updatePromoCode(
        promo.id,
        payload(),
        token
      );


      onMessage(
        `Промокод ${promo.code} сохранён.`,
        "success"
      );


      await onReload();

    }
    catch(error) {

      onMessage(
        error?.message ||
        "Не удалось сохранить промокод.",
        "error"
      );

    }
    finally {

      setBusy(
        false
      );

    }

  }


  async function toggle() {

    setBusy(
      true
    );

    onMessage(
      "",
      ""
    );


    try {

      await updatePromoCode(
        promo.id,
        {
          active:
            promo.active !==
            true
        },
        token
      );


      await onReload();

    }
    catch(error) {

      onMessage(
        error?.message ||
        "Не удалось изменить состояние промокода.",
        "error"
      );

    }
    finally {

      setBusy(
        false
      );

    }

  }


  async function remove() {

    const confirmed =
      window.confirm(
        `Удалить промокод ${promo.code}?`
      );


    if (!confirmed) {
      return;
    }


    setBusy(
      true
    );

    onMessage(
      "",
      ""
    );


    try {

      await deletePromoCode(
        promo.id,
        token
      );


      onMessage(
        `Промокод ${promo.code} удалён.`,
        "success"
      );


      await onReload();

    }
    catch(error) {

      onMessage(
        error?.message ||
        "Не удалось удалить промокод.",
        "error"
      );

    }
    finally {

      setBusy(
        false
      );

    }

  }


  const usage =
    promo.maxUses
      ? `${promo.usedCount} / ${promo.maxUses}`
      : `${promo.usedCount} / ∞`;


  return (
    <article
      className="boykovPromoCard"
    >

      <div
        className="boykovPromoCard__top"
      >

        <div>

          <div
            className="boykovPromoCard__name"
          >

            <span
              className="boykovPromoCard__code"
            >
              {promo.code}
            </span>


            <span
              className="boykovPromoCard__badge"
            >
              {
                typeLabel(
                  promo
                )
              }
            </span>


            <span
              className={[
                "boykovPromoCard__badge",

                promo.active
                  ? "boykovPromoCard__badge--active"
                  : "boykovPromoCard__badge--disabled"
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {
                promo.active
                  ? "Активен"
                  : "Выключен"
              }
            </span>

          </div>


          <div
            className="boykovPromoCard__meta"
          >
            Создан:{" "}
            {
              formatDate(
                promo.createdAt
              )
            }
            {" · "}
            Срок:{" "}
            {
              formatDate(
                promo.expiresAt
              )
            }
          </div>

        </div>


        <div
          className="boykovPromoCard__usage"
        >

          <div
            className="boykovPromoCard__usageValue"
          >
            {usage}
          </div>

          <div
            className="boykovPromoCard__usageLabel"
          >
            использовано
          </div>

        </div>

      </div>


      <div
        className="boykovPromoCard__grid"
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
            value={
              draft.code
            }
            onChange={
              event =>
                change(
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
              draft.type
            }
            onChange={
              event =>
                change(
                  "type",
                  event.target.value
                )
            }
          >
            <option value="fixed_price">
              Итоговая цена
            </option>

            <option value="percent">
              Скидка %
            </option>
          </select>
        </label>


        <label
          className="boykovPromoAdmin__field"
        >
          <span
            className="boykovPromoAdmin__label"
          >
            Значение
          </span>

          <input
            className="boykovPromoAdmin__input"
            type="number"
            min="0.01"
            step="0.01"
            value={
              draft.value
            }
            onChange={
              event =>
                change(
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
            Лимит
          </span>

          <input
            className="boykovPromoAdmin__input"
            type="number"
            min="1"
            step="1"
            placeholder="Без лимита"
            value={
              draft.maxUses
            }
            onChange={
              event =>
                change(
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
              draft.expiresAt
            }
            onChange={
              event =>
                change(
                  "expiresAt",
                  event.target.value
                )
            }
          />
        </label>

      </div>


      <div
        className="boykovPromoCard__footer"
      >

        <label
          className="boykovPromoAdmin__checkbox"
        >

          <input
            type="checkbox"
            checked={
              draft.active
            }
            onChange={
              event =>
                change(
                  "active",
                  event.target.checked
                )
            }
          />

          Промокод активен

        </label>


        <div
          className="boykovPromoCard__actions"
        >

          <button
            type="button"
            className="boykovPromoAdmin__button"
            disabled={
              busy
            }
            onClick={
              save
            }
          >
            Сохранить
          </button>


          <button
            type="button"
            className="boykovPromoAdmin__button"
            disabled={
              busy
            }
            onClick={
              toggle
            }
          >
            {
              promo.active
                ? "Выключить"
                : "Включить"
            }
          </button>


          <button
            type="button"
            className="
              boykovPromoAdmin__button
              boykovPromoAdmin__button--danger
            "
            disabled={
              busy
            }
            onClick={
              remove
            }
          >
            Удалить
          </button>

        </div>

      </div>

    </article>
  );

}


export default function AdminPromoCodes({
  token,
  hidden = false
}) {

  const [
    items,
    setItems
  ] =
    useState([]);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    createForm,
    setCreateForm
  ] =
    useState({
      code:
        "",

      type:
        "fixed_price",

      value:
        "10",

      maxUses:
        "",

      expiresAt:
        "",

      active:
        true
    });

  const [
    creating,
    setCreating
  ] =
    useState(false);

  const [
    message,
    setMessage
  ] =
    useState({
      text:
        "",

      type:
        ""
    });


  function showMessage(
    text,
    type
  ) {

    setMessage({
      text:
        text || "",

      type:
        type || ""
    });

  }


  async function loadItems() {

    if (!token) {

      setItems(
        []
      );

      setLoading(
        false
      );

      return;

    }


    try {

      const data =
        await getPromoCodes(
          token
        );


      setItems(
        Array.isArray(
          data?.items
        )
          ? data.items
          : []
      );

    }
    catch(error) {

      showMessage(
        error?.message ||
        "Не удалось загрузить промокоды.",
        "error"
      );

    }
    finally {

      setLoading(
        false
      );

    }

  }


  useEffect(() => {

    void loadItems();

  }, [
    token
  ]);


  function changeCreate(
    name,
    value
  ) {

    setCreateForm(
      current => ({
        ...current,
        [name]:
          value
      })
    );

  }


  async function handleCreate(
    event
  ) {

    event.preventDefault();


    const maxUsesText =
      String(
        createForm.maxUses
      )
        .trim();


    const payload = {
      code:
        createForm.code
          .trim()
          .toUpperCase(),

      type:
        createForm.type,

      value:
        Number(
          createForm.value
        ),

      maxUses:
        maxUsesText
          ? Number(
              maxUsesText
            )
          : null,

      expiresAt:
        fromLocalInput(
          createForm.expiresAt
        ),

      active:
        createForm.active
    };


    setCreating(
      true
    );

    showMessage(
      "",
      ""
    );


    try {

      await createPromoCode(
        payload,
        token
      );


      setCreateForm({
        code:
          "",

        type:
          "fixed_price",

        value:
          "10",

        maxUses:
          "",

        expiresAt:
          "",

        active:
          true
      });


      showMessage(
        "Промокод создан.",
        "success"
      );


      await loadItems();

    }
    catch(error) {

      showMessage(
        error?.message ||
        "Не удалось создать промокод.",
        "error"
      );

    }
    finally {

      setCreating(
        false
      );

    }

  }


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
