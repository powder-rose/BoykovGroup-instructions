import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionTaxonomyOperationsRouter } from '../src/routes/adminInstructionTaxonomyOperations.js';
import { InstructionEditorError } from '../src/services/instructionEditorError.js';

const importBody = {
  fileName: 'assignments.csv',
  csvBase64: Buffer.from('\uFEFFdocument_id;url\r\n', 'utf8').toString('base64'),
  registryRevision: 7,
  includeDrafts: true,
  tagMode: 'add',
  replaceConfirmed: false,
};

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t) {
  const calls = [];
  const preview = {
    previewId: 'opaque-import-preview',
    counts: { selectedDocuments: 1, changedDocuments: 1 },
    rows: [],
    importReport: {
      file: { name: 'assignments.csv', sha256: 'server-derived', bytes: 42 },
      counts: { rows: 1, matched: 1, manualReview: 0 },
      records: [],
    },
  };
  const service = {
    previewImport(...args) {
      calls.push({ method: 'previewImport', args });
      return preview;
    },
    apply(...args) {
      calls.push({ method: 'apply', args });
      return { operationId: 'opaque-import-preview', status: 'committed' };
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { role, sub: req.get('x-test-sub'), login: req.get('x-test-login') };
    next();
  });
  app.use('/operations', createAdminInstructionTaxonomyOperationsRouter({ service }));
  const base = await listen(t, app);
  async function request(body, { role = 'admin', sub, login, path = '/import-preview' } = {}) {
    return fetch(`${base}/operations${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(role ? { 'x-test-role': role } : {}),
        ...(sub ? { 'x-test-sub': sub } : {}),
        ...(login ? { 'x-test-login': login } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return { service, calls, preview, request };
}

test('CSV import preview requires an administrator before consulting its service', async t => {
  const f = await fixture(t);
  for (const role of [null, 'user', 'guest']) {
    const response = await f.request(importBody, { role });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    await response.arrayBuffer();
  }
  assert.deepEqual(f.calls, []);
});

test('CSV preview forwards the exact file envelope and uses only the session actor', async t => {
  const f = await fixture(t);
  for (const [identity, actor] of [
    [{ sub: 'admin-subject', login: 'unused-login' }, 'admin-subject'],
    [{ login: 'admin-login' }, 'admin-login'],
    [{}, 'admin'],
  ]) {
    const response = await f.request(importBody, identity);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), f.preview);
    assert.deepEqual(f.calls.at(-1), { method: 'previewImport', args: [importBody, actor] });
  }
  const applied = await f.request(
    { previewId: 'opaque-import-preview', confirmed: true },
    { sub: 'admin-subject', path: '/apply' },
  );
  assert.equal(applied.status, 200);
  assert.deepEqual(await applied.json(), {
    operationId: 'opaque-import-preview',
    status: 'committed',
  });
  assert.deepEqual(f.calls.at(-1), {
    method: 'apply',
    args: [{ previewId: 'opaque-import-preview', confirmed: true }, 'admin-subject'],
  });
});

test('CSV import rejects incomplete or extended envelopes without calling the service', async t => {
  const f = await fixture(t);
  const bodies = [undefined, [], {}, { ...importBody, actor: 'forged-admin' }];
  for (const field of Object.keys(importBody)) {
    const incomplete = { ...importBody };
    delete incomplete[field];
    bodies.push(incomplete);
  }
  for (const value of bodies) {
    const response = await f.request(value);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await response.json()).code, 'INVALID_TAXONOMY_BULK_REQUEST');
  }
  assert.deepEqual(f.calls, []);
});

test('CSV validation and conflict errors preserve domain status and safe report details', async t => {
  const f = await fixture(t);
  t.mock.method(console, 'error', () => {});
  for (const [status, code] of [
    [400, 'INVALID_TAXONOMY_CSV_INPUT'],
    [400, 'TAXONOMY_CSV_REPLACE_CONFIRMATION_REQUIRED'],
    [409, 'TAXONOMY_REVISION_CONFLICT'],
    [409, 'TAXONOMY_BULK_PENDING'],
    [500, 'TAXONOMY_BULK_STORAGE_ERROR'],
  ]) {
    const error = new InstructionEditorError('Импорт остановлен', { status, code });
    error.details = { row: 3 };
    f.service.previewImport = () => {
      throw error;
    };
    const response = await f.request(importBody);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
      error: 'Импорт остановлен',
      code,
      details: { row: 3 },
    });
  }
});

test('only the import preview receives an 8 MB parser and parser errors remain private', async t => {
  const { createApp } = await import('../src/app.js');
  const base = await listen(t, createApp());
  const prefix = `${base}/api/admin/instruction-taxonomy-operations`;
  const accepted = await fetch(`${prefix}/import-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...importBody, csvBase64: 'A'.repeat(2_300_000) }),
  });
  assert.equal(accepted.status, 401);
  assert.equal(accepted.headers.get('cache-control'), 'private, no-store');
  await accepted.arrayBuffer();

  const oversized = await fetch(`${prefix}/import-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...importBody, csvBase64: 'A'.repeat(8_400_000) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.headers.get('cache-control'), 'private, no-store');
  await oversized.arrayBuffer();

  const unchanged = await fetch(`${prefix}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvBase64: 'A'.repeat(2_300_000) }),
  });
  assert.equal(unchanged.status, 413);
  assert.equal(unchanged.headers.get('cache-control'), 'private, no-store');
  await unchanged.arrayBuffer();

  const malformed = await fetch(`${prefix}/import-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get('cache-control'), 'private, no-store');
  await malformed.arrayBuffer();
});
