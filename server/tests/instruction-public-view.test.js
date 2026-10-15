import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';

import { instructionsRouter } from '../src/routes/instructions.js';
import { createInstructionPagesRouter } from '../src/routes/instructionPages.js';
import { instructionsRepository } from '../src/services/instructionsRepository.js';
import { toPublicInstruction } from '../src/services/instructionPublicView.js';

function instructionFixture(overrides = {}) {
  return {
    id: 'editorial-instruction',
    slug: 'editorial-instruction-slug',
    title: 'Инструкция для электрика',
    profession: 'Электрик',
    source: 'manual',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-05-01T12:00:00.000Z',
    seoTitle: 'Инструкция электрика: полный текст',
    seoDescription: 'Требования безопасности при проверке и ремонте электрооборудования.',
    webIntro: 'Вступление для читателя.',
    instructionContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Основной текст документа.' }] },
      ],
    },
    explanationContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Пояснение для читателя.' }] },
      ],
    },
    editorialMeta: {
      seoReady: true,
      seoUpdatedAt: '2026-04-01T12:00:00.000Z',
      contentUpdatedAt: '2026-03-01T12:00:00.000Z',
      seoReadySource: 'EDITORIAL_METADATA_ONLY',
      seoAuthor: 'SEO_EDITOR_PRIVATE_NAME',
      contentAuthor: 'TEXT_EDITOR_PRIVATE_NAME',
    },
    ...overrides,
  };
}

function assertNoEditorialMetadata(value) {
  const serialized = JSON.stringify(value);
  for (const field of [
    'editorialMeta',
    'publishedEditorialMeta',
    'seoReadySource',
    'seoAuthor',
    'contentAuthor',
  ]) {
    assert.equal(serialized.includes(`"${field}":`), false, `Public data must omit ${field}`);
  }
  assert.equal(serialized.includes('EDITORIAL_METADATA_ONLY'), false);
  assert.equal(serialized.includes('SEO_EDITOR_PRIVATE_NAME'), false);
  assert.equal(serialized.includes('TEXT_EDITOR_PRIVATE_NAME'), false);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

test('public instruction conversion preserves content and removes nested editorial data without mutation', () => {
  const previous = instructionFixture({ id: 'previous-instruction', version: '1.0' });
  const record = instructionFixture({
    versions: [{ version: '1.0', instruction: previous }],
    publishedEditorialMeta: { seoReady: true },
    seoReadySource: 'manual',
    seoAuthor: 'SEO_EDITOR_PRIVATE_NAME',
    contentAuthor: 'TEXT_EDITOR_PRIVATE_NAME',
  });
  const original = structuredClone(record);
  const result = toPublicInstruction(deepFreeze(record));

  assertNoEditorialMetadata(result);
  assert.equal(result.versions[0].version, '1.0');
  assert.equal(result.versions[0].instruction.id, previous.id);
  for (const field of [
    'id',
    'slug',
    'title',
    'seoTitle',
    'seoDescription',
    'webIntro',
    'createdAt',
    'updatedAt',
    'instructionContent',
    'explanationContent',
  ]) {
    assert.deepEqual(result[field], original[field], `Public field ${field} must be preserved`);
  }
  assert.deepEqual(record, original);
  assert.notEqual(result.instructionContent, record.instructionContent);
  assert.equal(toPublicInstruction(null), null);
});

test('public ID, page, search and related APIs never expose editorial metadata for any role', async t => {
  const first = instructionFixture();
  const related = instructionFixture({ id: 'related-electrician', slug: 'related-electrician' });
  const originalCache = instructionsRepository.cache;
  instructionsRepository.cache = new Map([
    [first.id, first],
    [related.id, related],
  ]);
  const app = express();
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { role, sub: 'reader' };
    next();
  });
  app.use('/api/instructions', createInstructionPagesRouter());
  app.use('/api/instructions', instructionsRouter);
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    instructionsRepository.cache = originalCache;
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/instructions`;

  for (const role of [null, 'user', 'admin']) {
    for (const suffix of [
      `/${first.id}`,
      `/page/${first.slug}`,
      `/${first.id}/related`,
      '?q=электрик',
    ]) {
      const response = await fetch(`${base}${suffix}`, {
        headers: role ? { 'x-test-role': role } : {},
      });
      assert.equal(response.status, 200, `${role || 'guest'} ${suffix}`);
      const result = await response.json();
      assertNoEditorialMetadata(result);
      if (suffix === `/${first.id}` || suffix.startsWith('/page/')) {
        assert.equal(result.seoDescription, first.seoDescription);
        assert.deepEqual(result.instructionContent, first.instructionContent);
      } else {
        assert.ok(result.items.length > 0);
      }
    }
  }
  assert.equal(instructionsRepository.getById(first.id), first);
  assert.equal(first.editorialMeta.seoReady, true);
});

async function isolatedOrders(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-instruction-public-orders-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourcePath = fileURLToPath(
    new URL('../src/services/publicGenerationOrderService.js', import.meta.url),
  );
  const source = fs.readFileSync(sourcePath, 'utf8');
  const storageDeclaration =
    "const ORDERS_DIR = path.join(__dirname, '..', 'data', 'publicGenerationOrders');";
  assert.ok(source.includes(storageDeclaration));
  const isolatedSource = source
    .replace(
      storageDeclaration,
      `const ORDERS_DIR = ${JSON.stringify(path.join(directory, 'orders'))};`,
    )
    .replace(
      /from '(\.{1,2}\/[^']+)'/gu,
      (_match, specifier) =>
        `from '${pathToFileURL(path.resolve(path.dirname(sourcePath), specifier)).href}'`,
    );
  const modulePath = path.join(directory, 'orders.mjs');
  fs.writeFileSync(modulePath, isolatedSource);
  return import(pathToFileURL(modulePath).href);
}

test('owner and order-token views strip editorial metadata from reused catalog instructions', async t => {
  const orders = await isolatedOrders(t);
  const order = orders.createPublicGenerationOrder('Электрик', {}, { userId: 'reader' });
  assert.equal(orders.getPublicGenerationOrderView(order.id, order.accessToken).instruction, null);
  const instruction = instructionFixture();
  const original = structuredClone(instruction);
  orders.updatePublicGenerationOrder(order.id, {
    status: 'generated',
    publicationStatus: 'pending',
    paidAt: '2026-05-01T12:00:00.000Z',
    instructionId: instruction.id,
    generatedInstruction: instruction,
  });

  for (const view of [
    orders.getPublicGenerationOrderView(order.id, order.accessToken),
    orders.getPublicGenerationOrderByOwnerView(order.id, 'reader'),
  ]) {
    assertNoEditorialMetadata(view);
    assert.equal(view.instruction.id, instruction.id);
    assert.equal(view.instruction.seoDescription, instruction.seoDescription);
    assert.deepEqual(view.instruction.instructionContent, instruction.instructionContent);
  }
  assert.equal(orders.getPublicGenerationOrderView(order.id, 'wrong-token'), null);
  assert.equal(orders.getPublicGenerationOrderByOwnerView(order.id, 'another-reader'), null);
  assert.deepEqual(orders.getPublicGenerationOrder(order.id).generatedInstruction, original);
  assert.deepEqual(
    orders.listPublicationInboxOrders()[0].instruction.editorialMeta,
    original.editorialMeta,
  );
  assert.deepEqual(instruction, original);
});
