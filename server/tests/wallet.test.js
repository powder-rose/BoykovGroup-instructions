import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import express from 'express';
import { createWalletRepository } from '../src/services/walletRepository.js';
import { createWalletPaymentService } from '../src/services/walletPaymentService.js';
import { rublesToMinor } from '../src/services/walletMoney.js';
import { createWalletRouter } from '../src/routes/wallet.js';
import { createWalletWebhookRouter } from '../src/routes/walletWebhook.js';
import { createInstructionPdfBuffer } from '../src/services/instructionPdfService.js';
import { toPublicInstruction } from '../src/services/instructionPublicView.js';

const instruction = {
  id: 'catalog-document',
  title: 'Инструкция для специалиста',
  intro: 'Проверить рабочее место.',
  sections: [
    { number: 1, heading: 'Общие требования', paragraphs: ['Применять средства защиты.'] },
  ],
  editorialMeta: { author: 'PRIVATE_AUTHOR' },
};
const user = {
  id: 'alice',
  name: 'Алиса',
  email: 'alice@example.test',
  phone: '+79991112233',
  role: 'user',
  emailVerified: false,
};

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-wallet-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'wallets.json');
  const store = createWalletRepository({ file });
  const order = (overrides = {}) =>
    store.createTopup({
      userId: user.id,
      amountMinor: 5000,
      requestId: randomUUID(),
      publicId: 'pk_terminal',
      consent: { offerAccepted: true, personalDataConsentAccepted: true },
      ...overrides,
    });
  const payment = (order, overrides = {}) => ({
    InvoiceId: order.id,
    AccountId: order.userId,
    Amount: order.amountMinor / 100,
    Currency: 'RUB',
    OperationType: 'Payment',
    Status: 'Completed',
    TestMode: false,
    TransactionId: 1234,
    Type: 0,
    PublicId: 'pk_terminal',
    Refunded: false,
    ...overrides,
  });
  return { file, root, store, order, payment };
}

test('wallet money accepts exact kopecks and rejects malformed, rounded and unbounded top-ups', t => {
  assert.equal(rublesToMinor('50.10'), 5010);
  for (const value of ['50.001', '5e1', '-50', '', null, {}, Infinity, ' 50'])
    assert.equal(rublesToMinor(value), null);
  const { order } = fixture(t);
  for (const amountMinor of [0, -5000, 4999, 5000.1, 5001, 1_000_001, '5000'])
    assert.throws(() => order({ amountMinor }), { code: 'INVALID_TOPUP_AMOUNT' });
});

test('credit, purchase and refund survive restart and are each idempotent', t => {
  const { file, store, order, payment } = fixture(t);
  const topup = order({ amountMinor: 15000 });
  const payments = createWalletPaymentService({ store });
  payments.pay(payment(topup));
  payments.pay(payment(topup));
  const first = store.purchase({
    userId: user.id,
    instructionId: instruction.id,
    instruction: toPublicInstruction(instruction),
  });
  assert.equal(
    store.purchase({ userId: user.id, instructionId: instruction.id, instruction }).id,
    first.id,
  );
  const refund = {
    InvoiceId: topup.id,
    AccountId: user.id,
    TransactionId: 2345,
    PaymentTransactionId: 1234,
    OperationType: 'Refund',
    Amount: '50.00',
  };
  payments.refund(refund);
  payments.refund(refund);
  const reopened = createWalletRepository({ file });
  assert.equal(reopened.getView(user.id).balanceMinor, 5000);
  assert.equal(reopened.getView(user.id).history.length, 3);
  assert.equal(reopened.getPurchase(user.id, first.id).instruction.editorialMeta, undefined);
  assert.equal(reopened.getView('bob').balanceMinor, 0);
  assert.equal(reopened.getPurchase('bob', first.id), null);
});

test('top-up requests are bound to owner and exact amount', t => {
  const { order } = fixture(t);
  const requestId = randomUUID();
  const first = order({ requestId });
  assert.equal(order({ requestId }).id, first.id);
  assert.throws(() => order({ requestId, amountMinor: 10000 }), { code: 'REQUEST_CONFLICT' });
  assert.notEqual(order({ requestId, userId: 'bob' }).id, first.id);
});

