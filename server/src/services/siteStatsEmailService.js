import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readDownloadEvents } from './downloadStatsService.js';

import { sendSystemEmail } from './emailVerificationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ANALYTICS_DIR = path.join(__dirname, '..', 'data', 'analytics');

const VISITOR_FILE = path.join(ANALYTICS_DIR, 'visitor-events.jsonl');

const STATE_FILE = path.join(ANALYTICS_DIR, 'daily-site-stats-state.json');

const LOCK_FILE = path.join(ANALYTICS_DIR, 'daily-site-stats.lock');

const TIMEZONE = 'Europe/Moscow';

const EMAIL_TO = process.env.DAILY_STATS_EMAIL_TO || 'bd@boykovdocs.ru';

const SEND_HOUR = Math.min(23, Math.max(0, Number(process.env.DAILY_STATS_HOUR || 8)));

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIODS = [
  {
    key: 'day',

    label: '24 часа',

    ms: DAY_MS,
  },

  {
    key: 'week',

    label: '7 дней',

    ms: 7 * DAY_MS,
  },

  {
    key: 'month',

    label: '30 дней',

    ms: 30 * DAY_MS,
  },

  {
    key: 'year',

    label: '365 дней',

    ms: 365 * DAY_MS,
  },
];

function ensureAnalyticsDir() {
  fs.mkdirSync(ANALYTICS_DIR, {
    recursive: true,
  });
}

function readJsonLines(file) {
  ensureAnalyticsDir();

  if (!fs.existsSync(file)) {
    return [];
  }

  let text = '';

  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }

  const result = [];

  for (const line of text.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    try {
      result.push(JSON.parse(line));
    } catch {
      /*
       * Повреждённую строку пропускаем.
       */
    }
  }

  return result;
}

function getEventTimestamp(event) {
  const value = Date.parse(String(event?.ts || ''));

  return Number.isFinite(value) ? value : null;
}

function aggregatePeriod({ visitors, downloads, since }) {
  const uniqueVisitors = new Set();

  const uniqueDownloaders = new Set();

  let pageViews = 0;
  let downloadsCount = 0;

  for (const event of visitors) {
    const timestamp = getEventTimestamp(event);

    if (timestamp === null || timestamp < since) {
      continue;
    }

    pageViews += 1;

    if (event?.visitor) {
      uniqueVisitors.add(event.visitor);
    }
  }

  for (const event of downloads) {
    const timestamp = getEventTimestamp(event);

    if (timestamp === null || timestamp < since) {
      continue;
    }

    downloadsCount += 1;

    if (event?.downloader) {
      uniqueDownloaders.add(event.downloader);
    }
  }

  const conversion =
    uniqueVisitors.size > 0 ? (uniqueDownloaders.size / uniqueVisitors.size) * 100 : 0;

  return {
    visitors: uniqueVisitors.size,

    pageViews,

    downloaders: uniqueDownloaders.size,

    downloads: downloadsCount,

    conversion,
  };
}

function buildTopDownloads(downloads, now) {
  const map = new Map();

  for (const event of downloads) {
    const id = String(event?.instructionId || '');

    if (!id) {
      continue;
    }

    let item = map.get(id);

    if (!item) {
      item = {
        id,

        title: String(event?.title || id),

        day: 0,
        week: 0,
        month: 0,
        year: 0,
        total: 0,
      };

      map.set(id, item);
    }

    item.total += 1;

    const timestamp = getEventTimestamp(event);

    if (timestamp === null) {
      continue;
    }

    if (timestamp >= now - DAY_MS) {
      item.day += 1;
    }

    if (timestamp >= now - 7 * DAY_MS) {
      item.week += 1;
    }

    if (timestamp >= now - 30 * DAY_MS) {
      item.month += 1;
    }

    if (timestamp >= now - 365 * DAY_MS) {
      item.year += 1;
    }
  }

  return [...map.values()]
    .sort((first, second) => {
      if (second.total !== first.total) {
        return second.total - first.total;
      }

      return second.month - first.month;
    })
    .slice(0, 15);
}

