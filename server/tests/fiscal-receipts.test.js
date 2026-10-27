import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import express from 'express';
import {
  captureFiscalContext,
  createFiscalEvent,
  getFiscalConfiguration,
} from '../src/services/fiscalReceiptPayload.js';
import { createWalletRepository } from '../src/services/walletRepository.js';
import { createWalletPaymentService } from '../src/services/walletPaymentService.js';
import { createWalletRouter } from '../src/routes/wallet.js';
import { generationFiscalEvents } from '../src/services/generationFiscalEvents.js';

const env = {
  CLOUDKASSIR_ENABLED: 'true',
  CLOUDPAYMENTS_PUBLIC_ID: 'pk_fiscal_test',
  CLOUDPAYMENTS_API_SECRET: 'private-test-secret',
};
const customer = {
  id: 'user-test',
  email: 'buyer@example.test',
  phone: '+79990000000',
  role: 'user',
};
const context = captureFiscalContext(customer, env);
const at = '2026-10-27T09:00:00.000Z';
const event = overrides =>
  createFiscalEvent({
    kind: 'wallet-advance',
    context,
    sourceId: 'transaction-1',
    invoiceId: 'wt_order',
    amountMinor: 5000,
    createdAt: at,
    title: 'Аванс',
    transactionId: '12345',
    ...overrides,
  });

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-fiscal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'wallets.json');
  const store = createWalletRepository({ file });
  const order = (overrides = {}) =>
    store.createTopup({
      userId: customer.id,
      amountMinor: 10000,
      requestId: randomUUID(),
      publicId: env.CLOUDPAYMENTS_PUBLIC_ID,
      consent: { offerAccepted: true, personalDataConsentAccepted: true },
      fiscalContext: context,
      ...overrides,
    });
  return { root, file, store, order };
}

test('fiscal configuration is explicit, keeps credentials private and rejects missing contacts', () => {
  assert.equal(getFiscalConfiguration({}), null);
  assert.equal(
    captureFiscalContext(() => {
      throw new Error('Must not look up disabled users');
    }, {}),
    null,
  );
  assert.throws(() => getFiscalConfiguration({ CLOUDKASSIR_ENABLED: '1' }), {
    code: 'FISCAL_CONFIGURATION_INVALID',
  });
  assert.throws(() => getFiscalConfiguration({ CLOUDKASSIR_ENABLED: 'true' }), {
    code: 'FISCAL_CONFIGURATION_INVALID',
  });
  assert.throws(() => captureFiscalContext({}, env), { code: 'FISCAL_CONTACT_REQUIRED' });
  assert.throws(
    () => getFiscalConfiguration({ ...env, CLOUDKASSIR_CALCULATION_PLACE: 'http://example.test' }),
    { code: 'FISCAL_CONFIGURATION_INVALID' },
  );
  assert.equal(context.inn, '5027310150');
  assert.equal(context.taxationSystem, 1);
  assert.equal(context.vat, 5);
  assert.equal(context.advanceVat, 105);
  assert.ok(!JSON.stringify(context).includes('private-test-secret'));
});

test('advance, settlement and returns encode exact totals, FFD 1.2 and VAT inside the price', () => {
  const advance = event().payload.CustomerReceipt;
  assert.deepEqual(advance.Amounts, { Electronic: 50, AdvancePayment: 0 });
  assert.deepEqual(advance.Items[0], {
    Label: 'Аванс',
    Price: 50,
    Quantity: 1,
    Amount: 50,
    Vat: 105,
    Method: 3,
    Object: 10,
    UnitCode: 0,
  });
  assert.equal(advance.TaxationSystem, 1);
  assert.equal(advance.IsBso, false);
  assert.equal(advance.IsInternetPayment, true);
  assert.equal(advance.RussiaTimeZone, 2);
  assert.equal(advance.CalculationPlace, 'https://boykovdocs.ru/');
  assert.equal(advance.Email, customer.email);
  assert.deepEqual(advance.NonCashPayments, [{ Amount: 50, PaymentMethod: 1, PaymentId: '12345' }]);
  const settlement = event({ kind: 'wallet-settlement', title: 'Word: Инструкция' }).payload
    .CustomerReceipt;
  assert.deepEqual(settlement.Amounts, { Electronic: 0, AdvancePayment: 50 });
  assert.equal(settlement.Items[0].Vat, 5);
  assert.equal(settlement.Items[0].Method, 4);
  assert.equal(settlement.Items[0].Object, 4);
  assert.equal(settlement.NonCashPayments, undefined);
  const returned = event({ kind: 'wallet-refund', amountMinor: 505 });
  assert.equal(returned.payload.Type, 'IncomeReturn');
  assert.equal(returned.payload.CustomerReceipt.Items[0].Amount, 5.05);
  assert.equal(returned.payload.CustomerReceipt.Items[0].Vat, 105);
  assert.equal(
    event({ title: 'Я'.repeat(200) }).payload.CustomerReceipt.Items[0].Label.length,
    128,
  );
  assert.notEqual(event().id, event({ kind: 'wallet-refund' }).id);
  assert.throws(() => event({ amountMinor: 1.1 }), { code: 'FISCAL_EVENT_INVALID' });
});