test('mismatched, incomplete and test notifications cannot create spendable money', t => {
  const { store, order, payment } = fixture(t);
  const topup = order();
  const service = createWalletPaymentService({ store });
  for (const overrides of [
    { Amount: 500 },
    { Amount: 50.001 },
    { Currency: 'USD' },
    { AccountId: 'bob' },
    { InvoiceId: 'wt_missing' },
    { Status: 'Authorized' },
    { Status: undefined },
    { OperationType: 'Refund' },
    { OperationType: undefined },
    { TransactionId: 'abc' },
  ]) {
    assert.throws(() => service.pay(payment(topup, overrides)));
    assert.equal(store.getView(user.id).balanceMinor, 0);
  }
  for (const TestMode of [true, 1, '1', 'true', undefined, 'unknown'])
    service.pay(payment(topup, { TestMode }));
  assert.equal(store.getView(user.id).balanceMinor, 0);
  assert.equal(service.check(payment(topup)), 0);
  assert.equal(service.check(payment(topup, { Amount: 10 })), 13);
  service.pay(payment(topup));
  assert.equal(service.check(payment(topup)), 13);
});

test('confirmation uses provider API and races safely with a signed notification', async t => {
  const { store, order, payment } = fixture(t);
  const topup = order();
  const model = payment(topup);
  const service = createWalletPaymentService({
    store,
    lookup: async () => {
      service.pay(model);
      return model;
    },
    find: async () => model,
  });
  await service.confirm(user.id, topup.id, '1234');
  await service.confirm(user.id, topup.id);
  assert.equal(store.getView(user.id).balanceMinor, 5000);
  assert.equal(store.getView(user.id).history.length, 1);
  await assert.rejects(service.confirm('bob', topup.id), { code: 'TOPUP_NOT_FOUND' });
});

test('server reconciliation checks terminal, operation, status, owner, price and refund', async t => {
  const { store, order, payment } = fixture(t);
  const topup = order();
  for (const overrides of [
    { PublicId: 'pk_other' },
    { Type: 1 },
    { TestMode: true },
    { AccountId: 'bob' },
    { Amount: 100 },
    { Refunded: true },
  ]) {
    const service = createWalletPaymentService({
      store,
      find: async () => payment(topup, overrides),
    });
    await assert.rejects(service.confirm(user.id, topup.id));
  }
  for (const Status of ['Authorized', 'Declined', 'Cancelled']) {
    const service = createWalletPaymentService({
      store,
      find: async () => payment(topup, { Status }),
    });
    assert.notEqual((await service.confirm(user.id, topup.id)).status, 'paid');
  }
  assert.equal(store.getView(user.id).balanceMinor, 0);
});

test('real second payment is credited once, even if both succeeded for the same invoice', t => {
  const { store, order, payment } = fixture(t);
  const topup = order();
  const service = createWalletPaymentService({ store });
  service.pay(payment(topup));
  service.pay(payment(topup, { TransactionId: 1235 }));
  service.pay(payment(topup, { TransactionId: 1235 }));
  assert.equal(store.getView(user.id).balanceMinor, 10000);
  const other = order({ userId: 'bob' });
  assert.throws(() => service.pay(payment(other)));
  assert.equal(store.getView('bob').balanceMinor, 0);
});

test('out-of-order refunds cannot recreate returned money; spent refunds create debt', t => {
  const { store, order, payment } = fixture(t);
  const service = createWalletPaymentService({ store });
  const first = order();
  const refund = {
    InvoiceId: first.id,
    AccountId: user.id,
    TransactionId: 2345,
    PaymentTransactionId: 1234,
    OperationType: 'Refund',
    Amount: 50,
  };
  service.refund(refund);
  assert.equal(store.getView(user.id).balanceMinor, 0);
  service.pay(payment(first));
  service.pay(payment(first));
  assert.equal(store.getView(user.id).balanceMinor, 0);
  assert.throws(() => service.refund({ ...refund, TransactionId: 2346, Amount: 1 }));
  const second = order();
  service.pay(payment(second, { TransactionId: 3456 }));
  store.purchase({ userId: user.id, instructionId: instruction.id, instruction });
  service.refund({
    ...refund,
    InvoiceId: second.id,
    TransactionId: 4567,
    PaymentTransactionId: 3456,
  });
  assert.equal(store.getView(user.id).balanceMinor, -5000);
  assert.throws(() => store.purchase({ userId: user.id, instructionId: 'another', instruction }), {
    code: 'INSUFFICIENT_BALANCE',
  });
});

