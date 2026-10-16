import useAdminCommerceStats from './hooks/useAdminCommerceStats.js';
import styles from './AdminCommerceStats.module.css';

const PERIODS = [
  { id: 'total', title: 'Всё время' },
  { id: 'today', title: 'Сегодня' },
  { id: '7d', title: '7 дней' },
  { id: '30d', title: '30 дней' },
];

const formatNumber = value => Number(value || 0).toLocaleString('ru-RU');
const formatMoney = minor =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(
    Number(minor || 0) / 100,
  );

function SummaryCards({ items }) {
  return (
    <div className={styles.metrics}>
      {items.map(item => (
        <div key={item.label} className={styles.metric}>
          <span className={styles.metricLabel}>{item.label}</span>
          <strong className={styles.metricValue}>{item.value}</strong>
          <span className={styles.metricNote}>{item.note}</span>
        </div>
      ))}
    </div>
  );
}

function RankingTable({ items, mode }) {
  if (!items?.length) {
    return <p className={styles.empty}>За выбранный период пока нет записей.</p>;
  }
  const maximum = items[0].count;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">№</th>
            <th scope="col">Инструкция</th>
            <th scope="col">{mode === 'purchases' ? 'Покупок' : 'Скачиваний'}</th>
            {mode === 'purchases' ? (
              <th scope="col">Сумма</th>
            ) : (
              <>
                <th scope="col">Бесплатных</th>
                <th scope="col">Платных</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td className={styles.rank}>{item.rank}</td>
              <td className={styles.instruction}>
                {item.slug ? (
                  <a href={`/instrukciya-po-ohrane-truda/${encodeURIComponent(item.slug)}`}>
                    {item.title}
                  </a>
                ) : (
                  <span>{item.title}</span>
                )}
                <div className={styles.barTrack} aria-hidden="true">
                  <div
                    className={styles.barFill}
                    style={{ width: `${Math.round((item.count / maximum) * 100)}%` }}
                  />
                </div>
              </td>
              <td className={styles.emphasis}>{formatNumber(item.count)}</td>
              {mode === 'purchases' ? (
                <td>{formatMoney(item.amountMinor)}</td>
              ) : (
                <>
                  <td>{formatNumber(item.free)}</td>
                  <td>{formatNumber(item.paid)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminCommerceStats({ token, section }) {
  const { period, setPeriod, data, loading, error } = useAdminCommerceStats(token);
  const isPurchases = section === 'purchases';
  const report = data?.[isPurchases ? 'purchases' : 'downloads'];
  const metrics = isPurchases
    ? [
        { label: 'Куплено инструкций', value: formatNumber(report?.count), note: 'Оплаченные PDF' },
        {
          label: 'Сумма покупок',
          value: formatMoney(report?.amountMinor),
          note: 'Пополнения баланса не включены',
        },
        {
          label: 'Разных инструкций',
          value: formatNumber(report?.uniqueInstructions),
          note: 'Наименований в покупках',
        },
        { label: 'Средний чек', value: formatMoney(report?.averageMinor), note: 'За инструкцию' },
      ]
    : [
        { label: 'Всего скачиваний', value: formatNumber(report?.count), note: 'Выданных PDF' },
        { label: 'Бесплатных', value: formatNumber(report?.free), note: 'По лимиту аккаунтов' },
        { label: 'Платных', value: formatNumber(report?.paid), note: 'Купленные документы' },
        {
          label: 'Пользователей',
          value: formatNumber(report?.uniqueDownloaders),
          note: 'Уникальных за период',
        },
      ];

  return (
    <section
      className={styles.section}
      data-boykov-admin-tab-section={section}
      aria-label={isPurchases ? 'Статистика покупок' : 'Статистика скачиваний'}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>АНАЛИТИКА ИНСТРУКЦИЙ</p>
          <h2 className={styles.title}>
            {isPurchases ? 'Статистика покупок' : 'Статистика скачиваний'}
          </h2>
          <p className={styles.description}>
            {isPurchases
              ? 'Покупки готовых инструкций за 50 ₽. Пополнения кошелька учитываются отдельно.'
              : 'Успешные выдачи PDF и самые востребованные инструкции.'}
          </p>
        </div>
        <div className={styles.periods} aria-label="Период статистики">
          {PERIODS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`${styles.period} ${period === item.id ? styles.periodActive : ''}`}
              aria-pressed={period === item.id}
              onClick={() => setPeriod(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className={styles.status} role="status">
          Загружаем статистику…
        </p>
      )}
      {!loading && error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!loading && !error && report && (
        <>
          <SummaryCards items={metrics} />
          <div className={styles.listHeading}>
            <div>
              <h3 className={styles.listTitle}>
                {isPurchases ? 'Топ-10 по покупкам' : 'Топ-10 по скачиваниям'}
              </h3>
              <p className={styles.description}>
                {isPurchases
                  ? 'Одна покупка учитывается один раз.'
                  : 'Повторные скачивания учитываются отдельно.'}
              </p>
            </div>
            <span className={styles.rankHint}>По убыванию количества</span>
          </div>
          <RankingTable items={report.items} mode={section} />
          {!isPurchases && (
            <p className={styles.footnote}>
              {report.trackingStarted
                ? `Доступные записи начинаются с ${new Date(report.trackingStarted).toLocaleDateString('ru-RU')}. `
                : 'Записей о скачиваниях пока нет. '}
              Учёт скачиваний купленных PDF добавлен в этом обновлении; более ранние такие
              скачивания не восстановлены.
            </p>
          )}
        </>
      )}
    </section>
  );
}
