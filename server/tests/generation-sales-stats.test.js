import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { summarizeCommerceStats } from '../src/services/commerceStatsService.js';
import { listPublicGenerationSales } from '../src/services/publicGenerationOrderService.js';

const now = new Date('2026-10-16T12:00:00Z');
const order = (id, overrides = {}) => ({
  id,
  profession: 'Электрик',
  amount: 150,
  currency: 'RUB',
  status: 'generated',
  paidAt: '2026-10-16T08:00:00Z',
  refundedAt: null,
  hasPayment: true,
  paymentMatched: true,
  paymentMode: 'live',
  ...overrides,
});
const report = (generationEvents, options = {}) =>
  summarizeCommerceStats({ generationEvents, now, ...options });

test('generation sales use actual discounted and historical prices and deduplicate orders', () => {
  const entries = [
    order('private-order-old', { amount: 500, paymentMode: 'legacy' }),
    order('private-order-current'),
    order('private-order-discount', { amount: 75.25, originalAmount: 150 }),
  ];
  const result = report([...entries, ...entries]);
  assert.equal(result.generations.count, 3);
  assert.equal(result.generations.amountMinor, 72525);
  assert.equal(result.generations.averageMinor, 24175);
  assert.equal(result.generations.netAmountMinor, 72525);
  assert.equal(result.generations.items[0].count, 3);
  assert.equal(result.sales.count, 3);
  assert.equal(result.sales.amountMinor, 72525);
  for (const entry of entries) assert.ok(!JSON.stringify(result).includes(entry.id));
});

test('unpaid, test, mismatched and malformed generation records never inflate sales', () => {
  const result = report([
    order('pending', { status: 'pending_payment' }),
    order('test-status', { status: 'test_paid' }),
    order('test-generated', { paymentMode: 'test' }),
    order('test-manual-review', { paymentMode: 'test', status: 'manual_review' }),
    order('mismatched', { paymentMatched: false, status: 'manual_review' }),
    order('unknown-mode', { paymentMode: 'unknown' }),
    order('no-transaction', { hasPayment: false }),
    order('no-date', { paidAt: null }),
    order('invalid-date', { paidAt: 'invalid' }),
    order('future', { paidAt: '2026-10-17T00:00:00Z' }),
    order('other-currency', { currency: 'USD' }),
    order('free', { amount: 0 }),
    order('negative', { amount: -150 }),
    order('fractional-kopeck', { amount: 150.001 }),
    order('bad-status', { status: 'failed' }),
    order(''),
    null,
  ]);
  assert.equal(result.generations.count, 0);
  assert.equal(result.generations.amountMinor, 0);
  assert.equal(result.generations.refundedCount, 0);
  assert.deepEqual(result.generations.items, []);
});

test('confirmed refunds are separate from payments; pending refunds retain paid value', () => {
  const returned = order('refunded', {
    amount: 75.25,
    status: 'refunded',
    refundedAt: '2026-10-16T09:00:00Z',
  });
  const result = report([
    returned,
    returned,
    order('awaiting-refund', { status: 'refund_pending' }),
    order('refund-in-progress', { status: 'refunding' }),
  ]);
  assert.equal(result.generations.count, 3);
  assert.equal(result.generations.amountMinor, 37525);
  assert.equal(result.generations.refundedCount, 1);
  assert.equal(result.generations.refundedAmountMinor, 7525);
  assert.equal(result.generations.netAmountMinor, 30000);
});

test('Moscow payment boundaries and actual refund dates allow negative daily net sales', () => {
  const returned = order('older-payment', {
    paidAt: '2026-10-14T08:00:00Z',
    status: 'refunded',
    refundedAt: '2026-10-16T10:00:00Z',
  });
  const emptyDay = report([returned], { period: 'today' }).generations;
  assert.equal(emptyDay.count, 0);
  assert.equal(emptyDay.refundedCount, 1);
  assert.equal(emptyDay.netAmountMinor, -15000);

  const result = report(
    [
      returned,
      order('yesterday', { paidAt: '2026-10-15T20:59:59Z' }),
      order('today', { paidAt: '2026-10-15T21:00:00Z', amount: 75.25 }),
      order('later-refund', { refundedAt: '2026-10-17T10:00:00Z' }),
    ],
    { period: 'today' },
  );
  assert.equal(result.generations.count, 2);
  assert.equal(result.generations.amountMinor, 22525);
  assert.equal(result.generations.refundedAmountMinor, 15000);
  assert.equal(result.generations.netAmountMinor, 7525);
  assert.equal(report([returned], { period: '7d' }).generations.netAmountMinor, 0);
});

