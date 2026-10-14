import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const writers = new Set();

function registerWriter(writer) {
  writers.add(writer);

  return writer;
}

function logWriterError(label, error) {
  console.error(`[AsyncFileWriter:${label}] write failed:`, error?.message || error);
}

async function ensureDirectory(filePath) {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });
}

export function createBufferedFileAppender({ filePath, label = 'append' }) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new TypeError('filePath must be a non-empty string');
  }

  let queue = [];

  let activePromise = null;

  let scheduled = false;

  async function performDrain() {
    while (queue.length > 0) {
      /*
       * Everything currently queued becomes
       * one append operation.
       *
       * This preserves event ordering while
       * avoiding one filesystem syscall per
       * page view/download/AI usage event.
       */
      const batch = queue.join('');

      queue = [];

      try {
        await ensureDirectory(filePath);

        await appendFile(filePath, batch, 'utf8');
      } catch (error) {
        /*
         * Preserve the failed batch so a later
         * event or graceful shutdown flush can
         * retry it.
         */
        queue.unshift(batch);

        throw error;
      }
    }
  }

  function startDrain() {
    if (activePromise) {
      return activePromise;
    }

    const current = performDrain();

    activePromise = current;

    void current
      .finally(() => {
        if (activePromise === current) {
          activePromise = null;
        }
      })
      .catch(() => {
        /*
         * The original promise still carries
         * the failure to flush().
         *
         * This catch only prevents an unhandled
         * rejection from the finally-chain.
         */
      });

    return current;
  }

  function scheduleDrain() {
    if (scheduled || activePromise || queue.length === 0) {
      return;
    }

    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;

      if (queue.length === 0 || activePromise) {
        return;
      }

      void startDrain().catch(error => {
        logWriterError(label, error);
      });
    });
  }

  const writer = {
    append(value) {
      queue.push(String(value));

      scheduleDrain();
    },

    async flush() {
      /*
       * Keep looping because new events may be
       * enqueued while an async append is in
       * progress.
       */
      while (queue.length > 0 || activePromise) {
        if (activePromise) {
          await activePromise;
        } else {
          await startDrain();
        }
      }
    },
  };

  return registerWriter(writer);
}

export function createLatestAtomicJsonWriter({ filePath, label = 'json' }) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new TypeError('filePath must be a non-empty string');
  }

  let pendingSnapshot = null;

  let activePromise = null;

  let scheduled = false;

  let sequence = 0;

  async function performDrain() {
    while (pendingSnapshot !== null) {
      const snapshot = pendingSnapshot;

      pendingSnapshot = null;

      sequence += 1;

      const temporaryPath = path.join(
        path.dirname(filePath),
        `.${path.basename(filePath)}.` + `${process.pid}.` + `${sequence}.` + `${randomUUID()}.tmp`,
      );

      try {
        await ensureDirectory(filePath);

        await writeFile(temporaryPath, snapshot, 'utf8');

        await rename(temporaryPath, filePath);
      } catch (error) {
        /*
         * If nothing newer arrived while this
         * write was running, retain the failed
         * snapshot for retry.
         *
         * If a newer state exists, it supersedes
         * this older snapshot.
         */
        if (pendingSnapshot === null) {
          pendingSnapshot = snapshot;
        }

        try {
          await unlink(temporaryPath);
        } catch (cleanupError) {
          if (cleanupError?.code !== 'ENOENT') {
            console.error(
              `[AsyncFileWriter:${label}] temp cleanup failed:`,
              cleanupError?.message || cleanupError,
            );
          }
        }

        throw error;
      }
    }
  }

  function startDrain() {
    if (activePromise) {
      return activePromise;
    }

    const current = performDrain();

    activePromise = current;

    void current
      .finally(() => {
        if (activePromise === current) {
          activePromise = null;
        }
      })
      .catch(() => {});

    return current;
  }

  function scheduleDrain() {
    if (scheduled || activePromise || pendingSnapshot === null) {
      return;
    }

    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;

      if (pendingSnapshot === null || activePromise) {
        return;
      }

      void startDrain().catch(error => {
        logWriterError(label, error);
      });
    });
  }

  const writer = {
    write(value) {
      /*
       * Serialize immediately.
       *
       * The caller may continue mutating its
       * in-memory object after write() returns;
       * this captures the exact newest state
       * requested at this moment.
       */
      pendingSnapshot = `${JSON.stringify(value, null, 2)}\n`;

      scheduleDrain();
    },

    async flush() {
      while (pendingSnapshot !== null || activePromise) {
        if (activePromise) {
          await activePromise;
        } else {
          await startDrain();
        }
      }
    },
  };

  return registerWriter(writer);
}

export async function flushAsyncFileWrites() {
  const results = await Promise.allSettled([...writers].map(writer => writer.flush()));

  const errors = results
    .filter(result => result.status === 'rejected')
    .map(result => result.reason);

  if (errors.length > 0) {
    throw new AggregateError(errors, 'Failed to flush asynchronous file writes');
  }
}
