export function toLocalInput(
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


export function fromLocalInput(
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


export function formatDate(
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


export function formatNumber(
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


export function typeLabel(
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


export function toDraft(
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
