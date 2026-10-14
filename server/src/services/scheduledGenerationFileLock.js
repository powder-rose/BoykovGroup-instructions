import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  acquireFileLeaseLock,
  releaseFileLeaseLock,
  startFileLeaseHeartbeat,
} from '../utils/fileLeaseLock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCK_PATH = path.join(__dirname, '..', 'data', 'scheduledGeneration.lock');

const DEFAULT_STALE_LOCK_MS = 30 * 60 * 1000;

const STALE_LOCK_MS =
  Number(process.env.SCHEDULED_GENERATION_LOCK_TTL_MS) > 0
    ? Number(process.env.SCHEDULED_GENERATION_LOCK_TTL_MS)
    : DEFAULT_STALE_LOCK_MS;

const DEFAULT_HEARTBEAT_MS = Math.max(1, Math.min(5 * 60 * 1000, Math.floor(STALE_LOCK_MS / 3)));

const configuredHeartbeatMs = Number(process.env.SCHEDULED_GENERATION_LOCK_HEARTBEAT_MS);

const HEARTBEAT_MS =
  Number.isFinite(configuredHeartbeatMs) &&
  configuredHeartbeatMs > 0 &&
  configuredHeartbeatMs < STALE_LOCK_MS
    ? configuredHeartbeatMs
    : DEFAULT_HEARTBEAT_MS;

export function acquireScheduledGenerationLock() {
  return acquireFileLeaseLock({
    filePath: LOCK_PATH,

    staleMs: STALE_LOCK_MS,

    metadata: {
      kind: 'scheduled-generation',
    },
  });
}

export function startScheduledGenerationLockHeartbeat(lock) {
  return startFileLeaseHeartbeat(lock, {
    intervalMs: HEARTBEAT_MS,

    onError(error) {
      console.error('[ScheduledGeneration] global lock heartbeat failed:', error?.message || error);
    },
  });
}

export function releaseScheduledGenerationLock(lock) {
  const released = releaseFileLeaseLock(lock);

  if (lock?.acquired && !released) {
    console.warn(
      '[ScheduledGeneration] Global lock is no longer owned by this process; not removing it.',
    );
  }

  return released;
}