test('generation ranking groups professions and never leaks order snapshots or buyer secrets', () => {
  const entries = Array.from({ length: 12 }, (_, index) =>
    order(`private-order-${index}`, { profession: `Профессия ${index}` }),
  );
  entries.push(
    order('private-top', {
      profession: ' Электрик  ',
      accessToken: 'private-access-token',
      ownerEmail: 'private-buyer@example.test',
      generatedInstruction: { content: 'PRIVATE_DOCUMENT' },
      transactionId: 'PRIVATE_TRANSACTION',
    }),
    order('private-top-two', { profession: 'электрик' }),
  );
  const result = report(entries);
  assert.equal(result.generations.uniqueProfessions, 13);
  assert.equal(result.generations.items.length, 10);
  assert.equal(result.generations.items[0].title, 'Электрик');
  assert.equal(result.generations.items[0].count, 2);
  for (const value of [
    'private-access-token',
    'private-buyer@example.test',
    'PRIVATE_DOCUMENT',
    'PRIVATE_TRANSACTION',
    'private-order-',
    'private-top',
  ])
    assert.ok(!JSON.stringify(result).includes(value));
});

test('catalog formats and generation sales stay independent and combine without top-ups', () => {
  const options = {
    purchaseEvents: [
      { instructionId: 'a', amountMinor: 5000, createdAt: '2026-10-16T08:00:00Z', format: 'pdf' },
      { instructionId: 'a', amountMinor: 5000, createdAt: '2026-10-16T08:00:00Z', format: 'docx' },
    ],
  };
  const all = report([order('generation')], options);
  const word = report([order('generation')], { ...options, purchaseFormat: 'docx' });
  assert.deepEqual(all.generations, word.generations);
  assert.equal(all.sales.count, 3);
  assert.equal(all.sales.amountMinor, 25000);
  assert.equal(word.sales.count, 2);
  assert.equal(word.sales.amountMinor, 20000);
  assert.equal(all.purchases.count, 2);
});

function directoryFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-generation-sales-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('sales source projects current persisted orders without contacts, tokens or writes', t => {
  const directory = directoryFixture(t);
  const saved = {
    ...order('pg_generation-sales-0001'),
    transactionId: 'PRIVATE_TRANSACTION',
    fiscalPaymentLive: true,
    accessToken: 'PRIVATE_ACCESS_TOKEN',
    ownerEmail: 'private@example.test',
    generatedInstruction: { secret: 'PRIVATE_DOCUMENT' },
  };
  const filename = path.join(directory, `${saved.id}.json`);
  fs.writeFileSync(filename, JSON.stringify(saved));
  fs.writeFileSync(path.join(directory, 'unrelated.json'), 'not an order');
  fs.writeFileSync(path.join(directory, `${saved.id}.json.tmp`), 'in progress');
  const bytes = fs.readFileSync(filename);
  const rows = listPublicGenerationSales({ directory });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paymentMode, 'live');
  assert.equal(rows[0].paymentMatched, true);
  assert.equal(rows[0].hasPayment, true);
  assert.equal(report(rows).generations.count, 1);
  assert.deepEqual(fs.readFileSync(filename), bytes);
  for (const secret of [
    'PRIVATE_TRANSACTION',
    'PRIVATE_ACCESS_TOKEN',
    'private@example.test',
    'PRIVATE_DOCUMENT',
  ]) {
    assert.ok(!JSON.stringify(rows).includes(secret));
  }

  const legacy = { ...saved, amount: 500 };
  delete legacy.fiscalPaymentLive;
  fs.writeFileSync(filename, JSON.stringify(legacy));
  assert.equal(listPublicGenerationSales({ directory })[0].paymentMode, 'legacy');
  assert.equal(report(listPublicGenerationSales({ directory })).generations.amountMinor, 50000);
  fs.writeFileSync(filename, JSON.stringify({ ...saved, fiscalPaymentLive: 'false' }));
  assert.equal(report(listPublicGenerationSales({ directory })).generations.count, 0);
  fs.writeFileSync(
    filename,
    JSON.stringify({ ...saved, fiscalPaymentLive: false, status: 'manual_review' }),
  );
  assert.equal(report(listPublicGenerationSales({ directory })).generations.count, 0);
  fs.writeFileSync(filename, JSON.stringify({ ...saved, failureCode: 'PAYMENT_MISMATCH' }));
  assert.equal(report(listPublicGenerationSales({ directory })).generations.count, 0);
});

test('unreadable or inconsistent source files fail without publishing partial financial totals', t => {
  const directory = directoryFixture(t);
  const filename = path.join(directory, 'pg_generation-sales-0002.json');
  for (const value of ['PRIVATE_CORRUPT_CONTENT', JSON.stringify({ id: 'another-order' })]) {
    fs.writeFileSync(filename, value);
    assert.throws(
      () => listPublicGenerationSales({ directory }),
      error =>
        error.code === 'GENERATION_SALES_SOURCE_UNAVAILABLE' && !error.message.includes(value),
    );
  }
});