export function getSiteStatsReportData() {
  const visitors = readJsonLines(VISITOR_FILE);

  const downloads = readDownloadEvents();

  const now = Date.now();

  const periods = {};

  for (const period of PERIODS) {
    periods[period.key] = aggregatePeriod({
      visitors,
      downloads,

      since: now - period.ms,
    });
  }

  return {
    generatedAt: new Date().toISOString(),

    periods,

    totalDownloads: downloads.length,

    topDownloads: buildTopDownloads(downloads, now),
  };
}

function numberFormat(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
}

function percentFormat(value) {
  return (
    new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 1,

      maximumFractionDigits: 1,
    }).format(Number(value) || 0) + '%'
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function metricRow(title, data, field, formatter = numberFormat) {
  const cells = PERIODS.map(
    period => `
          <td
            align="right"
            style="
              padding:15px 14px;
              border-bottom:1px solid #e5eaf2;
              font-size:15px;
              font-weight:600;
              color:#172136;
              white-space:nowrap;
              text-align:right;
            "
          >
            ${formatter(data.periods[period.key][field])}
          </td>
        `,
  ).join('');

  return `
    <tr>
      <td
        style="
          padding:15px 14px;
          border-bottom:1px solid #e5eaf2;
          color:#657189;
          font-size:13px;
          line-height:1.4;
          text-align:left;
        "
      >
        ${escapeHtml(title)}
      </td>

      ${cells}
    </tr>
  `;
}

function buildTopRows(data) {
  if (!data.topDownloads.length) {
    return `
      <tr>
        <td
          colspan="7"
          style="
            padding:24px 14px;
            color:#8c96a7;
            font-size:13px;
          "
        >
          Скачивания ещё не зафиксированы.
        </td>
      </tr>
    `;
  }

  return data.topDownloads
    .map(
      (item, index) => `
        <tr>
          <td
            style="
              padding:13px 9px;
              border-bottom:1px solid #e5eaf2;
              color:#8b96a8;
              font-size:12px;
            "
          >
            ${index + 1}
          </td>

          <td
            style="
              padding:13px 9px;
              border-bottom:1px solid #e5eaf2;
              color:#172136;
              font-size:13px;
              line-height:1.45;
            "
          >
            ${escapeHtml(item.title)}
          </td>

          <td
            align="right"
            style="padding:13px 9px;border-bottom:1px solid #e5eaf2;font-size:13px;"
          >
            ${numberFormat(item.day)}
          </td>

          <td
            align="right"
            style="padding:13px 9px;border-bottom:1px solid #e5eaf2;font-size:13px;"
          >
            ${numberFormat(item.week)}
          </td>

          <td
            align="right"
            style="padding:13px 9px;border-bottom:1px solid #e5eaf2;font-size:13px;"
          >
            ${numberFormat(item.month)}
          </td>

          <td
            align="right"
            style="padding:13px 9px;border-bottom:1px solid #e5eaf2;font-size:13px;"
          >
            ${numberFormat(item.year)}
          </td>

          <td
            align="right"
            style="
              padding:13px 9px;
              border-bottom:1px solid #e5eaf2;
              font-size:13px;
              font-weight:700;
              color:#172136;
            "
          >
            ${numberFormat(item.total)}
          </td>
        </tr>
      `,
    )
    .join('');
}