test('a committed top-up and each purchased format have durable events; retries and public views never duplicate or leak them', t => {
  const { file, store, order } = fixture(t);
  const topup = order();
  assert.equal(store.listFiscalEvents().length, 0);
  store.credit({ orderId: topup.id, transactionId: 'transaction-1' });
  store.credit({
    orderId: topup.id,
    transactionId: 'transaction-1',
    fiscalContext: () => {
      throw new Error('Duplicate credit must not re-resolve customer');
    },
  });
  const purchase = format =>
    store.purchase({
      userId: customer.id,
      instructionId: 'instruction-test',
      instruction: { title: 'Инструкция' },
      format,
      fiscalContext: context,
    });
  const word = purchase('docx');
  assert.equal(purchase('docx').id, word.id);
  const pdf = purchase('pdf');
  const reopened = createWalletRepository({ file });
  const events = reopened.listFiscalEvents();
  assert.equal(events.length, 3);
  assert.equal(reopened.getView(customer.id).balanceMinor, 0);
  for (const id of [word.id, pdf.id]) {
    const receipt = events.find(row => row.payload.InvoiceId === id);
    assert.deepEqual(receipt.dependsOn, [events[0].id]);
    assert.equal(receipt.payload.CustomerReceipt.Amounts.AdvancePayment, 50);
  }
  assert.ok(events.some(row => row.payload.CustomerReceipt.Items[0].Label.startsWith('Word:')));
  for (const view of [
    reopened.getView(customer.id),
    reopened.listAdminPurchases(),
    reopened.getOrderView(customer.id, topup.id),
  ]) {
    assert.ok(!JSON.stringify(view).includes('fiscalEvent'));
    assert.ok(!JSON.stringify(view).includes(customer.email));
  }
});

test('wallet commit failure cannot persist a receipt without the debit, and legacy records are not backfilled', t => {
  const { file, store, order } = fixture(t);
  const topup = order({ fiscalContext: undefined });
  store.credit({ orderId: topup.id, transactionId: 'legacy-payment' });
  assert.deepEqual(store.listFiscalEvents(), []);
  const before = fs.readFileSync(file, 'utf8');
  const broken = createWalletRepository({
    file,
    io: new Proxy(fs, {
      get(target, key) {
        if (key === 'renameSync')
          return () => {
            throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
          };
        return target[key];
      },
    }),
  });
  assert.throws(
    () =>
      broken.purchase({
        userId: customer.id,
        instructionId: 'failed',
        instruction: { title: 'Failed' },
        format: 'docx',
        fiscalContext: context,
      }),
    { code: 'ENOSPC' },
  );
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.deepEqual(store.listFiscalEvents(), []);
});

test('test payments produce neither wallet funds nor real fiscal events; refunds before Pay wait for the verified credit', t => {
  const { store, order } = fixture(t);
  const topup = order();
  const payments = createWalletPaymentService({ store });
  const data = {
    InvoiceId: topup.id,
    AccountId: customer.id,
    Amount: 100,
    Currency: 'RUB',
    OperationType: 'Payment',
    Status: 'Completed',
    TestMode: true,
    TransactionId: 12345,
  };
  payments.pay(data);
  payments.refund({ InvoiceId: topup.id, TestMode: true });
  assert.deepEqual(store.listFiscalEvents(), []);
  assert.equal(store.getView(customer.id).balanceMinor, 0);
  store.refund({
    orderId: topup.id,
    transactionId: 'refund-1',
    originalTransactionId: '12345',
    amountMinor: 5000,
  });
  assert.deepEqual(store.listFiscalEvents(), []);
  payments.pay({ ...data, TestMode: false });
  const events = store.listFiscalEvents();
  assert.equal(events.length, 2);
  assert.equal(events[1].payload.Type, 'IncomeReturn');
  assert.deepEqual(events[1].dependsOn, [events[0].id]);
  assert.equal(store.getView(customer.id).balanceMinor, 5000);
});

test('a refund of already spent advance is preserved financially and flagged for fiscal reconciliation', t => {
  const { store, order } = fixture(t);
  const topup = order({ amountMinor: 5000 });
  store.credit({ orderId: topup.id, transactionId: 'spent-payment' });
  store.purchase({
    userId: customer.id,
    instructionId: 'spent',
    instruction: { title: 'Инструкция' },
    fiscalContext: context,
  });
  store.refund({
    orderId: topup.id,
    transactionId: 'spent-return',
    originalTransactionId: 'spent-payment',
    amountMinor: 5000,
  });
  assert.equal(store.getView(customer.id).balanceMinor, -5000);
  assert.equal(store.listFiscalEvents().at(1).reviewReason, 'SPENT_ADVANCE_REFUND');
});

