import { useState } from 'react';

const numberFormatter = new Intl.NumberFormat('ru-RU');
const formatNumber = value => numberFormatter.format(Number(value) || 0);
const periods = [
  ['today', 'Сегодня'],
  ['yesterday', 'Вчера'],
  ['last24Hours', '24 часа'],
  ['last7Days', '7 дней'],
  ['last30Days', '30 дней'],
  ['total', 'Всё время'],
];

export default function AdminVisitorStatsContent({ data, loading, error }) {
  const [period, setPeriod] = useState('today');
  const selected = data?.[period];
  const filteredSince = data?.tracking?.filteredSince;
  const sinceLabel = filteredSince
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(filteredSince))
    : null;
  const metrics = [
    ['Посетители', selected?.visitors],
    ['Визиты', selected?.visits],
    ['Просмотры страниц', selected?.pageViews],
  ];
  return (
    <div className="boykovVisitorStats__content">
      {loading && <div className="boykovVisitorStats__loading">Загружаем статистику…</div>}
      {!loading && error && <div className="boykovVisitorStats__loading">{error}</div>}
      {!loading && !error && data && (
        <>
          <div
            className="boykovVisitorStats__periods"
            role="group"
            aria-label="Период посещаемости"
          >
            {periods.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="boykovVisitorStats__grid boykovVisitorStats__metrics">
            {metrics.map(([label, value]) => (
              <div key={label} className="boykovVisitorStats__card">
                <div className="boykovVisitorStats__label">{label}</div>
                <div className="boykovVisitorStats__value">{formatNumber(value)}</div>
              </div>
            ))}
          </div>
          <div className="boykovVisitorStats__note">
            Посетитель — отдельный браузер. Визит начинается после 30 минут без просмотров. Поиск и
            переключение фильтров не создают новые просмотры. Время — московское.
            {period === 'last24Hours'
              ? ' Последние 24 часа считаются по завершённым минутам, как в Boykov Services.'
              : ''}
          </div>
          <div className="boykovVisitorStats__note">
            {sinceLabel
              ? `Обновлённая фильтрация: события с ${sinceLabel} МСК.`
              : 'Обновлённая фильтрация включена; ожидается первый проверенный просмотр.'}{' '}
            {selected?.legacyPageViews > 0
              ? `В выбранном периоде ${formatNumber(selected.legacyPageViews)} просмотров записаны по прежним правилам. История сохранена; достоверно пересчитать её задним числом нельзя.`
              : ''}{' '}
            Собственный счётчик может отличаться от Яндекс Метрики.
          </div>
        </>
      )}
    </div>
  );
}