function buildHtml(data) {
  const reportDate = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIMEZONE,

    day: '2-digit',

    month: 'long',

    year: 'numeric',
  }).format(new Date());

  return `
<!doctype html>
<html lang="ru">
  <body
    style="
      margin:0;
      padding:0;
      background:#f4f7fb;
      font-family:Arial,Helvetica,sans-serif;
      color:#172136;
    "
  >
    <div
      style="
        padding:32px 14px;
      "
    >
      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        role="presentation"
      >
        <tr>
          <td align="center">

            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="
                max-width:920px;
                background:#ffffff;
                border:1px solid #e2e7ef;
              "
            >

              <tr>
                <td
                  style="
                    padding:30px 32px 27px;
                    border-bottom:1px solid #e5eaf2;
                  "
                >
                  <div
                    style="
                      margin-bottom:8px;
                      color:#2468d8;
                      font-size:11px;
                      font-weight:700;
                      letter-spacing:1.4px;
                    "
                  >
                    БОЙКОВDOCS · АНАЛИТИКА
                  </div>

                  <div
                    style="
                      color:#172136;
                      font-size:27px;
                      font-weight:600;
                      line-height:1.25;
                    "
                  >
                    Ежедневная статистика сайта
                  </div>

                  <div
                    style="
                      margin-top:7px;
                      color:#8792a5;
                      font-size:13px;
                    "
                  >
                    ${escapeHtml(reportDate)}
                  </div>
                </td>
              </tr>


              <tr>
                <td
                  style="
                    padding:28px 32px 34px;
                  "
                >

                  <div
                    style="
                      margin-bottom:13px;
                      color:#172136;
                      font-size:18px;
                      font-weight:600;
                    "
                  >
                    Основные показатели
                  </div>

                  <table
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    style="
                      /*
   * STATS_MAIN_TABLE_ALIGNMENT_V1
   */
                      table-layout:fixed;
                      border-collapse:collapse;
                      border:1px solid #e5eaf2;
                    "
                  >

                    
                    <colgroup>
                      <col width="36%" />
                      <col width="16%" />
                      <col width="16%" />
                      <col width="16%" />
                      <col width="16%" />
                    </colgroup>

                    <thead>
                      <tr
                        style="
                          background:#f7f9fc;
                        "
                      >
                        <th
                          align="left"
                          style="
                            padding:13px 14px;
                            color:#768197;
                            font-size:12px;
                            font-weight:500;
                          "
                        >
                          Показатель
                        </th>

                        ${PERIODS.map(
                          period => `
                              <th
                                align="right"
                                style="
                                  padding:13px 14px;
                                  color:#768197;
                                  font-size:12px;
                                  font-weight:500;
                                  white-space:nowrap;
                                  text-align:right;
                                "
                              >
                                ${period.label}
                              </th>
                            `,
                        ).join('')}
                      </tr>
                    </thead>

                    <tbody>

                      ${metricRow('Уникальные посетители', data, 'visitors')}

                      ${metricRow('Просмотры страниц', data, 'pageViews')}

                      ${metricRow('Скачавшие пользователи', data, 'downloaders')}

                      ${metricRow('Скачивания PDF', data, 'downloads')}

                      ${metricRow('Конверсия в скачивание', data, 'conversion', percentFormat)}

                    </tbody>
                  </table>


                  <div
                    style="
                      margin-top:25px;
                      padding:20px 22px;
                      background:#f3f7fd;
                      border-left:3px solid #2468d8;
                    "
                  >
                    <div
                      style="
                        color:#7e8a9d;
                        font-size:11px;
                        font-weight:600;
                        letter-spacing:0.7px;
                      "
                    >
                      ВСЕГО СКАЧИВАНИЙ
                    </div>

                    <div
                      style="
                        margin-top:4px;
                        color:#172136;
                        font-size:32px;
                        font-weight:600;
                      "
                    >
                      ${numberFormat(data.totalDownloads)}
                    </div>
                  </div>


                  <div
                    style="
                      margin-top:34px;
                      margin-bottom:13px;
                      color:#172136;
                      font-size:18px;
                      font-weight:600;
                    "
                  >
                    Что скачивают чаще всего
                  </div>

                  <table
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    style="
                      border-collapse:collapse;
                      border:1px solid #e5eaf2;
                    "
                  >
                    <thead>
                      <tr
                        style="
                          background:#f7f9fc;
                        "
                      >
                        <th align="left" style="padding:12px 9px;color:#7a8598;font-size:11px;">#</th>
                        <th align="left" style="padding:12px 9px;color:#7a8598;font-size:11px;">Инструкция</th>
                        <th align="right" style="padding:12px 9px;color:#7a8598;font-size:11px;">24 ч</th>
                        <th align="right" style="padding:12px 9px;color:#7a8598;font-size:11px;">7 дней</th>
                        <th align="right" style="padding:12px 9px;color:#7a8598;font-size:11px;">30 дней</th>
                        <th align="right" style="padding:12px 9px;color:#7a8598;font-size:11px;">365 дней</th>
                        <th align="right" style="padding:12px 9px;color:#7a8598;font-size:11px;">Всего</th>
                      </tr>
                    </thead>

                    <tbody>
                      ${buildTopRows(data)}
                    </tbody>
                  </table>


                  <div
                    style="
                      margin-top:24px;
                      padding-top:18px;
                      border-top:1px solid #edf0f5;
                      color:#929cad;
                      font-size:11px;
                      line-height:1.55;
                    "
                  >
                    Конверсия считается как доля
                    уникальных посетителей,
                    которые скачали хотя бы одну инструкцию.
                    Скачивания администратора
                    в статистику не включаются.
                  </div>

                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </div>
  </body>
</html>
  `;
}

