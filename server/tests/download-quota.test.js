import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  createDownloadQuotaService,
  DOWNLOAD_LIMIT,
} from '../src/services/downloadQuotaService.js';
import { acquireFileLeaseLock, releaseFileLeaseLock } from '../src/utils/fileLeaseLock.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const run = promisify(execFile);

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-download-quota-'));
  const file = path.join(directory, 'download-quotas.json');
  const historyFile = path.join(directory, 'download-events.jsonl');
  const options = { file, historyFile };
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, ...options, options, service: createDownloadQuotaService(options) };
}

function event(userId, overrides = {}) {
  return JSON.stringify({
    ts: '2026-10-15T09:00:00.000Z',
    instructionId: 'same-instruction',
    downloader: hash(userId),
    ...overrides,
  });
}

test('five lifetime downloads include repeats, survive restart and isolate accounts', t => {
  const { service, options, file } = fixture(t);
  assert.equal(DOWNLOAD_LIMIT, 5);
  assert.deepEqual(service.get('user-a'), { limit: 5, used: 0, remaining: 5 });
  for (let used = 1; used <= 5; used += 1) {
    const instance = createDownloadQuotaService(options);
    assert.deepEqual(instance.consume(' user-a '), {
      allowed: true,
      limit: 5,
      used,
      remaining: 5 - used,
    });
  }
  const committed = fs.readFileSync(file, 'utf8');
  assert.deepEqual(service.consume('user-a'), {
    allowed: false,
    limit: 5,
    used: 5,
    remaining: 0,
  });
  assert.equal(fs.readFileSync(file, 'utf8'), committed);
  assert.equal(service.consume('user-b').used, 1);
  t.mock.method(Date, 'now', () => Date.parse('2036-10-15T09:00:00Z'));
  assert.deepEqual(createDownloadQuotaService(options).get('user-a'), {
    limit: 5,
    used: 5,
    remaining: 0,
  });
  assert.equal(fs.readFileSync(file, 'utf8').includes('user-a'), false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('history is imported once, ignores malformed events, and clamps previous downloads to five', t => {
  const { service, historyFile, options } = fixture(t);
  fs.writeFileSync(
    historyFile,
    [
      event('user-a'),
      event('user-a'),
      ...Array.from({ length: 9 }, () => event('user-b')),
      '{broken',
      'null',
      '',
      event('user-a', { ts: 'invalid' }),
      event('user-a', { instructionId: '' }),
      event('user-a', { downloader: 'not-a-hash' }),
      event('user-a', { downloader: null }),
    ].join('\n'),
  );
  assert.equal(service.get('user-a').used, 2);
  assert.equal(service.consume('user-b').allowed, false);
  assert.equal(service.consume('user-a').used, 3);
  fs.appendFileSync(historyFile, `\n${event('user-a')}\n${event('user-c')}\n`);
  const restarted = createDownloadQuotaService(options);
  assert.equal(restarted.get('user-a').used, 3);
  assert.equal(restarted.get('user-b').used, 5);
  assert.equal(restarted.get('user-c').used, 0);
});

test('empty migration is durable even when analytics appear later', t => {
  const { service, file, historyFile, options } = fixture(t);
  assert.equal(service.get('user-a').used, 0);
  assert.equal(fs.existsSync(file), true);
  fs.writeFileSync(historyFile, `${event('user-a')}\n`);
  assert.equal(createDownloadQuotaService(options).get('user-a').used, 0);
});

test('corrupt storage and invalid counters fail closed without replacing the file', t => {
  const { service, file } = fixture(t);
  const invalid = [
    '{broken',
    'null',
    '{}',
    JSON.stringify({ version: 2, users: {} }),
    JSON.stringify({ version: 1, users: [] }),
    JSON.stringify({ version: 1, users: { invalid: 0 } }),
    ...[-1, 1.5, 6, '2', null].map(count =>
      JSON.stringify({ version: 1, users: { [hash('user-a')]: count } }),
    ),
  ];
  for (const raw of invalid) {
    fs.writeFileSync(file, raw);
    assert.throws(() => service.get('user-a'));
    assert.throws(() => service.consume('user-a'));
    assert.equal(fs.readFileSync(file, 'utf8'), raw);
    assert.equal(fs.existsSync(`${file}.lock`), false);
  }
});

test('unreadable history does not initialize a fresh quota', t => {
  const { service, file, historyFile } = fixture(t);
  const originalRead = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (target, ...args) => {
    if (target === historyFile) throw Object.assign(new Error('read failed'), { code: 'EACCES' });
    return originalRead(target, ...args);
  });
  assert.throws(() => service.consume('user-a'), { code: 'EACCES' });
  assert.equal(fs.existsSync(file), false);
});

test('failed persistence does not approve a download or overwrite the previous counter', t => {
  const { service, file, directory } = fixture(t);
  service.consume('user-a');
  const original = fs.readFileSync(file, 'utf8');
  const originalRename = fs.renameSync;
  const rename = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === file) throw Object.assign(new Error('disk error'), { code: 'EIO' });
    return originalRename(from, to);
  });
  assert.throws(() => service.consume('user-a'), { code: 'EIO' });
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(directory), ['download-quotas.json']);
  rename.mock.restore();
  assert.equal(service.consume('user-a').used, 2);
});

