import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '..', 'data', 'instructionViews.json');

let data = loadData();

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {};
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error('Instruction views load error:', error);

    return {};
  }
}

function saveData() {
  const directory = path.dirname(DATA_FILE);

  fs.mkdirSync(directory, {
    recursive: true,
  });

  const temporary = `${DATA_FILE}.tmp`;

  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');

  fs.renameSync(temporary, DATA_FILE);
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeEntry(id) {
  const current = data[id];

  if (!current || typeof current !== 'object') {
    data[id] = {
      total: 0,
      dates: {},
    };
  }

  if (!Number.isFinite(Number(data[id].total))) {
    data[id].total = 0;
  }

  if (!data[id].dates || typeof data[id].dates !== 'object') {
    data[id].dates = {};
  }

  return data[id];
}

function sumDays(dates, count) {
  let total = 0;

  const now = new Date();

  for (let index = 0; index < count; index++) {
    const date = new Date(now);

    date.setUTCDate(date.getUTCDate() - index);

    const key = getDateKey(date);

    total += Number(dates[key]) || 0;
  }

  return total;
}

export function recordInstructionView(instructionId) {
  const id = String(instructionId ?? '').trim();

  if (!id) {
    throw new Error('Instruction id is required');
  }

  const entry = normalizeEntry(id);

  const today = getDateKey();

  entry.total = Number(entry.total) + 1;

  entry.dates[today] = (Number(entry.dates[today]) || 0) + 1;

  saveData();

  return getInstructionViewStats(id);
}

export function getInstructionViewStats(instructionId) {
  const id = String(instructionId ?? '').trim();

  const entry = normalizeEntry(id);

  const today = getDateKey();

  return {
    instructionId: id,

    total: Number(entry.total) || 0,

    today: Number(entry.dates[today]) || 0,

    last7Days: sumDays(entry.dates, 7),

    last30Days: sumDays(entry.dates, 30),
  };
}
