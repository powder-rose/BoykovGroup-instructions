import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { createDownloadQuotaService } from '../src/services/downloadQuotaService.js';
import { acquireFileLeaseLock, releaseFileLeaseLock } from '../src/utils/fileLeaseLock.js';

const run = promisify(execFile);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-windows-lock-'));
  const filePath = path.join(root, 'quota.lock');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, filePath };
}

function platform(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { ...descriptor, value });
  t.after(() => Object.defineProperty(process, 'platform', descriptor));
}

function unavailableError(code) {
  return Object.assign(new Error(`Simulated ${code}`), { code });
}

test('Windows exclusive-open contention never writes or removes fresh, stale, missing or unreadable leases', async t => {
  for (const code of ['EPERM', 'EBUSY']) {
    for (const state of ['fresh', 'stale', 'missing', 'unreadable']) {
      await t.test(`${code}: ${state}`, subtest => {
        const { root, filePath } = fixture(subtest);
        const originalOpen = fs.openSync;
        const originalRead = fs.readFileSync;
        const originalWrite = fs.writeFileSync;
        const originalUnlink = fs.unlinkSync;
        const bytes = Buffer.from(JSON.stringify({ owner: 'foreign-owner', pid: process.pid }));
        if (state !== 'missing') fs.writeFileSync(filePath, bytes);
        if (state === 'stale' || state === 'unreadable') {
          const aged = new Date(Date.now() - 60_000);
          fs.utimesSync(filePath, aged, aged);
        }
        platform(subtest, 'win32');
        let openAttempts = 0;
        let writes = 0;
        let unlinks = 0;
        subtest.mock.method(fs, 'openSync', (target, flags, ...args) => {
          if (target === filePath && flags === 'wx') {
            openAttempts++;
            throw unavailableError(code);
          }
          return originalOpen(target, flags, ...args);
        });
        subtest.mock.method(fs, 'readFileSync', (target, ...args) => {
          if (state === 'unreadable' && target === filePath) throw unavailableError('EACCES');
          return originalRead(target, ...args);
        });
        subtest.mock.method(fs, 'writeFileSync', (...args) => {
          writes++;
          return originalWrite(...args);
        });
        subtest.mock.method(fs, 'unlinkSync', (target, ...args) => {
          if (target === filePath) unlinks++;
          return originalUnlink(target, ...args);
        });
        const lock = acquireFileLeaseLock({ filePath, staleMs: 1000 });
        assert.equal(lock.acquired, false);
        assert.equal(lock.owner, null);
        assert.equal(lock.path, filePath);
        assert.equal(openAttempts, 1);
        assert.equal(writes, 0);
        assert.equal(unlinks, 0);
        if (state === 'missing') assert.deepEqual(fs.readdirSync(root), []);
        else assert.deepEqual(originalRead(filePath), bytes);
      });
    }
  }
});

test('an exclusive lease is granted only after Windows open contention clears', t => {
  const { filePath } = fixture(t);
  platform(t, 'win32');
  const originalOpen = fs.openSync;
  const failures = ['EPERM', 'EBUSY'];
  t.mock.method(fs, 'openSync', (target, flags, ...args) => {
    if (target === filePath && flags === 'wx' && failures.length)
      throw unavailableError(failures.shift());
    return originalOpen(target, flags, ...args);
  });
  assert.equal(acquireFileLeaseLock({ filePath, staleMs: 1000 }).acquired, false);
  assert.equal(acquireFileLeaseLock({ filePath, staleMs: 1000 }).acquired, false);
  assert.equal(fs.existsSync(filePath), false);
  const owner = acquireFileLeaseLock({ filePath, staleMs: 1000 });
  assert.equal(owner.acquired, true);
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).owner, owner.owner);
  const contender = acquireFileLeaseLock({ filePath, staleMs: 1000 });
  assert.equal(contender.acquired, false);
  assert.equal(contender.existing.owner, owner.owner);
  assert.equal(releaseFileLeaseLock(owner), true);
  assert.equal(fs.existsSync(filePath), false);
});

test('open errors outside the two Windows contention codes propagate unchanged', async t => {
  const cases = [
    ['linux', ['EPERM', 'EBUSY', 'EACCES', 'EIO', 'ENOSPC', 'EMFILE', 'EROFS']],
    ['win32', ['EACCES', 'EIO', 'ENOSPC', 'EMFILE', 'EROFS']],
  ];
  for (const [system, codes] of cases) {
    for (const code of codes) {
      await t.test(`${system}: ${code}`, subtest => {
        const { filePath } = fixture(subtest);
        platform(subtest, system);
        const expected = unavailableError(code);
        const originalOpen = fs.openSync;
        subtest.mock.method(fs, 'openSync', (target, flags, ...args) => {
          if (target === filePath && flags === 'wx') throw expected;
          return originalOpen(target, flags, ...args);
        });
        assert.throws(
          () => acquireFileLeaseLock({ filePath, staleMs: 1000 }),
          error => error === expected,
        );
        assert.equal(fs.existsSync(filePath), false);
      });
    }
  }
});

