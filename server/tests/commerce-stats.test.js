import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createCommerceStatsRouter } from '../src/routes/commerceStats.js';
import { summarizeCommerceStats } from '../src/services/commerceStatsService.js';
import { createWalletRepository } from '../src/services/walletRepository.js';
import { createWalletRouter } from '../src/routes/wallet.js';

const now = new Date('2026-10-16T12:00:00.000Z');
const purchase = (instructionId, createdAt, id) => ({
  id,
  instructionId,
  title: `Документ ${instructionId}`,
  amountMinor: 5000,
  createdAt,
});
const download = (instructionId, ts, downloader, kind) => ({
  instructionId,
  title: `Документ ${instructionId}`,
  ts,
  downloader,
  ...(kind ? { kind } : {}),
});
const getInstruction = id =>
  id === 'a' ? { id, slug: 'instruction-a', title: 'Актуальная инструкция A' } : null;

test('purchases count actual catalog orders, not wallet top-ups; rank by instruction', () => {
  const result = summarizeCommerceStats({
    period: 'total',
    purchaseEvents: [
      purchase('a', '2026-10-16T08:00:00Z', 'first'),
      purchase('a', '2026-10-15T23:59:00Z', 'second'),
      purchase('b', '2026-09-15T08:00:00Z', 'third'),
      purchase('b', '2026-10-17T08:00:00Z', 'future'),
    ],
    now,
    getInstruction,
  });
  assert.equal(result.purchases.count, 3);
  assert.equal(result.purchases.amountMinor, 15000);
  assert.equal(result.purchases.averageMinor, 5000);
  assert.equal(result.purchases.uniqueInstructions, 2);
  assert.deepEqual(
    result.purchases.items.map(item => [item.id, item.count, item.amountMinor]),
    [
      ['a', 2, 10000],
      ['b', 1, 5000],
    ],
  );
  assert.equal(result.purchases.items[0].slug, 'instruction-a');
  assert.equal(result.purchases.items[1].slug, null);
  assert.equal(result.purchases.items[0].title, 'Актуальная инструкция A');
});

test('download analytics include legacy free events and new paid PDF deliveries', () => {
  const result = summarizeCommerceStats({
    period: 'total',
    downloadEvents: [
      download('a', '2026-10-16T08:00:00Z', 'hash-1'),
      download('a', '2026-10-16T09:00:00Z', 'hash-1', 'paid'),
      download('a', '2026-10-16T10:00:00Z', 'hash-2', 'paid'),
      download('b', '2026-10-15T08:00:00Z', 'hash-3'),
      download('b', '2026-10-17T08:00:00Z', 'hash-4', 'paid'),
    ],
    now,
  });
  assert.deepEqual(
    [result.downloads.count, result.downloads.free, result.downloads.paid],
    [4, 2, 2],
  );
  assert.equal(result.downloads.uniqueDownloaders, 3);
  assert.equal(result.downloads.trackingStarted, '2026-10-15T08:00:00Z');
  assert.equal(result.downloads.items[0].count, 3);
  assert.equal(result.downloads.items[0].uniqueDownloaders, 2);
  assert.equal(result.downloads.items[0].paid, 2);
  assert.ok(!JSON.stringify(result).includes('hash-1'));
});

test('time filters use Moscow day boundaries and do not include future events', () => {
  const events = [
    download('a', '2026-10-15T20:59:59Z', 'yesterday'),
    download('b', '2026-10-15T21:00:00Z', 'today'),
    download('b', '2026-10-16T11:00:00Z', 'today'),
    download('c', '2026-10-16T13:00:00Z', 'future'),
  ];
  const today = summarizeCommerceStats({ now, period: 'today', downloadEvents: events });
  const week = summarizeCommerceStats({ now, period: '7d', downloadEvents: events });
  assert.equal(today.downloads.count, 2);
  assert.equal(week.downloads.count, 3);
  assert.equal(today.downloads.items[0].id, 'b');
});

test('invalid rows and empty datasets never invent purchases or downloads', () => {
  const result = summarizeCommerceStats({
    period: 'unexpected',
    purchaseEvents: [
      { instructionId: 'a', createdAt: 'invalid', amountMinor: 5000 },
      { instructionId: 'a', createdAt: '2026-10-16T08:00:00Z', amountMinor: '5000' },
    ],
    downloadEvents: [{ ts: 'invalid', instructionId: 'a', downloader: 'hash-1' }],
    now,
  });
  assert.equal(result.period, 'total');
  assert.equal(result.purchases.count, 0);
  assert.equal(result.downloads.count, 0);
  assert.deepEqual(result.downloads.items, []);
  assert.equal(result.downloads.trackingStarted, null);
});

