import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createDownloadQuotaService,
  nextDownloadQuotaResetAt,
} from '../src/services/downloadQuotaService.js';

const hash = user => createHash('sha256').update(user).digest('hex');
const moscow = value => `${value}+03:00`;

function fixture(t, time = '2026-10-20T12:00:00.000Z') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-monthly-quota-'));
  const file = path.join(directory, 'download-quotas.json');
  const historyFile = path.join(directory, 'download-events.jsonl');
  const clock = { value: Date.parse(time) };
  const options = { file, historyFile, now: () => clock.value };
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { file, historyFile, clock, options, quota: createDownloadQuotaService(options) };
}

test('calendar month is based on Moscow date with end-of-month clamping and leap year', () => {
  assert.equal(
    nextDownloadQuotaResetAt(moscow('2026-01-31T10:15:00.000')),
    '2026-02-28T07:15:00.000Z',
  );
  assert.equal(
    nextDownloadQuotaResetAt(moscow('2028-01-31T10:15:00.000')),
    '2028-02-29T07:15:00.000Z',
  );
  assert.equal(
    nextDownloadQuotaResetAt(moscow('2026-10-31T23:30:00.000')),
    '2026-11-30T20:30:00.000Z',
  );
  assert.equal(
    nextDownloadQuotaResetAt(moscow('2026-12-31T16:00:00.000')),
    '2027-01-31T13:00:00.000Z',
  );
  assert.throws(() => nextDownloadQuotaResetAt('not-a-date'), TypeError);
});

test('five free downloads reset one month after most recent free download', t => {
  const { quota, clock, options } = fixture(t);
  const first = quota.getSchedule('person');
  assert.deepEqual(first, {
    limit: 5,
    used: 0,
    remaining: 5,
    lastFreeDownloadAt: null,
    nextResetAt: null,
  });
  quota.consume('person');
  assert.equal(quota.getSchedule('person').nextResetAt, '2026-11-20T12:00:00.000Z');
  clock.value = Date.parse('2026-10-29T12:00:00.000Z');
  for (let i = 0; i < 4; i += 1) assert.equal(quota.consume('person').allowed, true);
  assert.deepEqual(quota.get('person'), { limit: 5, used: 5, remaining: 0 });
  assert.equal(quota.consume('person').allowed, false);
  assert.equal(quota.getSchedule('person').nextResetAt, '2026-11-29T12:00:00.000Z');
  clock.value = Date.parse('2026-11-29T11:59:59.999Z');
  assert.equal(quota.consume('person').allowed, false);
  clock.value += 1;
  assert.deepEqual(createDownloadQuotaService(options).getSchedule('person'), {
    limit: 5,
    used: 0,
    remaining: 5,
    lastFreeDownloadAt: null,
    nextResetAt: null,
  });
  assert.equal(quota.consume('person').used, 1);
  assert.equal(quota.getSchedule('person').nextResetAt, '2026-12-29T12:00:00.000Z');
});

test('unused free allowance also renews after a month without further downloads', t => {
  const { quota, clock } = fixture(t);
  quota.consume('one');
  quota.consume('two');
  quota.consume('two');
  clock.value = Date.parse('2026-11-20T12:00:00.000Z');
  assert.equal(quota.get('one').remaining, 5);
  assert.equal(quota.get('two').remaining, 5);
  assert.equal(quota.getSchedule('one').nextResetAt, null);
});