test('Windows write, flush and close faults after successful creation are never reported as contention', async t => {
  for (const phase of ['write', 'flush', 'close']) {
    for (const code of ['EPERM', 'EBUSY', 'EACCES', 'EEXIST']) {
      await t.test(`${phase}: ${code}`, subtest => {
        const { filePath } = fixture(subtest);
        platform(subtest, 'win32');
        const expected = unavailableError(code);
        const originalOpen = fs.openSync;
        const originalWrite = fs.writeFileSync;
        const originalSync = fs.fsyncSync;
        const originalClose = fs.closeSync;
        const originalUnlink = fs.unlinkSync;
        let descriptor;
        let closed = 0;
        let unlinks = 0;
        subtest.mock.method(fs, 'openSync', (target, flags, ...args) => {
          const opened = originalOpen(target, flags, ...args);
          if (target === filePath && flags === 'wx') descriptor = opened;
          return opened;
        });
        subtest.mock.method(fs, 'writeFileSync', (target, ...args) => {
          if (phase === 'write' && target === descriptor) throw expected;
          return originalWrite(target, ...args);
        });
        subtest.mock.method(fs, 'fsyncSync', target => {
          if (phase === 'flush' && target === descriptor) throw expected;
          return originalSync(target);
        });
        subtest.mock.method(fs, 'closeSync', target => {
          const result = originalClose(target);
          if (target === descriptor) {
            closed++;
            if (phase === 'close') throw expected;
          }
          return result;
        });
        subtest.mock.method(fs, 'unlinkSync', (target, ...args) => {
          if (target === filePath) unlinks++;
          return originalUnlink(target, ...args);
        });
        assert.throws(
          () => acquireFileLeaseLock({ filePath, staleMs: 1000 }),
          error => error === expected,
        );
        assert.equal(closed, 1);
        assert.equal(unlinks, 0);
        assert.equal(fs.existsSync(filePath), true);
      });
    }
  }
});

test('a transient Windows create failure leaves quota data untouched until a lease is acquired', t => {
  const { root } = fixture(t);
  const file = path.join(root, 'download-quotas.json');
  const historyFile = path.join(root, 'history.json');
  const service = createDownloadQuotaService({ file, historyFile });
  const originalOpen = fs.openSync;
  let fail = true;
  platform(t, 'win32');
  t.mock.method(fs, 'openSync', (target, flags, ...args) => {
    if (fail && target === `${file}.lock` && flags === 'wx') throw unavailableError('EPERM');
    return originalOpen(target, flags, ...args);
  });
  assert.throws(() => service.consume('person'), { code: 'DOWNLOAD_QUOTA_BUSY' });
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(`${file}.lock`), false);
  fail = false;
  assert.deepEqual(service.consume('person'), { allowed: true, limit: 5, used: 1, remaining: 4 });
  assert.deepEqual(service.get('person'), { limit: 5, used: 1, remaining: 4 });
});

test(
  'ten independent quota processes retry Windows open contention and still grant exactly five downloads',
  {
    timeout: 30_000,
  },
  async t => {
    const { root } = fixture(t);
    const file = path.join(root, 'download-quotas.json');
    const historyFile = path.join(root, 'history.json');
    const moduleUrl = new URL('../src/services/downloadQuotaService.js', import.meta.url).href;
    const script = `
    import fs from 'node:fs';
    import { setTimeout } from 'node:timers/promises';
    const file = process.argv[1];
    const historyFile = process.argv[2];
    const forcedFailures = Number(process.argv[3]);
    let remaining = forcedFailures;
    let retries = 0;
    Object.defineProperty(process, 'platform', {value:'win32', configurable:true});
    const open = fs.openSync;
    fs.openSync = (target, flags, ...args) => {
      if(target === file+'.lock' && flags === 'wx' && remaining > 0) {
        remaining--;
        throw Object.assign(new Error('Simulated delete-pending lock'), {code:'EPERM'});
      }
      return open(target, flags, ...args);
    };
    const {createDownloadQuotaService} = await import(${JSON.stringify(moduleUrl)});
    const service = createDownloadQuotaService({file, historyFile});
    for(let attempt = 0; ; attempt++) {
      try {
        const quota = service.consume('shared-user');
        process.stdout.write(JSON.stringify({...quota, forcedFailures:forcedFailures-remaining, retries}));
        break;
      } catch(error) {
        if(error.code !== 'DOWNLOAD_QUOTA_BUSY' || attempt >= 500) throw error;
        retries++;
        await setTimeout(5);
      }
    }
  `;
    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        run(
          process.execPath,
          ['--input-type=module', '--eval', script, file, historyFile, String((index % 2) + 1)],
          { timeout: 15_000 },
        ),
      ),
    );
    const quotas = outcomes.map((outcome, index) => {
      assert.equal(outcome.status, 'fulfilled', outcome.reason?.stderr || outcome.reason?.message);
      const result = JSON.parse(outcome.value.stdout);
      assert.equal(result.forcedFailures, (index % 2) + 1);
      assert.ok(result.retries >= result.forcedFailures);
      return result;
    });
    assert.equal(quotas.filter(value => value.allowed).length, 5);
    assert.equal(quotas.filter(value => !value.allowed).length, 5);
    const service = createDownloadQuotaService({ file, historyFile });
    assert.deepEqual(service.get('shared-user'), { limit: 5, used: 5, remaining: 0 });
  },
);
