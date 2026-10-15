import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { instructionsRepository } from './instructionsRepository.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '..', 'data', 'instructionViews.json');

function loadViews() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {};
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  } catch (error) {
    console.error('Instruction popularity load error:', error);

    return {};
  }
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sumDays(dates, count) {
  let total = 0;

  const now = new Date();

  for (let index = 0; index < count; index++) {
    const date = new Date(now);

    date.setUTCDate(date.getUTCDate() - index);

    const key = getDateKey(date);

    total += Number(dates?.[key]) || 0;
  }

  return total;
}

function normalizePeriod(value) {
  const allowed = new Set(['total', 'today', '7d', '30d']);

  return allowed.has(value) ? value : 'total';
}

function getScore(item, period) {
  switch (period) {
    case 'today':
      return item.today;

    case '7d':
      return item.last7Days;

    case '30d':
      return item.last30Days;

    case 'total':
    default:
      return item.total;
  }
}

export function getInstructionPopularity({ period = 'total', limit = 10 } = {}) {
  const normalizedPeriod = normalizePeriod(period);

  const normalizedLimit = Math.max(1, Math.min(10, Number.parseInt(limit, 10) || 10));

  const viewData = loadViews();

  const todayKey = getDateKey();

  const items = Object.entries(viewData)
    .map(([id, rawEntry]) => {
      const instruction = instructionsRepository.getById(id);

      /*
       * Если инструкция была удалена,
       * в рейтинг её не выводим.
       */
      if (!instruction) {
        return null;
      }

      const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};

      const dates = entry.dates && typeof entry.dates === 'object' ? entry.dates : {};

      const item = {
        id: instruction.id,

        slug: instruction.slug || instruction.id,

        title: instruction.title || instruction.profession || instruction.id,

        profession: instruction.profession || '',

        total: Number(entry.total) || 0,

        today: Number(dates[todayKey]) || 0,

        last7Days: sumDays(dates, 7),

        last30Days: sumDays(dates, 30),
      };

      return {
        ...item,

        score: getScore(item, normalizedPeriod),
      };
    })
    .filter(Boolean)
    .filter(item => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.total !== left.total) {
        return right.total - left.total;
      }

      return String(left.title).localeCompare(String(right.title), 'ru');
    })
    .slice(0, normalizedLimit)
    .map((item, index) => ({
      rank: index + 1,

      ...item,
    }));

  return {
    period: normalizedPeriod,

    limit: normalizedLimit,

    generatedAt: new Date().toISOString(),

    items,
  };
}
