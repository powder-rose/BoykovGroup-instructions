import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import {
  createVisitorTokens,
  hashVisitorId,
  isLikelyBot,
  normalizeTrackingPath,
} from '../src/services/visitorTrackingPolicy.js';
import {
  createVisitorStatsService,
  readVisitorEvents,
  summarizeVisitorEvents,
} from '../src/services/visitorStatsService.js';
import { createVisitorStatsRouter } from '../src/routes/visitorStats.js';
import {
  createVisitorTracker,
  trackingPageKey,
} from '../../client/public/assets/visitor-tracking.js';

const baseTime = Date.parse('2026-11-23T08:17:14Z');
const hashA = hashVisitorId('browser-id-abcdefghijkl');

test('tracking receipts are purpose separated, expire, bind origin and preserve a signed cookie identity', () => {
  let clock = baseTime;
  const tokens = createVisitorTokens({
    secret: () => 'fixture-secret-'.repeat(4),
    clock: () => clock,
  });
  const origin = 'https://boykovdocs.ru';
  const first = tokens.bootstrap({ visitorId: 'browser-id-abcdefghijkl', origin });
  const second = tokens.bootstrap({
    visitorId: 'rotated-id-abcdefghijkl',
    cookie: first.cookie,
    origin,
  });
  assert.equal(tokens.verifyReceipt(second.receipt, origin), hashA);
  assert.equal(tokens.verifyReceipt(first.cookie, origin), null);
  assert.equal(tokens.verifyReceipt(first.receipt + 'x', origin), null);
  assert.equal(tokens.verifyReceipt(first.receipt, 'https://foreign.invalid'), null);
  assert.equal(tokens.bootstrap({ visitorId: 'bad', origin }), null);
  clock += 16 * 60000;
  assert.equal(tokens.verifyReceipt(first.receipt, origin), null);
});

test('event IDs deduplicate retries across restarts while separate page views and legacy history survive', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-visitor-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'events.jsonl');
  const old =
    JSON.stringify({ ts: '2026-11-23T07:00:00Z', day: 'wrong-day', visitor: hashA }) + '\n';
  fs.writeFileSync(file, old);
  const one = createVisitorStatsService({ file, clock: () => baseTime });
  const payload = { visitorHash: hashA, eventId: 'event-id-abcdefghijkl' };
  assert.equal(one.record(payload), true);
  assert.equal(one.record(payload), false);
  assert.equal(one.record({ ...payload, eventId: 'different-event-abcdef' }), true);
  await one.flush();
  const before = fs.readFileSync(file, 'utf8');
  const two = createVisitorStatsService({ file, clock: () => baseTime + 1000 });
  assert.equal(two.record(payload), false);
  await two.flush();
  const report = two.getStats();
  assert.deepEqual(report.today, { visitors: 1, visits: 2, pageViews: 3, legacyPageViews: 1 });
  assert.equal(report.tracking.filteredSince, new Date(baseTime).toISOString());
  assert.ok(before.startsWith(old));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.ok(!before.includes(payload.eventId));
  assert.ok(!before.includes('browser-id-abcdefghijkl'));
});

test('Moscow calendar periods and rolling completed minutes are distinct; prior sessions are carried across boundaries', () => {
  const start = Math.floor(baseTime / 60000) * 60000 - 86400000;
  const events = [
    { ts: new Date(start - 10 * 60000).toISOString(), at: start - 10 * 60000, visitor: hashA },
    { ts: new Date(start + 1000).toISOString(), at: start + 1000, visitor: hashA },
    { ts: '2026-11-22T21:00:00Z', at: Date.parse('2026-11-22T21:00:00Z'), visitor: hashA },
    { ts: new Date(baseTime).toISOString(), at: baseTime, visitor: hashA },
    { ts: new Date(baseTime + 1000).toISOString(), at: baseTime + 1000, visitor: hashA },
  ];
  const s = summarizeVisitorEvents(events, baseTime);
  assert.equal(s.today.pageViews, 2);
  assert.equal(s.today.visits, 2);
  assert.equal(s.last24Hours.pageViews, 2);
  assert.equal(s.last24Hours.visits, 1);
  assert.equal(s.total.pageViews, 4);
});

