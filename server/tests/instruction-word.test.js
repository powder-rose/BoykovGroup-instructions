import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import mammoth from 'mammoth';

import { createWalletRouter } from '../src/routes/wallet.js';
import { createWalletRepository } from '../src/services/walletRepository.js';
import {
  createInstructionDocxBuffer,
  DOCX_CONTENT_TYPE,
} from '../src/services/instructionDocxService.js';

const instruction = {
  id: 'instruction-word',
  title: 'Инструкция по охране труда для электрика',
  intro: 'До начала работы проверить инструмент.',
  sections: [
    { number: 1, heading: 'Общие требования', paragraphs: ['Использовать средства защиты.'] },
  ],
  webIntro: 'WEB_ONLY',
  explanationContent: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'EXPLANATION_ONLY' }] }],
  },
  editorialMeta: { author: 'PRIVATE_AUTHOR' },
};
const profile = {
  companyName: 'ООО Проверка',
  inn: '7701234567',
  headPosition: 'Генеральный директор',
  headFullName: 'Иванов Иван Иванович',
  occupationalSafetyPosition: 'Специалист по охране труда',
  occupationalSafetyFullName: 'Петров Пётр Петрович',
};

function ledger(t, amountMinor = 10000) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-word-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'wallet.json');
  const store = createWalletRepository({ file });
  if (amountMinor) {
    const order = store.createTopup({
      userId: 'alice',
      amountMinor,
      requestId: randomUUID(),
      publicId: 'pk_test',
      consent: { offerAccepted: true, personalDataConsentAccepted: true },
    });
    store.credit({ orderId: order.id, transactionId: '1234' });
  }
  return { file, store };
}

async function api(t, { amountMinor = 10000, generateDocx = createInstructionDocxBuffer } = {}) {
  const { file, store } = ledger(t, amountMinor);
  const downloads = [];
  let quotaReads = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const sub = req.get('Authorization');
    if (sub) req.user = { sub, role: sub === 'admin' ? 'admin' : 'user' };
    next();
  });
  app.use(
    '/wallet',
    createWalletRouter({
      store,
      userLookup: id => (['alice', 'bob'].includes(id) ? { id, role: 'user' } : null),
      instructions: { getById: id => (id === instruction.id ? instruction : null) },
      quotas: {
        get: () => {
          quotaReads += 1;
          return { limit: 5, remaining: 5, used: 0 };
        },
      },
      generateDocx,
      profileLookup: () => profile,
      recordDownload: event => downloads.push(event),
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
  const request = (endpoint, { owner = 'alice', body, method } = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/wallet${endpoint}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        ...(owner ? { Authorization: owner } : {}),
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { file, store, request, downloads, quotaReads: () => quotaReads };
}

const wordPurchase = {
  instructionId: instruction.id,
  format: 'docx',
  priceMinor: 5000,
  confirmed: true,
};

test('Word always costs 50 rubles, even with five free PDFs, and requires an existing user and explicit confirmation', async t => {
  const { request, store, quotaReads } = await api(t);
  for (const owner of ['', 'deleted', 'admin']) {
    assert.equal((await request('/purchases', { owner, body: wordPurchase })).status, 401);
  }
  for (const body of [
    { ...wordPurchase, confirmed: false },
    { ...wordPurchase, confirmed: undefined },
    { ...wordPurchase, priceMinor: 0 },
    { ...wordPurchase, priceMinor: '5000' },
    { ...wordPurchase, format: 'doc' },
    { ...wordPurchase, format: null },
  ])
    assert.equal((await request('/purchases', { body })).status, 400);
  assert.equal(store.getView('alice').balanceMinor, 10000);
  const checkout = await (
    await request(`/checkout?instructionId=${instruction.id}&format=docx`)
  ).json();
  assert.equal(checkout.instruction.format, 'docx');
  assert.equal(checkout.instruction.purchaseId, null);
  assert.equal(checkout.quota, null);
  assert.equal(quotaReads(), 0);
  const response = await request('/purchases', { body: wordPurchase });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).wallet.balanceMinor, 5000);
  assert.equal(store.getView('alice').purchases[0].format, 'docx');
  assert.equal(quotaReads(), 0);
});

test('Word retries and simultaneous confirmations charge once and do not grant access to PDF or other accounts', async t => {
  const { request, store, downloads } = await api(t);
  const responses = await Promise.all([
    request('/purchases', { body: wordPurchase }),
    request('/purchases', { body: wordPurchase }),
  ]);
  for (const response of responses) assert.equal(response.status, 200);
  const [first, second] = await Promise.all(responses.map(response => response.json()));
  assert.equal(first.purchaseId, second.purchaseId);
  const route = `/purchases/${first.purchaseId}/docx`;
  assert.equal((await request(route, { owner: '' })).status, 401);
  assert.equal((await request(route, { owner: 'bob' })).status, 404);
  assert.equal((await request(`/purchases/${first.purchaseId}/pdf`)).status, 404);
  assert.equal((await request(route, { method: 'HEAD' })).status, 200);
  assert.equal(downloads.length, 0);
  const file = await request(route);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('Content-Type'), DOCX_CONTENT_TYPE);
  assert.equal(file.headers.get('Cache-Control'), 'private, no-store');
  assert.match(file.headers.get('Content-Disposition'), /instruction\.docx/);
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await mammoth.extractRawText({ buffer });
  assert.match(result.value, /Генеральный директор/);
  assert.match(result.value, /Иванов Иван Иванович/);
  assert.match(result.value, /Использовать средства защиты/);
  assert.doesNotMatch(result.value, /WEB_ONLY|EXPLANATION_ONLY|PRIVATE_AUTHOR/);
  assert.equal(store.getView('alice').balanceMinor, 5000);
  assert.equal(store.getView('alice').purchases.length, 1);
  assert.equal(downloads[0].kind, 'paid');
});

