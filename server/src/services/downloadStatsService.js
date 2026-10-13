import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, '..', 'data', 'analytics');

const DOWNLOAD_EVENTS_FILE = path.join(DATA_DIR, 'download-events.jsonl');

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });

  if (!fs.existsSync(DOWNLOAD_EVENTS_FILE)) {
    fs.writeFileSync(DOWNLOAD_EVENTS_FILE, '', 'utf8');
  }
}

function hashUserId(value) {
  return crypto
    .createHash('sha256')
    .update(String(value ?? ''))
    .digest('hex');
}

/*
 * DOWNLOAD_STATS_V1
 *
 * В файл не записываются:
 * - email;
 * - имя;
 * - IP;
 * - исходный userId.
 *
 * Пользователь хранится только
 * в виде SHA-256 хеша.
 */
export function recordInstructionDownload({ instructionId, title, userId }) {
  const id = String(instructionId ?? '').trim();

  const user = String(userId ?? '').trim();

  if (!id || !user) {
    return false;
  }

  ensureStorage();

  const event = {
    ts: new Date().toISOString(),

    instructionId: id,

    title: String(title || id)
      .trim()
      .slice(0, 500),

    downloader: hashUserId(user),
  };

  fs.appendFileSync(DOWNLOAD_EVENTS_FILE, JSON.stringify(event) + '\n', 'utf8');

  return true;
}

export function readDownloadEvents() {
  ensureStorage();

  const text = fs.readFileSync(DOWNLOAD_EVENTS_FILE, 'utf8');

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

      if (event?.ts && event?.instructionId) {
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
