import assert from 'node:assert/strict';
import test from 'node:test';
import {
  purchaseCatalogInstruction,
  WALLET_UPDATED_EVENT,
  notifyWalletUpdated,
} from '../../client/public/assets/wallet-client.js';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('funded catalog purchase uses wallet balance and purchase API without payment checkout', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return jsonResponse({ balanceMinor: 15000, priceMinor: 5000 });
    return jsonResponse({
      purchaseId: 'wp_bought',
      wallet: { balanceMinor: 10000, priceMinor: 5000 },
    });
  };
  try {
    const result = await purchaseCatalogInstruction('token', 'instruction-1');
    assert.deepEqual(result, {
      kind: 'purchased',
      purchaseId: 'wp_bought',
      wallet: { balanceMinor: 10000, priceMinor: 5000 },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, '/api/account/wallet');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[1].url, '/api/account/wallet/purchases');
    assert.equal(calls[1].options.method, 'POST');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer token');
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      instructionId: 'instruction-1',
      priceMinor: 5000,
    });
  } finally {
    globalThis.fetch = previous;
  }
});

test('insufficient funds never trigger purchase or payment on behalf of user', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    return jsonResponse({ balanceMinor: 4999, priceMinor: 5000 });
  };
  try {
    assert.deepEqual(await purchaseCatalogInstruction('token', 'instruction-2'), {
      kind: 'topup',
      wallet: { balanceMinor: 4999, priceMinor: 5000 },
    });
    assert.deepEqual(calls, ['/api/account/wallet']);
  } finally {
    globalThis.fetch = previous;
  }
});

test('purchase race with changed server balance returns insufficient funds for top-up', async () => {
  const previous = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => {
    count += 1;
    if (count === 1) return jsonResponse({ balanceMinor: 5000, priceMinor: 5000 });
    return jsonResponse({ code: 'INSUFFICIENT_BALANCE', error: 'Недостаточно средств.' }, 409);
  };
  try {
    await assert.rejects(purchaseCatalogInstruction('token', 'instruction-3'), {
      code: 'INSUFFICIENT_BALANCE',
      status: 409,
    });
    assert.equal(count, 2);
  } finally {
    globalThis.fetch = previous;
  }
});

test('wallet event broadcasts only balance and price, without purchase history', () => {
  const previous = globalThis.window;
  let detail = null;
  globalThis.window = {
    dispatchEvent(event) {
      assert.equal(event.type, WALLET_UPDATED_EVENT);
      detail = event.detail;
    },
  };
  try {
    notifyWalletUpdated({
      balanceMinor: 8000,
      priceMinor: 5000,
      purchases: [{ title: 'private instruction' }],
    });
    assert.deepEqual(detail, { balanceMinor: 8000, priceMinor: 5000 });
  } finally {
    globalThis.window = previous;
  }
});

test('invalid wallet response cannot charge money', async () => {
  const previous = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => {
    count += 1;
    return jsonResponse({ balanceMinor: 10000, priceMinor: '5000' });
  };
  try {
    await assert.rejects(purchaseCatalogInstruction('token', 'instruction-4'), /стоимость/);
    assert.equal(count, 1);
    assert.equal(WALLET_UPDATED_EVENT, 'boykovdocs:wallet-updated');
  } finally {
    globalThis.fetch = previous;
  }
});
