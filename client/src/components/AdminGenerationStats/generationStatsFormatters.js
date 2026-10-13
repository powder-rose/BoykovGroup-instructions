const numberFormatter =
  new Intl.NumberFormat(
    "ru-RU"
  );

const rubFormatter =
  new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );


export function number(value) {

  return numberFormatter.format(
    Number(value) || 0
  );

}


export function rub(value) {

  return (
    rubFormatter.format(
      Number(value) || 0
    ) +
    " ₽"
  );

}
