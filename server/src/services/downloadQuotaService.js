import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { acquireFileLeaseLock, releaseFileLeaseLock } from '../utils/fileLeaseLock.js';

export const DOWNLOAD_LIMIT = 5;

const DEFAULT_FILE = fileURLToPath(new URL('../../data/download-quotas.json', import.meta.url));
const DEFAULT_HISTORY_FILE = fileURLToPath(
  new URL('../data/analytics/download-events.jsonl', import.meta.url),
);
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function userKey(userId) {
  const value = String(userId ?? '').trim();
  if (!value) throw new TypeError('Download quota requires a user ID');
  return createHash('sha256').update(value).digest('hex');
}

function quotaView(used) {
  return { limit: DOWNLOAD_LIMIT, used, remaining: DOWNLOAD_LIMIT - used };
}

function validateState(state) {
  if (
    !state ||
    state.version !== 1 ||
    !state.users ||
    typeof state.users !== 'object' ||
    Array.isArray(state.users) ||
    Object.entries(state.users).some(
      ([key, count]) =>
        !HASH_PATTERN.test(key) || !Number.isInteger(count) || count < 0 || count > DOWNLOAD_LIMIT,
    )
  ) {
    throw new Error('Invalid download quota storage');
  }
  return state;
}

export function createDownloadQuotaService({
  file = DEFAULT_FILE,
  historyFile = DEFAULT_HISTORY_FILE,
} = {}) {
  function importHistory() {
    const state = { version: 1, users: {} };
    let text;
    try {
      text = fs.readFileSync(historyFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return state;
      throw error;
    }

    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        // Match analytics' tolerance for an interrupted or malformed log line.
        continue;
      }
      if (
        typeof event?.ts !== 'string' ||
        !Number.isFinite(Date.parse(event.ts)) ||
        typeof event.instructionId !== 'string' ||
        !event.instructionId.trim() ||
        typeof event.downloader !== 'string' ||
        !HASH_PATTERN.test(event.downloader)
      ) {
        continue;
      }
      state.users[event.downloader] = Math.min(
        DOWNLOAD_LIMIT,
        (state.users[event.downloader] ?? 0) + 1,
      );
    }
    return state;
  }

  function write(state) {
    const temporaryFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
    let committed = false;
    try {
      const descriptor = fs.openSync(temporaryFile, 'wx', 0o600);
      try {
        fs.writeFileSync(descriptor, `${JSON.stringify(state)}\n`, 'utf8');
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      fs.renameSync(temporaryFile, file);
      committed = true;
    } finally {
      if (!committed) {
        try {
          fs.rmSync(temporaryFile, { force: true });
        } catch {
          // Preserve the original storage error; an orphan temp file is never read.
        }
      }
    }
  }

  function transaction(userId, consume) {
    const key = userKey(userId);
    const lock = acquireFileLeaseLock({ filePath: `${file}.lock`, staleMs: 300_000 });
    if (!lock.acquired) {
      const error = new Error('Download quota storage is busy');
      error.code = 'DOWNLOAD_QUOTA_BUSY';
      throw error;
    }

    try {
      let state;
      let initialized = false;
      try {
        state = validateState(JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        state = importHistory();
        initialized = true;
      }

      const used = state.users[key] ?? 0;
      const allowed = used < DOWNLOAD_LIMIT;
      if (consume && allowed) state.users[key] = used + 1;
      // Persist even an empty migration, so later analytics are never re-imported.
      if (initialized || (consume && allowed)) write(state);
      const view = quotaView(state.users[key] ?? 0);
      return consume ? { allowed, ...view } : view;
    } finally {
      try {
        releaseFileLeaseLock(lock);
      } catch (error) {
        // A committed debit must not look unsuccessful and encourage a retry.
        console.error('[DownloadQuota] Lock release failed:', error?.message || error);
      }
    }
  }

  return {
    get: userId => transaction(userId, false),
    consume: userId => transaction(userId, true),
  };
}

export const downloadQuotaService = createDownloadQuotaService();