test('v1 counters migrate with most recent legitimate free event without resetting counts early', t => {
  const { file, historyFile, clock, quota } = fixture(t);
  fs.writeFileSync(
    file,
    `${JSON.stringify({ version: 1, users: { [hash('a')]: 5, [hash('b')]: 3, [hash('c')]: 0 } })}\n`,
  );
  const events = [
    { ts: '2026-10-17T12:00:00.000Z', downloader: hash('a'), instructionId: 'a' },
    { ts: '2026-10-19T12:00:00.000Z', downloader: hash('a'), instructionId: 'a' },
    { ts: '2026-10-20T11:00:00.000Z', downloader: hash('a'), instructionId: 'paid', kind: 'paid' },
    { ts: '2026-10-18T12:00:00.000Z', downloader: hash('b'), instructionId: 'b' },
    { ts: '2036-10-20T12:00:00.000Z', downloader: hash('a'), instructionId: 'future' },
    { ts: '2026-10-20T10:00:00.000Z', downloader: 'invalid', instructionId: 'bad' },
  ];
  fs.writeFileSync(historyFile, `${events.map(event => JSON.stringify(event)).join('\n')}\n`);
  assert.deepEqual(quota.get('a'), { limit: 5, used: 5, remaining: 0 });
  assert.equal(quota.getSchedule('a').nextResetAt, '2026-11-19T12:00:00.000Z');
  assert.equal(quota.getSchedule('b').nextResetAt, '2026-11-18T12:00:00.000Z');
  assert.deepEqual(quota.getSchedule('c'), {
    limit: 5,
    used: 0,
    remaining: 5,
    lastFreeDownloadAt: null,
    nextResetAt: null,
  });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).version, 2);
  clock.value = Date.parse('2026-11-19T12:00:00.000Z');
  assert.equal(quota.get('a').remaining, 5);
  assert.equal(quota.get('b').remaining, 5);
});

test('unlogged legacy counts get a conservative first renewal; paid events never count as free', t => {
  const { file, historyFile, clock, quota } = fixture(t);
  fs.writeFileSync(file, JSON.stringify({ version: 1, users: { [hash('a')]: 5 } }));
  fs.writeFileSync(
    historyFile,
    `${JSON.stringify({ ts: new Date(clock.value).toISOString(), instructionId: 'paid', downloader: hash('a'), kind: 'paid' })}\n`,
  );
  assert.equal(quota.get('a').remaining, 0);
  assert.equal(quota.getSchedule('a').nextResetAt, '2026-11-20T12:00:00.000Z');
});

test('new storage imports only free events and respects month-old renewal', t => {
  const { quota, historyFile } = fixture(t);
  const events = [
    { ts: '2026-07-03T12:00:00.000Z', downloader: hash('a'), instructionId: 'old' },
    { ts: '2026-07-12T12:00:00.000Z', downloader: hash('a'), instructionId: 'old' },
    { ts: '2026-10-18T12:00:00.000Z', downloader: hash('a'), instructionId: 'new' },
    { ts: '2026-10-19T12:00:00.000Z', downloader: hash('a'), instructionId: 'paid', kind: 'paid' },
  ];
  fs.writeFileSync(historyFile, events.map(x => JSON.stringify(x)).join('\n'));
  assert.deepEqual(quota.getSchedule('a'), {
    limit: 5,
    used: 1,
    remaining: 4,
    lastFreeDownloadAt: '2026-10-18T12:00:00.000Z',
    nextResetAt: '2026-11-18T12:00:00.000Z',
  });
});

test('corrupt persisted timestamps fail closed without replacing quota file', t => {
  const { file, quota } = fixture(t);
  for (const entry of [
    { used: 5, lastFreeDownloadAt: null },
    { used: 0, lastFreeDownloadAt: '2026-10-20T12:00:00.000Z' },
    { used: 6, lastFreeDownloadAt: '2026-10-20T12:00:00.000Z' },
    { used: 1, lastFreeDownloadAt: 'not-a-date' },
  ]) {
    const raw = JSON.stringify({ version: 2, users: { [hash('a')]: entry } });
    fs.writeFileSync(file, raw);
    assert.throws(() => quota.get('a'), /Invalid download quota storage/);
    assert.throws(() => quota.consume('a'), /Invalid download quota storage/);
    assert.equal(fs.readFileSync(file, 'utf8'), raw);
  }
});