test('identified bots and automation are excluded without treating Yandex Browser as a bot', () => {
  for (const ua of [
    '',
    'curl/8.0',
    'Mozilla/5.0 HeadlessChrome/120',
    'Googlebot',
    'Python-urllib/3.14',
    'Playwright',
    'node-fetch',
  ])
    assert.equal(isLikelyBot(ua), true, ua);
  assert.equal(isLikelyBot('Mozilla/5.0 Chrome/131.0 YaBrowser/24.0 Safari/537.36'), false);
  assert.equal(normalizeTrackingPath('/?q=a&token=private'), '/');
  assert.equal(
    normalizeTrackingPath('/instrukcii-po-ohrane-truda?page=2&q=abc'),
    '/instrukcii-po-ohrane-truda?page=2',
  );
  for (const value of [
    '//foreign.invalid',
    '/api/health',
    '/account/',
    '/thanks/',
    '/foo/../api/test',
    '/%00bad',
    'https://boykovdocs.ru/',
  ])
    assert.equal(normalizeTrackingPath(value), null);
});

test('HTTP collector rejects unverified legacy posts, cross-site requests, hidden events, bots and admin visits', async t => {
  const recorded = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.get('x-test-admin')) req.user = { role: 'admin' };
    next();
  });
  app.use(
    '/stats',
    createVisitorStatsRouter({
      tokens: createVisitorTokens({ secret: () => 'test-tracking-secret-'.repeat(3) }),
      record: row => recorded.push(row),
      getStats: () => ({}),
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 Chrome/131.0',
    Origin: origin,
    'Sec-Fetch-Site': 'same-origin',
  };
  const post = (route, body, extra = {}) =>
    fetch(origin + '/stats/' + route, {
      method: 'POST',
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  assert.equal((await post('visit', { visitorId: 'random-id-abcdefghijkl' })).status, 204);
  const ready = await post('session', { visitorId: 'browser-id-abcdefghijkl' });
  assert.equal(ready.status, 200);
  assert.match(ready.headers.get('set-cookie'), /HttpOnly/);
  const { receipt } = await ready.json();
  const body = {
    schema: 2,
    eventId: 'event-id-abcdefghijkl',
    receipt,
    path: '/',
    visible: true,
    automated: false,
  };
  for (const extra of [
    { Origin: 'https://foreign.invalid' },
    { 'Sec-Fetch-Site': 'cross-site' },
    { 'User-Agent': 'curl/8.0' },
    { 'x-test-admin': '1' },
  ])
    await post('visit', body, extra);
  await post('visit', { ...body, visible: false });
  await post('visit', { ...body, automated: true });
  await post('visit', { ...body, receipt: 'forged' });
  await post('visit', { ...body, path: '/api/health' });
  assert.equal(recorded.length, 0);
  await post('visit', body);
  assert.deepEqual(recorded, [{ visitorHash: hashA, eventId: body.eventId }]);
  assert.equal((await fetch(origin + '/stats/admin')).status, 401);
});

function browserFixture() {
  const requests = [],
    saved = new Map(),
    document = new EventTarget();
  let n = 0;
  document.visibilityState = 'visible';
  const browser = {
    document,
    location: { href: 'https://boykovdocs.ru/' },
    navigator: { webdriver: false },
    AbortController,
    crypto: { randomUUID: () => `fixture_uuid_${String(++n).padStart(16, '0')}` },
    localStorage: {
      getItem: key => saved.get(key),
      setItem: (key, value) => saved.set(key, value),
    },
    sessionStorage: { getItem: () => null },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return url.endsWith('/session')
        ? Response.json({ receipt: 'receipt-fixture', expiresAt: baseTime + 900000 })
        : new Response(null, { status: 204 });
    },
  };
  browser.top = browser;
  browser.self = browser;
  return { browser, requests };
}

test('typing a search, filters and URL hashes do not become page views; real navigation and pagination do', async () => {
  const { browser, requests } = browserFixture();
  const tracker = createVisitorTracker(browser, { now: () => baseTime });
  assert.equal(await tracker.track(), true);
  for (const query of ['?q=a', '?q=ab', '?q=abc', '?category=office', '#section']) {
    browser.location.href = 'https://boykovdocs.ru/' + query;
    assert.equal(await tracker.track(), false);
  }
  browser.location.href = 'https://boykovdocs.ru/instrukcii-po-ohrane-truda';
  await tracker.track();
  browser.location.href += '?page=2';
  await tracker.track();
  browser.location.href = 'https://boykovdocs.ru/';
  await tracker.track();
  assert.equal(requests.filter(r => r.url.endsWith('/visit')).length, 4);
  assert.equal(requests.filter(r => r.url.endsWith('/session')).length, 1);
  assert.ok(requests.every(r => !JSON.stringify(r).includes('q=abc')));
  assert.equal(trackingPageKey({ href: 'https://boykovdocs.ru/account/' }), null);
  tracker.dispose();
});

test('headless, admin and hidden documents do not send events; becoming visible sends once', async () => {
  const { browser, requests } = browserFixture();
  const tracker = createVisitorTracker(browser, { now: () => baseTime });
  browser.navigator.webdriver = true;
  await tracker.track();
  browser.navigator.webdriver = false;
  browser.document.visibilityState = 'hidden';
  await tracker.track();
  assert.equal(requests.length, 0);
  browser.document.visibilityState = 'visible';
  browser.document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.filter(r => r.url.endsWith('/visit')).length, 1);
  await tracker.track();
  assert.equal(requests.length, 2);
  tracker.dispose();
});

