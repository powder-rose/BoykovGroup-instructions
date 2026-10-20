import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { quotaScheduleCopy } from '../../client/public/assets/wallet-quota-view.js';

test('account quota displays time in Moscow and explains the sliding monthly period', () => {
  assert.deepEqual(
    quotaScheduleCopy({
      limit: 5,
      used: 0,
      remaining: 5,
      lastFreeDownloadAt: null,
      nextResetAt: null,
    }),
    {
      title: 'Доступно 5 из 5',
      description: 'Месячный срок начнётся после первого бесплатного скачивания.',
    },
  );
  const remaining = quotaScheduleCopy({
    limit: 5,
    used: 2,
    remaining: 3,
    nextResetAt: '2026-11-20T12:00:00.000Z',
  });
  assert.equal(remaining.title, 'Осталось 3 из 5');
  assert.match(remaining.description, /20 ноября 2026/u);
  assert.match(remaining.description, /15:00 \(МСК\)/u);
  assert.match(remaining.description, /дата сдвигается на месяц/u);
  const exhausted = quotaScheduleCopy({
    limit: 5,
    used: 5,
    remaining: 0,
    nextResetAt: '2026-11-20T12:00:00.000Z',
  });
  assert.match(exhausted.description, /Новые 5 бесплатных скачиваний/u);
  assert.match(exhausted.description, /покупать с баланса/u);
});

test('account quota rejects inconsistent balance and invalid reset dates', () => {
  for (const value of [
    null,
    {},
    { limit: 5, used: 2, remaining: 5, nextResetAt: '2026-11-20T12:00:00.000Z' },
    { limit: 5, used: 0, remaining: 5, nextResetAt: '2026-11-20T12:00:00.000Z' },
    { limit: 5, used: 3, remaining: 2, nextResetAt: null },
    { limit: 5, used: 5, remaining: 0, nextResetAt: 'broken' },
    { limit: '5', used: 1, remaining: 4, nextResetAt: '2026-11-20T12:00:00.000Z' },
  ])
    assert.equal(quotaScheduleCopy(value), null);
});

test('account preserves existing wallet top-up and purchase UI', () => {
  const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const account = read('../../client/public/assets/wallet-account.js');
  const navigation = read('../../public_html/account/index.html');
  const endpoint = read('../src/routes/instructionPdf.js');
  assert.match(account, /walletPaymentUrl\(\)/u);
  assert.match(account, /Пополнить баланс/u);
  assert.match(account, /download-quota\?schedule=1/u);
  assert.match(account, /quotaScheduleCopy/u);
  assert.match(navigation, /wallet-quota-view\.css/u);
  assert.match(endpoint, /req\.query\.schedule === '1'/u);
});