test('corrupt, missing and unwritable wallet state fails closed without resetting funds', t => {
  const { file, store, order } = fixture(t);
  const topup = order();
  store.credit({ orderId: topup.id, transactionId: '1234' });
  const before = fs.readFileSync(file);
  const io = {
    ...fs,
    fsyncSync() {
      throw new Error('disk unavailable');
    },
  };
  const failing = createWalletRepository({ file, io });
  assert.throws(() =>
    failing.purchase({ userId: user.id, instructionId: instruction.id, instruction }),
  );
  assert.deepEqual(fs.readFileSync(file), before);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => store.getView(user.id));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  fs.unlinkSync(file);
  assert.throws(() => createWalletRepository({ file }).getView(user.id));
  assert.equal(fs.existsSync(file), false);
});

test('two processes cannot overspend the last 50 rubles', async t => {
  const { file, store, order } = fixture(t);
  store.credit({ orderId: order().id, transactionId: '1234' });
  const repositoryUrl = new URL('../src/services/walletRepository.js', import.meta.url).href;
  async function worker(id) {
    const code = `import { createWalletRepository } from ${JSON.stringify(repositoryUrl)}; const store = createWalletRepository({ file: ${JSON.stringify(file)} }); try { store.purchase({ userId: 'alice', instructionId: ${JSON.stringify(id)}, instruction: { title: 'Instruction' } }); process.stdout.write('purchased'); } catch(error) { process.stdout.write(error.code); }`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code]);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
    });
    child.stderr.on('data', chunk => {
      output += chunk;
    });
    const [exitCode] = await once(child, 'exit');
    assert.equal(exitCode, 0, output);
    return output;
  }
  const results = await Promise.all([worker('a'), worker('b')]);
  assert.equal(results.filter(value => value === 'purchased').length, 1, results.join(','));
  assert.equal(store.getView(user.id).balanceMinor, 0);
  assert.equal(store.getView(user.id).purchases.length, 1);
});