test('HTTP checkout captures server-side fiscal settings and repeats a Word download without another receipt', async t => {
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const { store } = fixture(t);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { role: 'user', sub: customer.id };
    next();
  });
  app.use(
    '/wallet',
    createWalletRouter({
      store,
      userLookup: () => customer,
      instructions: { getById: () => ({ id: 'instruction', title: 'Инструкция' }) },
      quotas: { get: () => ({ remaining: 5 }) },
      profileLookup: () => null,
      generateDocx: async () =>
        Buffer.concat([
          Buffer.from('PK\x03\x04word/document.xml[Content_Types].xml'),
          Buffer.alloc(1100),
        ]),
      recordDownload: () => {},
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/wallet`;
  const post = (endpoint, body) =>
    fetch(url + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const topupResponse = await post('/topups', {
    amountMinor: 5000,
    requestId: randomUUID(),
    offerAccepted: true,
    personalDataConsentAccepted: true,
    fiscalContext: { vat: 0, email: 'attacker@example.test' },
  });
  assert.equal(topupResponse.status, 201);
  const topup = await topupResponse.json();
  assert.equal(topup.fiscalContext, undefined);
  assert.equal(store.getOrder(topup.id).fiscalContext.email, customer.email);
  assert.equal(store.getOrder(topup.id).fiscalContext.vat, 5);
  store.credit({ orderId: topup.id, transactionId: 'verified-payment' });
  const body = { instructionId: 'instruction', format: 'docx', confirmed: true, priceMinor: 5000 };
  const purchaseResponse = await post('/purchases', body);
  assert.equal(purchaseResponse.status, 200);
  const purchase = await purchaseResponse.json();
  assert.equal((await post('/purchases', body)).status, 200);
  assert.equal((await fetch(`${url}/purchases/${purchase.purchaseId}/docx`)).status, 200);
  assert.equal(
    (await fetch(`${url}/purchases/${purchase.purchaseId}/docx`, { method: 'HEAD' })).status,
    200,
  );
  assert.equal(store.listFiscalEvents().length, 2);
  assert.equal(store.getView(customer.id).balanceMinor, 0);
});

test('urgent generation uses paid amount after discount, settles once and never fiscalizes a test payment', async t => {
  const { root } = fixture(t);
  const original = new URL('../src/services/publicGenerationOrderService.js', import.meta.url);
  const source = fs
    .readFileSync(original, 'utf8')
    .replace(
      "const ORDERS_DIR = path.join(__dirname, '..', 'data', 'publicGenerationOrders');",
      `const ORDERS_DIR = ${JSON.stringify(path.join(root, 'orders'))};`,
    )
    .replace(
      /from '(\.{1,2}\/[^']+)'/gu,
      (_match, specifier) => `from '${new URL(specifier, original).href}'`,
    );
  const moduleFile = path.join(root, 'orders.mjs');
  fs.writeFileSync(moduleFile, source);
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const orders = await import(pathToFileURL(moduleFile).href);
  const order = orders.createPublicGenerationOrder(
    'Электрик',
    { amount: 199, originalAmount: 500 },
    { userId: customer.id, email: customer.email },
  );
  orders.updatePublicGenerationOrder(order.id, {
    status: 'paid',
    fiscalPaymentLive: false,
    transactionId: 'test',
    paidAt: at,
  });
  assert.deepEqual(orders.listPublicGenerationFiscalEvents(), []);
  orders.updatePublicGenerationOrder(order.id, {
    status: 'paid',
    fiscalPaymentLive: true,
    transactionId: '12345',
    paidAt: at,
  });
  const delivered = {
    status: 'generated',
    generatedAt: at,
    generatedInstruction: { title: 'Инструкция' },
  };
  orders.updatePublicGenerationOrder(order.id, delivered);
  orders.updatePublicGenerationOrder(order.id, delivered);
  const events = orders.listPublicGenerationFiscalEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].payload.CustomerReceipt.Items[0].Method, 1);
  assert.equal(events[0].payload.CustomerReceipt.Items[0].Amount, 199);
  assert.equal(events[1].payload.CustomerReceipt.Amounts.AdvancePayment, 199);
  assert.deepEqual(events[1].dependsOn, [events[0].id]);
  assert.ok(
    !JSON.stringify(orders.getPublicGenerationOrderView(order.id, order.accessToken)).includes(
      'fiscal',
    ),
  );
  const returned = generationFiscalEvents(
    { ...orders.getPublicGenerationOrder(order.id), refundedAt: at },
    { status: 'refunded' },
  );
  assert.equal(returned.at(-1).reviewReason, 'DELIVERED_SERVICE_REFUND');
});
