import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createBufferedFileAppender } from '../utils/asyncFileWriter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, '..', 'data', 'analytics');

const DOWNLOAD_EVENTS_FILE = path.join(DATA_DIR, 'download-events.jsonl');

const downloadEventWriter = createBufferedFileAppender({
  filePath: DOWNLOAD_EVENTS_FILE,

  label: 'instruction-downloads',
});

function ensureStorage() {
  /*
   * Runtime writes are handled by asyncFileWriter.
   *
   * Readers still handle missing files safely.
   */
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

  downloadEventWriter.append(`${JSON.stringify(event)}\n`);

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
