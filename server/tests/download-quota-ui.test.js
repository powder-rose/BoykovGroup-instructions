import assert from 'node:assert/strict';
import test from 'node:test';

import {
  downloadQuotaFromHeaders,
  formatAvailableInstructions,
  parseDownloadQuota,
} from '../../client/src/lib/downloadQuota.js';

test('available instruction text agrees with Russian numbers, including teens and zero', () => {
  for (const [count, phrase] of [
    [0, 'доступно 0 инструкций'],
    [1, 'доступна 1 инструкция'],
    [2, 'доступны 2 инструкции'],
    [3, 'доступны 3 инструкции'],
    [4, 'доступны 4 инструкции'],
    [5, 'доступно 5 инструкций'],
    [11, 'доступно 11 инструкций'],
    [12, 'доступно 12 инструкций'],
    [14, 'доступно 14 инструкций'],
    [21, 'доступна 21 инструкция'],
    [22, 'доступны 22 инструкции'],
    [25, 'доступно 25 инструкций'],
    [101, 'доступна 101 инструкция'],
    [111, 'доступно 111 инструкций'],
  ]) {
    assert.equal(formatAvailableInstructions(count), `Вам ${phrase} в этом месяце`);
  }
});

test('quota parsing rejects missing or invalid data rather than inventing a balance', () => {
  assert.deepEqual(parseDownloadQuota({ limit: 5, used: 4, remaining: 1 }), {
    limit: 5,
    remaining: 1,
  });
  assert.deepEqual(parseDownloadQuota({ limit: 5, remaining: 0 }), { limit: 5, remaining: 0 });
  for (const invalid of [
    null,
    {},
    { unlimited: true },
    { limit: 5 },
    { limit: 5, remaining: null },
    { limit: 5, remaining: '4' },
    { limit: 5, remaining: -1 },
    { limit: 5, remaining: 6 },
    { limit: 5, remaining: 1.5 },
    { limit: Infinity, remaining: 1 },
    { limit: 0, remaining: 0 },
  ])
    assert.equal(parseDownloadQuota(invalid), null);
});

test('PDF quota headers distinguish a real zero from absent or malformed headers', () => {
  assert.deepEqual(
    downloadQuotaFromHeaders(
      new Headers({
        'X-Download-Limit': '5',
        'X-Download-Remaining': '0',
      }),
    ),
    { limit: 5, remaining: 0 },
  );
  for (const fields of [
    {},
    { 'X-Download-Limit': '5' },
    { 'X-Download-Limit': '5', 'X-Download-Remaining': '' },
    { 'X-Download-Limit': '5', 'X-Download-Remaining': '6' },
    { 'X-Download-Limit': '5', 'X-Download-Remaining': '-1' },
    { 'X-Download-Limit': '5', 'X-Download-Remaining': '1.5' },
  ])
    assert.equal(downloadQuotaFromHeaders(new Headers(fields)), null);
});
