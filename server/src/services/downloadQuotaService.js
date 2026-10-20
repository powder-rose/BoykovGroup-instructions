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
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

function userKey(userId) {
  const value = String(userId ?? '').trim();
  if (!value) throw new TypeError('Download quota requires a user ID');
  return createHash('sha256').update(value).digest('hex');
}

function quotaView(used) {
  return { limit: DOWNLOAD_LIMIT, used, remaining: DOWNLOAD_LIMIT - used };
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function nextDownloadQuotaResetAt(timestamp) {
  if (!validTimestamp(timestamp)) throw new TypeError('Invalid free download timestamp');
  const source = new Date(Date.parse(timestamp) + MOSCOW_OFFSET_MS);
  const firstOfNextMonth = Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 1);
  const firstOfMonthAfter = Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 2, 1);
  const lastDay = new Date(firstOfMonthAfter - 1).getUTCDate();
  const day = Math.min(source.getUTCDate(), lastDay);
  return new Date(
    firstOfNextMonth +
      (day - 1) * 86_400_000 +
      source.getUTCHours() * 3_600_000 +
      source.getUTCMinutes() * 60_000 +
      source.getUTCSeconds() * 1_000 +
      source.getUTCMilliseconds() -
      MOSCOW_OFFSET_MS,
  ).toISOString();
}

function validateState(state) {
  if (
    !state ||
    ![1, 2].includes(state.version) ||
    !state.users ||
    typeof state.users !== 'object' ||
    Array.isArray(state.users) ||
    Object.entries(state.users).some(([key, entry]) => {
      if (!HASH_PATTERN.test(key)) return true;
      if (state.version === 1) {
        return !Number.isInteger(entry) || entry < 0 || entry > DOWNLOAD_LIMIT;
      }
      return (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        !Number.isInteger(entry.used) ||
        entry.used < 0 ||
        entry.used > DOWNLOAD_LIMIT ||
        (entry.lastFreeDownloadAt !== null && !validTimestamp(entry.lastFreeDownloadAt)) ||
        (entry.used === 0 && entry.lastFreeDownloadAt !== null) ||
        (entry.used > 0 && !validTimestamp(entry.lastFreeDownloadAt))
      );
    })
  ) {
    throw new Error('Invalid download quota storage');
  }
  return state;
}

export function createDownloadQuotaService({
  file = DEFAULT_FILE,
  historyFile = DEFAULT_HISTORY_FILE,
  now = () => Date.now(),
} = {}) {
  function readHistory(nowMs) {
    let text;
    try {
      text = fs.readFileSync(historyFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }

    const events = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      const when = Date.parse(event?.ts);
      if (
        !validTimestamp(event?.ts) ||
        when > nowMs ||
        (event.kind !== undefined && event.kind !== 'free') ||
        typeof event.instructionId !== 'string' ||
        !event.instructionId.trim() ||
        typeof event.downloader !== 'string' ||
        !HASH_PATTERN.test(event.downloader)
      ) {
        continue;
      }
      events.push({ user: event.downloader, when });
    }
    return events.sort((a, b) => a.when - b.when);
  }

  function importHistory(nowMs) {
    const state = { version: 2, users: {} };
    for (const event of readHistory(nowMs)) {
      const previous = state.users[event.user];
      const expired =
        previous && event.when >= Date.parse(nextDownloadQuotaResetAt(previous.lastFreeDownloadAt));
      const used = expired ? 0 : (previous?.used ?? 0);
      state.users[event.user] = {
        used: Math.min(DOWNLOAD_LIMIT, used + 1),
        lastFreeDownloadAt: new Date(event.when).toISOString(),
      };
    }
    return state;
  }

  function migrateV1(state, nowMs) {
    const latest = new Map();
    for (const event of readHistory(nowMs)) latest.set(event.user, event.when);
    const fallback = new Date(nowMs).toISOString();
    const users = {};
    for (const [key, used] of Object.entries(state.users)) {
      users[key] = {
        used,
        lastFreeDownloadAt: used ? new Date(latest.get(key) ?? fallback).toISOString() : null,
      };
    }
    return { version: 2, users };
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

  function transaction(userId, consume, schedule = false) {
    const key = userKey(userId);
    const lock = acquireFileLeaseLock({ filePath: `${file}.lock`, staleMs: 300_000 });
    if (!lock.acquired) {
      const error = new Error('Download quota storage is busy');
      error.code = 'DOWNLOAD_QUOTA_BUSY';
      throw error;
    }

    try {
      const nowMs = now();
      if (!Number.isFinite(nowMs)) throw new Error('Invalid download quota clock');
      let state;
      let changed = false;
      try {
        state = validateState(JSON.parse(fs.readFileSync(file, 'utf8')));
        if (state.version === 1) {
          state = migrateV1(state, nowMs);
          changed = true;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        state = importHistory(nowMs);
        changed = true;
      }

      let entry = state.users[key] ?? { used: 0, lastFreeDownloadAt: null };
      const renewal = entry.lastFreeDownloadAt
        ? nextDownloadQuotaResetAt(entry.lastFreeDownloadAt)
        : null;
      if (renewal && nowMs >= Date.parse(renewal)) {
        entry = { used: 0, lastFreeDownloadAt: null };
        state.users[key] = entry;
        changed = true;
      }

      const allowed = entry.used < DOWNLOAD_LIMIT;
      if (consume && allowed) {
        entry = { used: entry.used + 1, lastFreeDownloadAt: new Date(nowMs).toISOString() };
        state.users[key] = entry;
        changed = true;
      }

      if (changed) write(state);
      const view = quotaView(entry.used);
      if (schedule) {
        return {
          ...view,
          lastFreeDownloadAt: entry.lastFreeDownloadAt,
          nextResetAt: entry.lastFreeDownloadAt
            ? nextDownloadQuotaResetAt(entry.lastFreeDownloadAt)
            : null,
        };
      }
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
    getSchedule: userId => transaction(userId, false, true),
    consume: userId => transaction(userId, true),
  };
}

export const downloadQuotaService = createDownloadQuotaService();
