export const formatNumber = value => Number(value || 0).toLocaleString('ru-RU');

export const formatMoney = minor =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(
    Number(minor || 0) / 100,
  );

export function salesSummaryMetrics(report, isGeneration) {
  return [
    {
      label: isGeneration ? 'Оплачено генераций' : 'Всего покупок',
      value: formatNumber(report?.count),
      note: 'Подтверждённые оплаты за период',
    },
    {
      label: 'Сумма оплат',
      value: formatMoney(report?.amountMinor),
      note: 'Фактические суммы с учётом промокодов',
    },
    {
      label: 'Возвращено',
      value: formatMoney(report?.refundedAmountMinor),
      note: `Возвратов генераций: ${formatNumber(report?.refundedCount)}`,
    },
    {
      label: 'После возвратов',
      value: formatMoney(report?.netAmountMinor),
      note: 'Оплаты минус подтверждённые возвраты',
    },
  ];
}
