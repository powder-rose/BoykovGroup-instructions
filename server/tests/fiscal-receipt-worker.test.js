import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { captureFiscalContext, createFiscalEvent } from '../src/services/fiscalReceiptPayload.js';
import { createFiscalReceiptRepository } from '../src/services/fiscalReceiptRepository.js';
import { createFiscalReceiptWorker } from '../src/services/fiscalReceiptWorker.js';
import { createCloudKassirApi } from '../src/services/cloudKassirApiService.js';

const env = {
  CLOUDKASSIR_ENABLED: 'true',
  CLOUDPAYMENTS_PUBLIC_ID: 'pk_test',
  CLOUDPAYMENTS_API_SECRET: 'secret-that-must-not-leak',
};
const context = captureFiscalContext({ email: 'private-buyer@example.test' }, env);
const makeEvent = overrides =>
  createFiscalEvent({
    kind: 'wallet-advance',
    context,
    sourceId: 'payment-1',
    invoiceId: 'wt_1',
    amountMinor: 5000,
    title: 'Аванс',
    createdAt: '2026-10-27T09:00:00.000Z',
    ...overrides,
  });

function setup(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-fiscal-worker-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'receipts');
  const repository = createFiscalReceiptRepository({ directory });
  let now = 0;
  const logs = [];
  const calls = [];
  const api = options.api || {
    async create(payload, id) {
      calls.push({ payload, id });
      return { Success: true, Model: { Id: `receipt_${id}` } };
    },
    async status() {
      return { Success: true, Model: 'Processed' };
    },
  };
  const events = options.events || [makeEvent()];
  const worker = (overrides = {}) =>
    createFiscalReceiptWorker({
      repository,
      api,
      getEvents: () => events,
      clock: () => now,
      configuration: () => ({ publicId: context.publicId }),
      logger: { error: (...args) => logs.push(args) },
      ...overrides,
    });
  return {
    root,
    directory,
    repository,
    events,
    calls,
    api,
    logs,
    worker,
    advance: (ms = 15000) => {
      now += ms;
    },
  };
}

test('receipt acceptance is not completion; settlement waits for the processed advance and restart never resends either', async t => {
  const advance = makeEvent();
  const settlement = makeEvent({
    kind: 'wallet-settlement',
    sourceId: 'wp_1',
    invoiceId: 'wp_1',
    title: 'Word: Инструкция',
    createdAt: '2026-10-27T09:00:01.000Z',
    dependsOn: [advance.id],
  });
  const fixture = setup(t, { events: [advance, settlement] });
  const worker = fixture.worker();
  await worker.tick();
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.repository.read(advance.id).status, 'submitted');
  fixture.advance();
  await worker.tick();
  assert.equal(fixture.repository.read(advance.id).status, 'processed');
  assert.equal(fixture.calls.length, 2);
  fixture.advance();
  await fixture.worker().tick();
  assert.equal(fixture.repository.read(settlement.id).status, 'processed');
  fixture.advance();
  await fixture.worker().tick();
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.repository.list().length, 2);
  if (process.platform !== 'win32') {
    assert.equal(
      fs.statSync(path.join(fixture.directory, `${advance.id}.json`)).mode & 0o777,
      0o600,
    );
    assert.equal(fs.statSync(fixture.directory).mode & 0o777, 0o700);
  }
});

test('a lost create response is retried with exactly the same idempotency key and payload after restart', async t => {
  const requests = [];
  const accepted = new Map();
  const fixture = setup(t, {
    api: {
      async create(payload, id) {
        requests.push({ payload, id });
        if (!accepted.has(id)) {
          accepted.set(id, payload);
          throw new Error('response lost');
        }
        return { Success: true, Model: { Id: 'known_receipt' } };
      },
      async status() {
        return { Success: true, Model: 'Processed' };
      },
    },
  });
  await fixture.worker().tick();
  assert.equal(fixture.repository.read(fixture.events[0].id).status, 'pending');
  fixture.advance();
  await fixture.worker().tick();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(accepted.size, 1);
  fixture.advance();
  await fixture.worker().tick();
  assert.equal(fixture.repository.read(fixture.events[0].id).status, 'processed');
});

test('an ambiguous result beyond the one-hour provider cache is never blindly resent', async t => {
  let attempts = 0;
  const fixture = setup(t, {
    api: {
      async create() {
        attempts++;
        throw new Error('network unavailable');
      },
    },
  });
  await fixture.worker().tick();
  fixture.advance(50 * 60000);
  await fixture.worker().tick();
  assert.equal(attempts, 1);
  assert.equal(fixture.repository.read(fixture.events[0].id).status, 'review');
  assert.equal(fixture.repository.read(fixture.events[0].id).lastError, 'FISCAL_AMBIGUOUS_RESULT');
});

