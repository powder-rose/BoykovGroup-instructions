import { formatMoney, formatNumber } from './commerceStatsFormatters.js';
import styles from './AdminCommerceStats.module.css';

export default function AdminSalesBreakdown({ purchases, generations }) {
  const rows = [
    { title: 'Готовые PDF', ...purchases?.byFormat?.pdf },
    { title: 'Готовые Word', ...purchases?.byFormat?.docx },
    { title: 'Генерации инструкций', ...generations },
  ];
  return (
    <>
      <div className={styles.listHeading}>
        <h3 className={styles.listTitle}>Продажи по типам</h3>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Тип покупки</th>
              <th scope="col">Покупок</th>
              <th scope="col">Оплачено</th>
              <th scope="col">Возвращено</th>
              <th scope="col">После возвратов</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.title}>
                <th scope="row">{row.title}</th>
                <td className={styles.emphasis}>{formatNumber(row.count)}</td>
                <td>{formatMoney(row.amountMinor)}</td>
                <td>{formatMoney(row.refundedAmountMinor)}</td>
                <td>{formatMoney((row.amountMinor || 0) - (row.refundedAmountMinor || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