test('ambiguous network retries reuse an event ID and separate document reloads create new IDs', async () => {
  const { browser, requests } = browserFixture();
  const original = browser.fetch;
  let drop = true;
  browser.fetch = async (url, options) => {
    const response = await original(url, options);
    if (url.endsWith('/visit') && drop) {
      drop = false;
      throw Error('Response lost after server saved event');
    }
    return response;
  };
  const tracker = createVisitorTracker(browser, { now: () => baseTime });
  assert.equal(await tracker.track(), true);
  const visits = requests.filter(r => r.url.endsWith('/visit'));
  assert.equal(visits.length, 2);
  assert.equal(visits[0].body.eventId, visits[1].body.eventId);
  tracker.dispose();
  const next = createVisitorTracker(browser, { now: () => baseTime });
  await next.track();
  assert.notEqual(requests.at(-1).body.eventId, visits[0].body.eventId);
  next.dispose();
});

test('duplicate persisted v2 event IDs and malformed records do not inflate reports', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-visitor-reader-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'events.jsonl');
  const event = {
    schema: 2,
    ts: new Date(baseTime).toISOString(),
    visitor: hashA,
    eventId: 'a'.repeat(64),
  };
  fs.writeFileSync(
    file,
    JSON.stringify(event) + '\n' + JSON.stringify(event) + '\n' + '{broken}\n',
  );
  assert.equal(readVisitorEvents(file).length, 1);
});

test('a page hidden while its receipt loads is counted when it becomes visible later', async () => {
  const { browser, requests } = browserFixture();
  const original = browser.fetch;
  let finish;
  browser.fetch = async (url, options) => {
    if (url.endsWith('/session'))
      await new Promise(resolve => {
        finish = resolve;
      });
    return original(url, options);
  };
  const tracker = createVisitorTracker(browser, { now: () => baseTime });
  const pending = tracker.track();
  browser.document.visibilityState = 'hidden';
  finish();
  assert.equal(await pending, false);
  assert.equal(requests.filter(r => r.url.endsWith('/visit')).length, 0);
  browser.document.visibilityState = 'visible';
  browser.document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.filter(r => r.url.endsWith('/visit')).length, 1);
  tracker.dispose();
});

test('unreadable replay history disables collection instead of preventing application startup', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-unreadable-history-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let service;
  assert.doesNotThrow(() => {
    service = createVisitorStatsService({ file: dir });
  });
  assert.equal(service.record({ visitorHash: hashA, eventId: 'event-id-abcdefghijkl' }), false);
  assert.throws(() => service.getStats());
  assert.deepEqual(fs.readdirSync(dir), []);
});