test('two workers cannot create the same receipt concurrently', async t => {
  let unlock;
  let started;
  const began = new Promise(resolve => {
    started = resolve;
  });
  const gate = new Promise(resolve => {
    unlock = resolve;
  });
  let calls = 0;
  const fixture = setup(t, {
    api: {
      async create() {
        calls++;
        started();
        await gate;
        return { Success: true, Model: { Id: 'concurrent_receipt' } };
      },
    },
  });
  const first = fixture.worker().tick();
  await began;
  await fixture
    .worker({ repository: createFiscalReceiptRepository({ directory: fixture.directory }) })
    .tick();
  assert.equal(calls, 1);
  unlock();
  await first;
});

test('a provider error or unknown receipt is reviewed without a replacement receipt', async t => {
  for (const status of ['Error', 'NotFound']) {
    const fixture = setup(t);
    fixture.api.status = async () => ({ Success: true, Model: status });
    await fixture.worker().tick();
    fixture.advance();
    await fixture.worker().tick();
    fixture.advance();
    await fixture.worker().tick();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.repository.read(fixture.events[0].id).status, 'review');
  }
});

test('missing records, missing registry and corrupted bytes fail closed without reissuing paid receipts', async t => {
  for (const remove of ['record', 'registry', 'directory', 'corrupt']) {
    const fixture = setup(t);
    await fixture.worker().tick();
    const record = path.join(fixture.directory, `${fixture.events[0].id}.json`);
    if (remove === 'record') fs.unlinkSync(record);
    if (remove === 'registry') fs.unlinkSync(path.join(fixture.directory, '_registry.json'));
    if (remove === 'directory') fs.rmSync(fixture.directory, { recursive: true });
    if (remove === 'corrupt') fs.writeFileSync(record, '{broken');
    fixture.advance();
    await fixture.worker().tick();
    assert.equal(fixture.calls.length, 1);
    assert.ok(fixture.logs.length > 0);
    assert.ok(!JSON.stringify(fixture.logs).includes('private-buyer@example.test'));
  }
});

test('shutdown aborts in-flight requests, persists retry state and prevents new work', async t => {
  let started;
  const began = new Promise(resolve => {
    started = resolve;
  });
  const fixture = setup(t, {
    api: {
      create(_payload, _id, signal) {
        started();
        return new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
        );
      },
    },
  });
  const worker = fixture.worker();
  const active = worker.tick();
  await began;
  await worker.stop();
  await active;
  assert.equal(fixture.repository.read(fixture.events[0].id).status, 'pending');
  await worker.tick();
  assert.equal(fixture.repository.read(fixture.events[0].id).attempts, 1);
});

test('disabled worker and explicit review or changed terminal never send a receipt', async t => {
  const fixture = setup(t);
  await fixture.worker({ configuration: () => null }).tick();
  assert.equal(fixture.calls.length, 0);
  assert.equal(fs.existsSync(fixture.directory), false);
  await fixture.worker({ configuration: () => ({ publicId: 'different_terminal' }) }).tick();
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.repository.read(fixture.events[0].id).status, 'review');
});

test('CloudKassir API uses private Basic Auth, UTF-8, stable request IDs and only documented receipt endpoints', async () => {
  const requests = [];
  const api = createCloudKassirApi({
    env,
    fetchImplementation: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ Success: true, Model: { Id: 'receipt_1' } }));
    },
  });
  const event = makeEvent();
  await api.create(event.payload, event.id);
  await api.status('receipt_1');
  await api.test();
  await api.register('01801810049423', '7381440901302834');
  assert.deepEqual(
    requests.map(row => row.url),
    [
      'https://api.cloudpayments.ru/kkt/receipt',
      'https://api.cloudpayments.ru/kkt/receipt/status/get',
      'https://api.cloudpayments.ru/test',
      'https://api.cloudpayments.ru/kkt/state/get',
    ],
  );
  assert.equal(requests[0].options.headers['X-Request-ID'], event.id);
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(
    requests[0].options.headers.Authorization,
    `Basic ${Buffer.from(`pk_test:${env.CLOUDPAYMENTS_API_SECRET}`).toString('base64')}`,
  );
  assert.deepEqual(JSON.parse(requests[0].options.body), event.payload);
  assert.equal(requests[1].options.headers['X-Request-ID'], undefined);
  assert.deepEqual(JSON.parse(requests[3].options.body), {
    DeviceNumber: '01801810049423',
    FiscalNumber: '7381440901302834',
  });
});

test('permanent provider errors do not expose its message or secret in application errors', async () => {
  const api = createCloudKassirApi({
    env,
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          Success: false,
          Message: 'private-buyer@example.test private provider detail',
          Model: { ErrorCode: -1 },
        }),
      ),
  });
  await assert.rejects(
    api.create(makeEvent().payload, 'request'),
    error =>
      error.code === 'FISCAL_REQUEST_REJECTED' &&
      error.permanent &&
      error.providerCode === -1 &&
      !error.message.includes('private-buyer'),
  );
  const unauthorized = createCloudKassirApi({
    env,
    fetchImplementation: async () => new Response('', { status: 401 }),
  });
  await assert.rejects(unauthorized.test(), { code: 'FISCAL_HTTP_401', permanent: true });
});
