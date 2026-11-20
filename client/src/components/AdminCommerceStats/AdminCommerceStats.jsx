import useAdminCommerceStats from './hooks/useAdminCommerceStats.js';
import AdminSalesBreakdown from './AdminSalesBreakdown.jsx';
import { formatNumber, formatMoney, salesSummaryMetrics } from './commerceStatsFormatters.js';
import styles from './AdminCommerceStats.module.css';

const PERIODS = [
  { id: 'total', title: 'Всё время' },
  { id: 'today', title: 'Сегодня' },
  { id: '7d', title: '7 дней' },
  { id: '30d', title: '30 дней' },
];
const FORMATS = [
  { id: 'all', title: 'Все форматы' },
  { id: 'pdf', title: 'PDF' },
  { id: 'docx', title: 'Word' },
];

const PURCHASE_TYPES = [
  { id: 'all', title: 'Все продажи' },
  { id: 'catalog', title: 'Готовые инструкции' },
  { id: 'generation', title: 'Генерации' },
];

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

function RankingTable({ items, mode, showFormats }) {
  if (!items?.length) {
    return <p className={styles.empty}>За выбранный период пока нет записей.</p>;
  }
  const maximum = items[0].count;
  const isPurchase = mode !== 'downloads';
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">№</th>
            <th scope="col">{mode === 'generations' ? 'Профессия / вид работ' : 'Инструкция'}</th>
            <th scope="col">{isPurchase ? 'Покупок' : 'Скачиваний'}</th>
            {showFormats && (
              <>
                <th scope="col">PDF</th>
                <th scope="col">Word</th>
              </>
            )}
            {isPurchase ? (
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
              {showFormats && (
                <>
                  <td>{formatNumber(item.byFormat?.pdf?.count)}</td>
                  <td>{formatNumber(item.byFormat?.docx?.count)}</td>
                </>
              )}
              {isPurchase ? (
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
  const {
    period,
    setPeriod,
    purchaseFormat,
    setPurchaseFormat,
    purchaseType,
    setPurchaseType,
    data,
    loading,
    error,
  } = useAdminCommerceStats(token);
  const isPurchases = section === 'purchases';
  const isAllSales = isPurchases && purchaseType === 'all';
  const isGeneration = isPurchases && purchaseType === 'generation';
  const report =
    data?.[
      !isPurchases ? 'downloads' : isAllSales ? 'sales' : isGeneration ? 'generations' : 'purchases'
    ];
  const allFormats = purchaseFormat === 'all';
  const formatTitle = FORMATS.find(item => item.id === purchaseFormat)?.title;
  const metrics =
    isAllSales || isGeneration
      ? salesSummaryMetrics(report, isGeneration)
      : isPurchases
        ? [
            {
              label: 'Куплено инструкций',
              value: formatNumber(report?.count),
              note: allFormats
                ? `PDF: ${formatNumber(report?.byFormat?.pdf?.count)} · Word: ${formatNumber(report?.byFormat?.docx?.count)}`
                : `Оплаченные ${formatTitle}`,
            },
            {
              label: 'Сумма покупок',
              value: formatMoney(report?.amountMinor),
              note: allFormats
                ? `PDF: ${formatMoney(report?.byFormat?.pdf?.amountMinor)} · Word: ${formatMoney(report?.byFormat?.docx?.amountMinor)}`
                : 'Пополнения баланса не включены',
            },
            {
              label: 'Разных инструкций',
              value: formatNumber(report?.uniqueInstructions),
              note: 'Наименований в покупках',
            },
            {
              label: 'Средний чек',
              value: formatMoney(report?.averageMinor),
              note: 'За покупку формата',
            },
          ]
        : [
            {
              label: 'Всего скачиваний',
              value: formatNumber(report?.count),
              note: 'Файлов PDF и Word',
            },
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
      aria-label={isPurchases ? 'Статистика продаж' : 'Статистика скачиваний'}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>АНАЛИТИКА ИНСТРУКЦИЙ</p>
          <h2 className={styles.title}>
            {isPurchases ? 'Статистика продаж' : 'Статистика скачиваний'}
          </h2>
          <p className={styles.description}>
            {isPurchases
              ? 'Продажи готовых PDF и Word и покупки генераций. Пополнения баланса не включены.'
              : 'Успешные выдачи PDF и Word и самые востребованные инструкции.'}
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

      {isPurchases && (
        <div className={styles.formatFilters}>
          <span className={styles.filterLabel}>Тип покупки</span>
          <div className={styles.periods} role="group" aria-label="Тип покупки">
            {PURCHASE_TYPES.map(item => (
              <button
                key={item.id}
                type="button"
                className={`${styles.period} ${purchaseType === item.id ? styles.periodActive : ''}`}
                aria-pressed={purchaseType === item.id}
                onClick={() => setPurchaseType(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPurchases && purchaseType === 'catalog' && (
        <div className={styles.formatFilters}>
          <span className={styles.filterLabel}>Формат</span>
          <div className={styles.periods} role="group" aria-label="Формат покупки">
            {FORMATS.map(item => (
              <button
                key={item.id}
                type="button"
                className={`${styles.period} ${purchaseFormat === item.id ? styles.periodActive : ''}`}
                aria-pressed={purchaseFormat === item.id}
                onClick={() => setPurchaseFormat(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}

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
          {isAllSales ? (
            <AdminSalesBreakdown purchases={data.purchases} generations={data.generations} />
          ) : (
            <>
              <div className={styles.listHeading}>
                <div>
                  <h3 className={styles.listTitle}>
                    {isGeneration
                      ? 'Топ-10 по покупкам генераций'
                      : isPurchases
                        ? 'Топ-10 по покупкам'
                        : 'Топ-10 по скачиваниям'}
                  </h3>
                  <p className={styles.description}>
                    {isGeneration
                      ? 'Каждый оплаченный заказ — одна покупка. Повторные попытки генерации не увеличивают продажи.'
                      : isPurchases
                        ? 'Каждый купленный формат учитывается один раз. Повторные скачивания не добавляют покупок.'
                        : 'Повторные скачивания учитываются отдельно.'}
                  </p>
                </div>
                <span className={styles.rankHint}>По убыванию количества</span>
              </div>
              <RankingTable
                items={report.items}
                mode={isGeneration ? 'generations' : section}
                showFormats={isPurchases && !isGeneration && allFormats}
              />
            </>
          )}
          {isPurchases && purchaseType !== 'catalog' && (
            <p className={styles.footnote}>
              Оплаты учитываются по дате оплаты, подтверждённые возвраты — по дате возврата. Даты —
              по Москве. Возврат за прошлый период может дать отрицательный итог текущего. Тестовые
              платежи и неоплаченные заказы не учитываются.
            </p>
          )}
          {!isPurchases && (
            <p className={styles.footnote}>
              {report.trackingStarted
                ? `Доступные записи начинаются с ${new Date(report.trackingStarted).toLocaleDateString('ru-RU')}. `
                : 'Записей о скачиваниях пока нет. '}
              Платные скачивания PDF и Word учитываются с момента включения их учёта. Более ранние
              выдачи файлов не восстановлены.
            </p>
          )}
        </>
      )}
    </section>
  );
}