test('a held lease rejects independent instances without modifying quota', t => {
  const { file, service, options } = fixture(t);
  service.consume('user-a');
  const lock = acquireFileLeaseLock({ filePath: `${file}.lock`, staleMs: 300_000 });
  try {
    const contender = createDownloadQuotaService(options);
    assert.throws(() => contender.consume('user-a'), { code: 'DOWNLOAD_QUOTA_BUSY' });
    assert.throws(() => contender.get('user-a'), { code: 'DOWNLOAD_QUOTA_BUSY' });
  } finally {
    releaseFileLeaseLock(lock);
  }
  assert.equal(service.get('user-a').used, 1);
});

test('lock cleanup failure does not report an already committed download as failed', t => {
  const { service, file } = fixture(t);
  const originalUnlink = fs.unlinkSync;
  const unlink = t.mock.method(fs, 'unlinkSync', (target, ...args) => {
    if (target === `${file}.lock`)
      throw Object.assign(new Error('release failed'), { code: 'EIO' });
    return originalUnlink(target, ...args);
  });
  const log = t.mock.method(console, 'error', () => {});
  assert.deepEqual(service.consume('user-a'), {
    allowed: true,
    limit: 5,
    used: 1,
    remaining: 4,
  });
  assert.equal(log.mock.callCount(), 1);
  unlink.mock.restore();
  fs.unlinkSync(`${file}.lock`);
  assert.equal(service.get('user-a').used, 1);
});

test('parallel processes cannot approve more than five downloads', { timeout: 15_000 }, async t => {
  const { file, historyFile, service } = fixture(t);
  const moduleUrl = new URL('../src/services/downloadQuotaService.js', import.meta.url).href;
  const script = `
    import { setTimeout } from 'node:timers/promises';
    import { createDownloadQuotaService } from ${JSON.stringify(moduleUrl)};
    const service = createDownloadQuotaService({file: process.argv[1], historyFile: process.argv[2]});
    for (let attempt = 0; ; attempt += 1) {
      try {
        process.stdout.write(JSON.stringify(service.consume('shared-user')));
        break;
      } catch (error) {
        if (error.code !== 'DOWNLOAD_QUOTA_BUSY' || attempt >= 500) throw error;
        await setTimeout(5);
      }
    }
  `;
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      run(process.execPath, ['--input-type=module', '--eval', script, file, historyFile]),
    ),
  );
  const quotas = results.map(result => JSON.parse(result.stdout));
  assert.equal(quotas.filter(result => result.allowed).length, 5);
  assert.equal(quotas.filter(result => !result.allowed).length, 5);
  assert.equal(service.get('shared-user').used, 5);
});

test('missing user identity is rejected before creating storage', t => {
  const { file, service } = fixture(t);
  for (const userId of [undefined, null, '', '  ']) {
    assert.throws(() => service.consume(userId), TypeError);
  }
  assert.equal(fs.existsSync(file), false);
});
