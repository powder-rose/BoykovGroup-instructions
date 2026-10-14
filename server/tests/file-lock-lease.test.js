import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const leaseUtilityPath = path.join(serverRoot, 'src', 'utils', 'fileLeaseLock.js');

function createSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-file-lease-'));
}

function readLock(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ageLock(filePath, milliseconds) {
  const timestamp = new Date(Date.now() - milliseconds);

  fs.utimesSync(filePath, timestamp, timestamp);
}

async function loadLeaseUtility() {
  return import(pathToFileURL(leaseUtilityPath).href);
}

test(
  'heartbeat keeps an active file lease from becoming stale',
  {
    concurrency: false,
  },

  async () => {
    const root = createSandbox();

    const filePath = path.join(root, 'active.lock');

    try {
      const { acquireFileLeaseLock, startFileLeaseHeartbeat, releaseFileLeaseLock } =
        await loadLeaseUtility();

      const first = acquireFileLeaseLock({
        filePath,

        staleMs: 500,

        metadata: {
          kind: 'heartbeat-test',
        },
      });

      assert.equal(first.acquired, true);

      assert.ok(first.owner);

      const stopHeartbeat = startFileLeaseHeartbeat(first, {
        intervalMs: 10,
      });

      /*
       * Имитируем lock, который по одному
       * только mtime уже выглядел бы stale.
       *
       * Активный heartbeat обязан вернуть
       * ему актуальный lease.
       */
      ageLock(filePath, 5_000);

      await new Promise(resolve => setTimeout(resolve, 60));

      const stat = fs.statSync(filePath);

      assert.ok(Date.now() - stat.mtimeMs < 500, 'heartbeat must refresh lock mtime');

      const second = acquireFileLeaseLock({
        filePath,

        staleMs: 500,
      });

      assert.equal(second.acquired, false, 'a live heartbeat lease must not be stolen');

      assert.equal(second.existing?.owner, first.owner);

      stopHeartbeat();

      assert.equal(releaseFileLeaseLock(first), true);

      assert.equal(fs.existsSync(filePath), false);
    } finally {
      fs.rmSync(root, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'stale takeover changes ownership and the old owner cannot touch or release the replacement',
  {
    concurrency: false,
  },

  async () => {
    const root = createSandbox();

    const filePath = path.join(root, 'ownership.lock');

    try {
      const { acquireFileLeaseLock, refreshFileLeaseLock, releaseFileLeaseLock } =
        await loadLeaseUtility();

      const first = acquireFileLeaseLock({
        filePath,

        staleMs: 100,
      });

      assert.equal(first.acquired, true);

      ageLock(filePath, 5_000);

      const second = acquireFileLeaseLock({
        filePath,

        staleMs: 100,
      });

      assert.equal(second.acquired, true, 'stale lock must be recoverable');

      assert.notEqual(second.owner, first.owner, 'replacement must have a new ownership token');

      const replacementBefore = readLock(filePath);

      assert.equal(replacementBefore.owner, second.owner);

      /*
       * Старый worker после takeover
       * больше не имеет права обновлять
       * lease нового worker.
       */
      assert.equal(refreshFileLeaseLock(first), false);

      assert.equal(readLock(filePath).owner, second.owner);

      /*
       * И главное — его finally/release
       * не должен удалить replacement.
       */
      assert.equal(releaseFileLeaseLock(first), false);

      assert.equal(fs.existsSync(filePath), true);

      assert.equal(readLock(filePath).owner, second.owner);

      assert.equal(releaseFileLeaseLock(second), true);

      assert.equal(fs.existsSync(filePath), false);
    } finally {
      fs.rmSync(root, {
        recursive: true,
        force: true,
      });
    }
  },
);

test('scheduled generation wires the shared lease heartbeat into the full run lifecycle', () => {
  const lockSource = fs.readFileSync(
    path.join(serverRoot, 'src', 'services', 'scheduledGenerationFileLock.js'),
    'utf8',
  );

  const serviceSource = fs.readFileSync(
    path.join(serverRoot, 'src', 'services', 'scheduledGenerationService.js'),
    'utf8',
  );

  assert.match(lockSource, /acquireFileLeaseLock/u);

  assert.match(lockSource, /startFileLeaseHeartbeat/u);

  assert.match(lockSource, /releaseFileLeaseLock/u);

  assert.match(lockSource, /SCHEDULED_GENERATION_LOCK_HEARTBEAT_MS/u);

  assert.match(
    serviceSource,
    /startScheduledGenerationLockHeartbeat/u,
    'scheduled generation must start heartbeat after acquiring its global lock',
  );

  assert.match(
    serviceSource,
    /stopHeartbeat/u,
    'scheduled generation must stop heartbeat during cleanup',
  );
});

test('paid generation uses an owned heartbeat lease for each processing order', () => {
  const source = fs.readFileSync(
    path.join(serverRoot, 'src', 'services', 'publicPaidGenerationService.js'),
    'utf8',
  );

  assert.match(source, /acquireFileLeaseLock/u);

  assert.match(source, /startFileLeaseHeartbeat/u);

  assert.match(source, /releaseFileLeaseLock/u);

  assert.match(source, /PUBLIC_GENERATION_LOCK_TTL_MS/u);

  assert.match(source, /PUBLIC_GENERATION_LOCK_HEARTBEAT_MS/u);

  /*
   * Старый вариант release удалял lock
   * просто по orderId без проверки owner.
   */
  assert.doesNotMatch(
    source,
    /fs\.unlinkSync\(lockPath\(orderId\)\)/u,
    'paid generation must not blindly delete a lock by order ID',
  );
});
