import assert from 'node:assert/strict';
import test from 'node:test';
import { assessCloudPaymentsNotification } from '../src/utils/cloudPaymentsNotificationSettings.js';

const address = 'https://boykovdocs.ru/api/public-generation/cloudpayments/pay';
const configured = {
  IsEnabled: true,
  Address: address,
  HttpMethod: 'POST',
  Encoding: 'UTF8',
  Format: 'CloudPayments',
};

test('shared terminal accepts a disabled Check for Pay-only processing', () => {
  assert.deepEqual(assessCloudPaymentsNotification('check', { IsEnabled: false }, address), {
    valid: true,
    checkDisabled: true,
  });
});

test('Pay and Refund must be enabled, never silently skipped', () => {
  for (const type of ['pay', 'refund']) {
    assert.deepEqual(assessCloudPaymentsNotification(type, { IsEnabled: false }, address), {
      valid: false,
      checkDisabled: false,
    });
  }
});

test('all enabled callbacks must match URL, POST, UTF8 and CloudPayments format', () => {
  for (const type of ['check', 'pay', 'refund']) {
    assert.deepEqual(assessCloudPaymentsNotification(type, configured, address), {
      valid: true,
      checkDisabled: false,
    });
    for (const change of [
      { Address: 'https://example.com/other' },
      { HttpMethod: 'GET' },
      { Encoding: 'Windows1251' },
      { Format: 'QIWI' },
    ]) {
      assert.equal(
        assessCloudPaymentsNotification(type, { ...configured, ...change }, address).valid,
        false,
      );
    }
  }
});

test('missing merchant configuration is always rejected', () => {
  for (const type of ['check', 'pay', 'refund']) {
    assert.equal(assessCloudPaymentsNotification(type, null, address).valid, false);
  }
});
