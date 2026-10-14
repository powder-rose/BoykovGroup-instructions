import assert from 'node:assert/strict';
import test from 'node:test';

import {
  moderateProfessionRequest,
  MODERATION_REASON,
} from '../src/services/contentModerationService.js';

test('profession moderation rejects unsupported control characters', () => {
  const codes = [
    ...Array.from({ length: 9 }, (_, index) => index),
    ...Array.from({ length: 18 }, (_, index) => index + 14),
    127,
  ];

  for (const code of codes) {
    const result = moderateProfessionRequest(`Электро${String.fromCharCode(code)}монтер`);

    assert.equal(result.allowed, false, `Control character ${code}`);
    assert.equal(result.reasonCode, MODERATION_REASON.INVALID_FORMAT);
  }
});

test('profession moderation normalizes whitespace before checking control characters', () => {
  for (const separator of ['\t', '\n', '\v', '\f', '\r', ' ']) {
    const result = moderateProfessionRequest(`Старший${separator}электромонтер`);

    assert.equal(result.allowed, true);
    assert.equal(result.normalized, 'Старший электромонтер');
  }
});