function getMoscowClock() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,

      year: 'numeric',

      month: '2-digit',

      day: '2-digit',

      hour: '2-digit',

      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );

  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,

    hour: Number(parts.hour),
  };
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  ensureAnalyticsDir();

  const tempFile = `${STATE_FILE}.tmp`;

  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');

  fs.renameSync(tempFile, STATE_FILE);
}

function acquireLock() {
  ensureAnalyticsDir();

  try {
    const stat = fs.statSync(LOCK_FILE);

    if (Date.now() - stat.mtimeMs > 2 * 60 * 60 * 1000) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {}

  try {
    return fs.openSync(LOCK_FILE, 'wx');
  } catch {
    return null;
  }
}

function releaseLock(descriptor) {
  try {
    fs.closeSync(descriptor);
  } catch {}

  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {}
}

async function sendReport({ test = false } = {}) {
  const data = getSiteStatsReportData();

  const date = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIMEZONE,

    day: '2-digit',

    month: '2-digit',

    year: 'numeric',
  }).format(new Date());

  const subject = `${test ? '[ТЕСТ] ' : ''}` + `BoykovDocs — статистика сайта за ${date}`;

  const day = data.periods.day;

  const text = [
    `BoykovDocs — статистика сайта за ${date}`,
    '',
    `Посетители за 24 часа: ${day.visitors}`,
    `Просмотры за 24 часа: ${day.pageViews}`,
    `Скачивания за 24 часа: ${day.downloads}`,
    `Конверсия: ${percentFormat(day.conversion)}`,
    `Всего скачиваний: ${data.totalDownloads}`,
  ].join('\n');

  await sendSystemEmail({
    to: EMAIL_TO,

    subject,

    text,

    html: buildHtml(data),
  });

  return {
    sent: true,

    to: EMAIL_TO,

    subject,

    data,
  };
}

export async function sendDailySiteStatsTestEmail() {
  return sendReport({
    test: true,
  });
}

export async function sendDailySiteStatsEmailIfDue() {
  const clock = getMoscowClock();

  if (clock.hour < SEND_HOUR) {
    return {
      status: 'skipped',

      reason: 'before-send-hour',
    };
  }

  const stateBeforeLock = readState();

  if (stateBeforeLock.lastSentDay === clock.day) {
    return {
      status: 'skipped',

      reason: 'already-sent',
    };
  }

  const lock = acquireLock();

  if (lock === null) {
    return {
      status: 'skipped',

      reason: 'locked',
    };
  }

  try {
    const state = readState();

    if (state.lastSentDay === clock.day) {
      return {
        status: 'skipped',

        reason: 'already-sent',
      };
    }

    const result = await sendReport();

    writeState({
      lastSentDay: clock.day,

      lastSentAt: new Date().toISOString(),
    });

    return {
      status: 'sent',

      ...result,
    };
  } finally {
    releaseLock(lock);
  }
}
