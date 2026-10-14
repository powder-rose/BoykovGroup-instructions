import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createBufferedFileAppender } from '../utils/asyncFileWriter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, '..', 'data', 'analytics');

const EVENTS_FILE = path.join(DATA_DIR, 'visitor-events.jsonl');

const MOSCOW_TIMEZONE = 'Europe/Moscow';

const visitorEventWriter = createBufferedFileAppender({
  filePath: EVENTS_FILE,

  label: 'visitor-page-views',
});

function ensureStorage() {
  /*
   * Runtime writes are handled by asyncFileWriter.
   *
   * The hot path must not create files
   * synchronously inside the event loop.
   */
}

function getDayKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MOSCOW_TIMEZONE,

    year: 'numeric',

    month: '2-digit',

    day: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );

  return `${parts.year}-` + `${parts.month}-` + `${parts.day}`;
}

function getDayKeyOffset(offset) {
  return getDayKey(new Date(Date.now() + Number(offset) * 86400000));
}

function getDayKeys(numberOfDays) {
  return new Set(
    Array.from(
      {
        length: numberOfDays,
      },

      (_, index) => getDayKeyOffset(-index),
    ),
  );
}

function normalizeVisitorId(value) {
  const id = String(value ?? '').trim();

  if (id.length < 16 || id.length > 128) {
    return null;
  }

  if (!/^[a-zA-Z0-9_-]+$/u.test(id)) {
    return null;
  }

  return id;
}

function hashVisitorId(visitorId) {
  return crypto.createHash('sha256').update(visitorId).digest('hex');
}

function readEvents() {
  ensureStorage();

  let text;

  try {
    text = fs.readFileSync(EVENTS_FILE, 'utf-8');
  } catch (error) {
    console.error('Visitor stats read error:', error);

    return [];
  }

  if (!text.trim()) {
    return [];
  }

  const events = [];

  for (const line of text.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    try {
      const event = JSON.parse(line);

      if (event?.day && event?.visitor) {
        events.push(event);
      }
    } catch {
      /*
       * Одна повреждённая строка
       * не должна ломать статистику.
       */
    }
  }

  return events;
}

function aggregatePeriod(events, allowedDays = null) {
  const visitors = new Set();

  let pageViews = 0;

  for (const event of events) {
    if (allowedDays && !allowedDays.has(event.day)) {
      continue;
    }

    pageViews += 1;

    visitors.add(event.visitor);
  }

  return {
    visitors: visitors.size,

    pageViews,
  };
}

export function isLikelyBot(userAgent = '') {
  return /bot|crawler|spider|slurp|yandex|googlebot|bingbot|duckduckbot|baiduspider|facebookexternalhit|preview/iu.test(
    String(userAgent ?? ''),
  );
}

export function recordVisitorPageView({ visitorId }) {
  const normalized = normalizeVisitorId(visitorId);

  if (!normalized) {
    return false;
  }

  ensureStorage();

  const now = new Date();

  const event = {
    ts: now.toISOString(),

    day: getDayKey(now),

    visitor: hashVisitorId(normalized),
  };

  visitorEventWriter.append(`${JSON.stringify(event)}\n`);

  return true;
}

export function getVisitorStats() {
  const events = readEvents();

  const todayKey = getDayKeyOffset(0);

  const yesterdayKey = getDayKeyOffset(-1);

  const today = aggregatePeriod(events, new Set([todayKey]));

  const yesterday = aggregatePeriod(events, new Set([yesterdayKey]));

  const last7Days = aggregatePeriod(events, getDayKeys(7));

  const last30Days = aggregatePeriod(events, getDayKeys(30));

  const total = aggregatePeriod(events);

  return {
    today,
    yesterday,
    last7Days,
    last30Days,
    total,

    generatedAt: new Date().toISOString(),

    timezone: MOSCOW_TIMEZONE,
  };
}