async function apiFixture(t, { pdfFailure = false, free = 0 } = {}) {
  const setup = fixture(t);
  const { store, order } = setup;
  store.credit({ orderId: order().id, transactionId: '1234' });
  const app = express();
  const service = createWalletPaymentService({ store });
  app.use('/webhook', createWalletWebhookRouter({ payments: service }));
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = req.get('Authorization');
    if (id) req.user = { sub: id, role: id === 'admin' ? 'admin' : 'user' };
    next();
  });
  app.use(
    '/wallet',
    createWalletRouter({
      store,
      payments: service,
      userLookup: id => (['alice', 'bob'].includes(id) ? { ...user, id } : null),
      quotas: { get: () => ({ limit: 5, remaining: free, used: 5 - free }) },
      instructions: { getById: id => (id === instruction.id ? instruction : null) },
      generatePdf: pdfFailure ? async () => Buffer.from('broken') : createInstructionPdfBuffer,
      profileLookup: () => null,
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (endpoint, { owner = 'alice', body, method } = {}) =>
    fetch(`${url}/wallet${endpoint}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { ...(owner ? { Authorization: owner } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { ...setup, url, request };
}

test('HTTP purchase authenticates existing users, requires price consent, persists one purchase and protects PDF ownership', async t => {
  const { request, store } = await apiFixture(t);
  for (const owner of ['', 'deleted', 'admin'])
    assert.equal((await request('', { owner })).status, 401);
  assert.equal(
    (await request('/purchases', { body: { instructionId: instruction.id } })).status,
    400,
  );
  const body = { instructionId: instruction.id, priceMinor: 5000 };
  const responses = await Promise.all([
    request('/purchases', { body }),
    request('/purchases', { body }),
  ]);
  assert.deepEqual(
    responses.map(response => response.status),
    [200, 200],
  );
  const [a, b] = await Promise.all(responses.map(response => response.json()));
  assert.equal(a.purchaseId, b.purchaseId);
  assert.equal(a.wallet.balanceMinor, 0);
  const url = `/purchases/${a.purchaseId}/pdf`;
  assert.equal((await request(url, { owner: 'bob' })).status, 404);
  assert.equal((await request(url, { method: 'HEAD' })).status, 200);
  const download = await request(url);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
  assert.equal(
    Buffer.from(await download.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    '%PDF',
  );
  assert.equal(store.getView(user.id).balanceMinor, 0);
  assert.equal(store.getView(user.id).purchases.length, 1);
});

test('failed PDF generation and remaining free quota never debit the wallet', async t => {
  for (const options of [{ pdfFailure: true }, { free: 1 }]) {
    const { request, store } = await apiFixture(t, options);
    const response = await request('/purchases', {
      body: { instructionId: instruction.id, priceMinor: 5000 },
    });
    assert.equal(response.status, options.free ? 409 : 503);
    assert.equal(store.getView(user.id).balanceMinor, 5000);
    assert.equal(store.getView(user.id).purchases.length, 0);
  }
});

test('top-up API records consent and exposes only the owner and public terminal configuration', async t => {
  const previousId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  const previousSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  process.env.CLOUDPAYMENTS_PUBLIC_ID = 'pk_terminal';
  process.env.CLOUDPAYMENTS_API_SECRET = 'private-api-secret';
  t.after(() => {
    if (previousId === undefined) delete process.env.CLOUDPAYMENTS_PUBLIC_ID;
    else process.env.CLOUDPAYMENTS_PUBLIC_ID = previousId;
    if (previousSecret === undefined) delete process.env.CLOUDPAYMENTS_API_SECRET;
    else process.env.CLOUDPAYMENTS_API_SECRET = previousSecret;
  });
  const { request, store } = await apiFixture(t);
  const body = { requestId: randomUUID(), amountMinor: 5000, userId: 'bob', balanceMinor: 999999 };
  assert.equal((await request('/topups', { body })).status, 422);
  const response = await request('/topups', {
    body: { ...body, offerAccepted: true, personalDataConsentAccepted: true },
  });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.userInfo.accountId, 'alice');
  assert.equal(data.userInfo.email, user.email);
  assert.equal(data.publicTerminalId, 'pk_terminal');
  assert.ok(!JSON.stringify(data).includes('private-api-secret'));
  assert.equal(store.getOrder(data.id).consent.offerAccepted, true);
  assert.equal(store.getView(user.id).balanceMinor, 5000);
  assert.equal(
    (await request(`/topups/${data.id}/confirm`, { owner: 'bob', body: { transactionId: '1234' } }))
      .status,
    404,
  );
});

test('webhooks require raw-body HMAC, preserve legacy routing and retry uncommitted payments', async t => {
  const previousSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  process.env.CLOUDPAYMENTS_API_SECRET = 'wallet-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.CLOUDPAYMENTS_API_SECRET;
    else process.env.CLOUDPAYMENTS_API_SECRET = previousSecret;
  });
  const { url, store, order, payment, file } = await apiFixture(t);
  const topup = order();
  const body = new URLSearchParams(
    Object.entries(payment(topup, { TransactionId: 9876, TestMode: '0' })),
  ).toString();
  const hmac = createHmac('sha256', 'wallet-test-secret').update(body).digest('base64');
  const send = (payload, signature = hmac, event = 'pay') =>
    fetch(`${url}/webhook/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-HMAC': signature },
      body: payload,
    });
  assert.equal((await send(body, 'forged')).status, 403);
  assert.equal((await send(body.replace('Amount=50', 'Amount=500'))).status, 403);
  for (let repeat = 0; repeat < 2; repeat += 1)
    assert.deepEqual(await (await send(body)).json(), { code: 0 });
  assert.equal(store.getView(user.id).balanceMinor, 10000);
  const legacy = new URLSearchParams({ InvoiceId: 'legacy-generation-order' }).toString();
  const legacyHmac = createHmac('sha256', 'wallet-test-secret').update(legacy).digest('base64');
  assert.equal((await send(legacy, legacyHmac)).status, 404);
  fs.writeFileSync(file, '{broken');
  assert.equal((await send(body)).status, 503);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
