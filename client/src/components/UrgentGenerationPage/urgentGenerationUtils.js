export function normalizePromoCode(value) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();

}


export function formatAmount(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "";

  }


  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        2
    }
  ).format(
    number
  );

}
