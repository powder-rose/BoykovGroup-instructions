import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function normalizePositiveNumber(value, label) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive finite number`);
  }

  return number;
}

function readFileLeaseLock(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readLockAgeMs(filePath) {
  try {
    const stat = fs.statSync(filePath);

    return Date.now() - stat.mtimeMs;
  } catch {
    return null;
  }
}

function currentOwnerMatches(filePath, owner) {
  const current = readFileLeaseLock(filePath);

  return Boolean(current?.owner) && current.owner === owner;
}

function createOwner() {
  return [process.pid, Date.now(), randomUUID()].join('-');
}

export function acquireFileLeaseLock({ filePath, staleMs, metadata = {} }) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new TypeError('filePath must be a non-empty string');
  }

  const normalizedStaleMs = normalizePositiveNumber(staleMs, 'staleMs');

  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });

  const owner = createOwner();
  const unavailable = existing => ({
    acquired: false,
    owner: null,
    path: filePath,
    existing,
  });

  /*
   * Attempt #1:
   * normal atomic create.
   *
   * Attempt #2:
   * retry after recovery of a stale lease.
   *
   * Attempt #3:
   * covers a contender that acquired the path
   * between stale removal and our retry.
   */
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let fd;
    try {
      fd = fs.openSync(filePath, 'wx', 0o600);
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EBUSY'].includes(error?.code)) {
        return unavailable(readFileLeaseLock(filePath));
      }
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      const existing = readFileLeaseLock(filePath);

      const ageMs = readLockAgeMs(filePath);

      if (ageMs === null || ageMs <= normalizedStaleMs) {
        return unavailable(existing);
      }

      /*
       * Re-read the lock immediately before
       * stale removal.
       *
       * If ownership changed while we were
       * inspecting it, we leave the replacement
       * alone.
       */
      const current = readFileLeaseLock(filePath);

      if (existing?.owner && current?.owner !== existing.owner) {
        return unavailable(current);
      }

      if (!existing?.owner && current?.owner) {
        return unavailable(current);
      }

      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        if (unlinkError?.code !== 'ENOENT') {
          throw unlinkError;
        }
      }
      continue;
    }

    try {
      const createdAt = new Date().toISOString();

      fs.writeFileSync(
        fd,
        `${JSON.stringify(
          {
            ...metadata,
            owner,
            pid: process.pid,
            createdAt,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    return {
      acquired: true,
      owner,
      path: filePath,
      staleMs: normalizedStaleMs,
    };
  }

  return unavailable(readFileLeaseLock(filePath));
}

export function refreshFileLeaseLock(lock) {
  if (!lock?.acquired || !lock?.owner || !lock?.path) {
    return false;
  }

  if (!currentOwnerMatches(lock.path, lock.owner)) {
    return false;
  }

  try {
    const now = new Date();

    fs.utimesSync(lock.path, now, now);

    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

export function startFileLeaseHeartbeat(lock, { intervalMs, onError } = {}) {
  if (!lock?.acquired || !lock?.owner || !lock?.path) {
    return () => {};
  }

  const fallbackInterval = Math.max(1, Math.floor(Number(lock.staleMs) / 3));

  const normalizedIntervalMs =
    intervalMs === undefined ? fallbackInterval : normalizePositiveNumber(intervalMs, 'intervalMs');

  let stopped = false;

  let timer = null;

  function stop() {
    if (stopped) {
      return;
    }

    stopped = true;

    if (timer) {
      clearInterval(timer);

      timer = null;
    }
  }

  function heartbeat() {
    if (stopped) {
      return;
    }

    try {
      const refreshed = refreshFileLeaseLock(lock);

      /*
       * Ownership was lost or the file
       * disappeared.
       *
       * An old worker must never keep touching
       * a replacement lease.
       */
      if (!refreshed) {
        stop();
      }
    } catch (error) {
      stop();

      if (typeof onError === 'function') {
        onError(error);

        return;
      }

      console.error('[FileLeaseLock] heartbeat failed:', error?.message || error);
    }
  }

  timer = setInterval(heartbeat, normalizedIntervalMs);

  /*
   * Heartbeat itself must not keep Node alive
   * during graceful shutdown.
   */
  timer.unref?.();

  return stop;
}

export function releaseFileLeaseLock(lock) {
  if (!lock?.acquired || !lock?.owner || !lock?.path) {
    return false;
  }

  /*
   * Critical ownership invariant:
   *
   * an old process may reach finally after a
   * stale takeover. It must never delete the
   * new owner's lease.
   */
  if (!currentOwnerMatches(lock.path, lock.owner)) {
    return false;
  }

  try {
    fs.unlinkSync(lock.path);

    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}