test('admin purchase projection preserves formats without personal data or document snapshots', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-commerce-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createWalletRepository({ file: path.join(dir, 'wallets.json') });
  const topup = store.createTopup({
    userId: 'private-user-id',
    amountMinor: 10000,
    requestId: 'commerce-request-12345',
    publicId: 'pk_test',
    consent: { offerAccepted: true, personalDataConsentAccepted: true },
  });
  store.credit({ orderId: topup.id, transactionId: 'payment-1' });
  store.purchase({
    userId: 'private-user-id',
    instructionId: 'a',
    instruction: { id: 'a', title: 'Инструкция A', secret: 'PDF snapshot' },
  });
  store.purchase({
    userId: 'private-user-id',
    instructionId: 'a',
    instruction: { id: 'a', title: 'Инструкция A', secret: 'Word snapshot' },
    format: 'docx',
  });
  store.purchase({
    userId: 'private-user-id',
    instructionId: 'a',
    instruction: { id: 'a', title: 'Инструкция A' },
    format: 'docx',
  });
  const list = store.listAdminPurchases();
  assert.equal(list.length, 2);
  assert.deepEqual(Object.keys(list[0]).sort(), [
    'amountMinor',
    'createdAt',
    'format',
    'id',
    'instructionId',
    'title',
  ]);
  assert.ok(!JSON.stringify(list).includes('private-user-id'));
  assert.ok(!JSON.stringify(list).includes('PDF snapshot'));
  assert.ok(!JSON.stringify(list).includes('Word snapshot'));
  assert.deepEqual(
    list.map(row => row.format),
    ['pdf', 'docx'],
  );
  const result = summarizeCommerceStats({ purchaseEvents: list });
  assert.equal(result.purchases.count, 2);
  assert.equal(result.purchases.amountMinor, 10000);
  assert.equal(result.purchases.uniqueInstructions, 1);
  assert.deepEqual(result.purchases.byFormat, {
    pdf: { count: 1, amountMinor: 5000 },
    docx: { count: 1, amountMinor: 5000 },
  });

  const file = path.join(dir, 'wallets.json');
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete state.purchases[0].format;
  fs.writeFileSync(file, JSON.stringify(state));
  const before = fs.readFileSync(file, 'utf8');
  assert.deepEqual(
    store.listAdminPurchases().map(row => row.format),
    ['pdf', 'docx'],
  );
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('commerce stats endpoint is admin-only and rejects cache storage', async t => {
  const app = express();
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    req.user = role ? { role } : null;
    next();
  });
  app.use(
    '/commerce',
    createCommerceStatsRouter({
      getStats: ({ period, purchaseFormat }) => ({
        period,
        purchaseFormat,
        purchases: { count: 2 },
        downloads: { count: 3 },
      }),
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/commerce?period=30d&format=docx`;
  for (const role of [null, 'user']) {
    const response = await fetch(url, { headers: role ? { 'x-test-role': role } : {} });
    assert.equal(response.status, 401);
  }
  const response = await fetch(url, { headers: { 'x-test-role': 'admin' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
  assert.deepEqual(await response.json(), {
    period: '30d',
    purchaseFormat: 'docx',
    purchases: { count: 2 },
    downloads: { count: 3 },
  });
});

test('purchase totals and ranking split Word and legacy PDF without double counting instructions', () => {
  const events = [
    purchase('a', '2026-10-16T08:00:00Z', 'legacy'),
    { ...purchase('a', '2026-10-16T09:00:00Z', 'word-a'), format: 'docx' },
    { ...purchase('b', '2026-10-16T10:00:00Z', 'word-b'), format: 'docx', amountMinor: 6000 },
    { ...purchase('b', '2026-10-16T11:00:00Z', 'pdf-b'), format: 'pdf' },
  ];
  const report = summarizeCommerceStats({ now, purchaseEvents: events });
  assert.equal(report.purchaseFormat, 'all');
  assert.equal(report.purchases.count, 4);
  assert.equal(report.purchases.amountMinor, 21000);
  assert.equal(report.purchases.averageMinor, 5250);
  assert.equal(report.purchases.uniqueInstructions, 2);
  assert.deepEqual(report.purchases.byFormat, {
    pdf: { count: 2, amountMinor: 10000 },
    docx: { count: 2, amountMinor: 11000 },
  });
  assert.deepEqual(report.purchases.items.find(item => item.id === 'a').byFormat, {
    pdf: { count: 1, amountMinor: 5000 },
    docx: { count: 1, amountMinor: 5000 },
  });
  const serialized = JSON.stringify(report);
  for (const event of events) assert.ok(!serialized.includes(`"${event.id}"`));
});

test('purchase format and Moscow date filters apply before totals and ranking, leaving downloads unchanged', () => {
  const options = {
    now,
    period: 'today',
    purchaseEvents: [
      { ...purchase('a', '2026-10-15T20:59:59Z', 'yesterday'), format: 'docx' },
      { ...purchase('b', '2026-10-15T21:00:00Z', 'today-word'), format: 'docx' },
      purchase('c', '2026-10-16T08:00:00Z', 'today-pdf'),
      { ...purchase('a', '2026-10-16T13:00:00Z', 'future'), format: 'docx' },
    ],
    downloadEvents: [download('c', '2026-10-16T08:00:00Z', 'hash', 'paid')],
  };
  const word = summarizeCommerceStats({ ...options, purchaseFormat: 'docx' });
  const pdf = summarizeCommerceStats({ ...options, purchaseFormat: 'pdf' });
  assert.equal(word.purchaseFormat, 'docx');
  assert.equal(word.purchases.count, 1);
  assert.equal(word.purchases.amountMinor, 5000);
  assert.equal(word.purchases.uniqueInstructions, 1);
  assert.equal(word.purchases.items[0].id, 'b');
  assert.equal(word.purchases.byFormat.pdf.count, 0);
  assert.equal(pdf.purchases.count, 1);
  assert.equal(pdf.purchases.items[0].id, 'c');
  assert.deepEqual(word.downloads, pdf.downloads);
  assert.equal(word.downloads.count, 1);
});

test('Word ranking uses all matching purchases before selecting ten instructions', () => {
  const purchaseEvents = Array.from({ length: 12 }, (_, index) => ({
    ...purchase(`pdf-${index}`, '2026-10-16T08:00:00Z', `pdf-order-${index}`),
    format: 'pdf',
  }));
  purchaseEvents.push({
    ...purchase('word-only', '2026-10-16T08:00:00Z', 'word-order'),
    format: 'docx',
  });
  const result = summarizeCommerceStats({ now, purchaseEvents, purchaseFormat: 'docx' });
  assert.equal(result.purchases.count, 1);
  assert.deepEqual(
    result.purchases.items.map(item => [item.rank, item.id]),
    [[1, 'word-only']],
  );
});

test('unknown formats are excluded and invalid filters fall back to all formats', () => {
  const purchaseEvents = [
    purchase('a', '2026-10-16T08:00:00Z', 'legacy'),
    { ...purchase('a', '2026-10-16T08:00:00Z', 'word'), format: 'docx' },
    { ...purchase('a', '2026-10-16T08:00:00Z', 'unknown'), format: 'html' },
    { ...purchase('a', '2026-10-16T08:00:00Z', 'null-format'), format: null },
  ];
  const result = summarizeCommerceStats({ now, purchaseEvents, purchaseFormat: 'html' });
  assert.equal(result.purchaseFormat, 'all');
  assert.equal(result.purchases.count, 2);
  assert.equal(result.purchases.amountMinor, 10000);
  const empty = summarizeCommerceStats({ now, purchaseFormat: 'docx' });
  assert.equal(empty.purchases.averageMinor, 0);
  assert.equal(empty.purchases.uniqueInstructions, 0);
  assert.deepEqual(empty.purchases.byFormat, {
    pdf: { count: 0, amountMinor: 0 },
    docx: { count: 0, amountMinor: 0 },
  });
});

test('paid PDF delivery records a download; HEAD and denied requests do not', async t => {
  const events = [];
  const app = express();
  app.use((_req, _res, next) => {
    _req.user = { role: 'user', sub: 'test-user' };
    next();
  });
  app.use(
    '/wallet',
    createWalletRouter({
      userLookup: id => ({ id, role: 'user' }),
      store: {
        getPurchase: (_id, purchaseId) =>
          purchaseId === 'known'
            ? {
                id: 'known',
                instructionId: 'a',
                title: 'Инструкция A',
                instruction: { id: 'a', title: 'Инструкция A' },
              }
            : null,
      },
      generatePdf: async () => Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(1100)]),
      profileLookup: () => null,
      recordDownload: data => events.push(data),
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/wallet/purchases/known/pdf`;
  const unknown = await fetch(url.replace('/known/', '/missing/'));
  assert.equal(unknown.status, 404);
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(events.length, 0);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.ok((await response.arrayBuffer()).byteLength >= 1000);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, [
    { instructionId: 'a', title: 'Инструкция A', userId: 'test-user', kind: 'paid' },
  ]);
});
