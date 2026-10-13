import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCK_PATH = path.join(__dirname, '..', 'data', 'scheduledGeneration.lock');

/*
 * Если процесс умер, lock не должен
 * блокировать генерацию навсегда.
 *
 * По умолчанию считаем lock протухшим
 * через 30 минут.
 */
const DEFAULT_STALE_LOCK_MS = 30 * 60 * 1000;

const STALE_LOCK_MS = Number(process.env.SCHEDULED_GENERATION_LOCK_TTL_MS) || DEFAULT_STALE_LOCK_MS;

function createOwnerId() {
  return `${process.pid}-` + `${Date.now()}-` + `${Math.random().toString(36).slice(2)}`;
}

function readExistingLock() {
  try {
    const raw = fs.readFileSync(LOCK_PATH, 'utf8');

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isExistingLockStale() {
  try {
    const stat = fs.statSync(LOCK_PATH);

    return Date.now() - stat.mtimeMs > STALE_LOCK_MS;
  } catch {
    return false;
  }
}

export function acquireScheduledGenerationLock() {
  fs.mkdirSync(path.dirname(LOCK_PATH), {
    recursive: true,
  });

  const owner = createOwnerId();

  /*
   * Делаем максимум две попытки:
   *
   * 1. обычное создание;
   * 2. повтор после удаления stale lock.
   */
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      /*
       * "wx" — ключевой момент.
       *
       * Файл создаётся ТОЛЬКО если
       * его ещё нет.
       *
       * Операция атомарна на файловой
       * системе, поэтому два Passenger
       * worker одновременно получить
       * lock не смогут.
       */
      const fd = fs.openSync(LOCK_PATH, 'wx', 0o600);

      try {
        fs.writeFileSync(
          fd,
          JSON.stringify(
            {
              owner,
              pid: process.pid,
              createdAt: new Date().toISOString(),
            },
            null,
            2,
          ) + '\n',
          'utf8',
        );
      } finally {
        fs.closeSync(fd);
      }

      return {
        acquired: true,
        owner,
        path: LOCK_PATH,
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      if (attempt === 1 && isExistingLockStale()) {
        console.warn('[ScheduledGeneration] Обнаружен устаревший global lock. Удаляем.');

        try {
          fs.unlinkSync(LOCK_PATH);
        } catch (unlinkError) {
          if (unlinkError?.code !== 'ENOENT') {
            console.warn(
              '[ScheduledGeneration] Не удалось удалить stale lock:',
              unlinkError.message,
            );
          }
        }

        continue;
      }

      const existing = readExistingLock();

      return {
        acquired: false,
        owner: null,
        path: LOCK_PATH,
        existing,
      };
    }
  }

  return {
    acquired: false,
    owner: null,
    path: LOCK_PATH,
  };
}

export function releaseScheduledGenerationLock(lock) {
  if (!lock?.acquired || !lock?.owner) {
    return;
  }

  /*
   * Не удаляем чужой lock.
   *
   * Это особенно важно, если наш старый
   * lock был признан stale и другой
   * процесс уже успел создать новый.
   */
  const existing = readExistingLock();

  if (existing?.owner && existing.owner !== lock.owner) {
    console.warn('[ScheduledGeneration] Lock уже принадлежит другому процессу. Не удаляем.');

    return;
  }

  try {
    fs.unlinkSync(LOCK_PATH);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('[ScheduledGeneration] Не удалось удалить global lock:', error.message);
    }
  }
}