test('legacy PDF purchases remain PDF, while Word is a separate 50-ruble entitlement', async t => {
  const { file, store, request } = await api(t);
  const pdf = store.purchase({ userId: 'alice', instructionId: instruction.id, instruction });
  const data = JSON.parse(fs.readFileSync(file));
  delete data.purchases[0].format;
  fs.writeFileSync(file, JSON.stringify(data));
  assert.equal((await request(`/purchases/${pdf.id}/pdf`)).status, 200);
  assert.equal((await request(`/purchases/${pdf.id}/docx`)).status, 404);
  assert.equal(store.findPurchase('alice', instruction.id, 'docx'), null);
  const response = await request('/purchases', { body: wordPurchase });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).wallet.balanceMinor, 0);
  const saved = JSON.parse(fs.readFileSync(file));
  assert.equal(saved.purchases[0].format, undefined);
  assert.equal(store.getView('alice').purchases.length, 2);
  assert.equal(store.getView('alice').purchases.find(row => row.id === pdf.id).format, 'pdf');
});

test('insufficient balance and malformed Word generation never debit money', async t => {
  for (const options of [
    { amountMinor: 0 },
    { generateDocx: async () => Buffer.from('broken') },
    {
      generateDocx: async () => {
        throw new Error('generation failed');
      },
    },
  ]) {
    const { store, request } = await api(t, options);
    const before = store.getView('alice').balanceMinor;
    const response = await request('/purchases', { body: wordPurchase });
    assert.equal(response.status, options.amountMinor === 0 ? 409 : 503);
    assert.equal(store.getView('alice').balanceMinor, before);
    assert.equal(store.getView('alice').purchases.length, 0);
  }
});

test('rich Word retains headings, inline formatting, lists and merged tables while stripping only generic boilerplate', async () => {
  const p = (text, marks) => ({
    type: 'paragraph',
    content: [{ type: 'text', text, ...(marks ? { marks } : {}) }],
  });
  const buffer = await createInstructionDocxBuffer(
    {
      ...instruction,
      instructionContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '1. Общие требования' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Настоящая инструкция устанавливает ',
                marks: [{ type: 'bold' }],
              },
              { type: 'text', text: 'требования безопасности при выполнении работ. ' },
              { type: 'text', text: 'Сохранить это требование.', marks: [{ type: 'bold' }] },
            ],
          },
          {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [{ type: 'listItem', content: [p('Проверить инструмент.')] }],
          },
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [p('Защитные очки', [{ type: 'italic' }])] }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', attrs: { colspan: 2 }, content: [p('Средства защиты')] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [p('Перчатки')] },
                  { type: 'tableCell', content: [p('Исправные')] },
                ],
              },
            ],
          },
        ],
      },
    },
    { companyProfile: profile, downloadedAt: new Date('2026-10-27T23:00:00Z') },
  );
  const { value } = await mammoth.convertToHtml({ buffer });
  assert.match(value, /<h2>1\. Общие требования<\/h2>/);
  assert.match(value, /<strong>Сохранить это требование\.<\/strong>/);
  assert.match(value, /<em>Защитные очки<\/em>/);
  assert.match(value, /<ol>/);
  assert.match(value, /<ul>/);
  assert.match(value, /colspan="2"/);
  assert.doesNotMatch(value, /Настоящая инструкция|WEB_ONLY|EXPLANATION_ONLY/);
  assert.match(value, /28\.10\.2026/);
});
