import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionTaxonomyOperationsRouter } from '../src/routes/adminInstructionTaxonomyOperations.js';
import { InstructionEditorError } from '../src/services/instructionEditorError.js';

const previewBody = {
  ids: ['document-one'],
  registryRevision: 4,
  includeDrafts: true,
  action: { type: 'set-section', sectionId: 'W01' },
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
  const service = Object.fromEntries(
    ['list', 'history', 'status', 'preview', 'apply', 'previewRollback', 'recover'].map(method => [
      method,
      (...args) => {
        calls.push({ method, args });
        return { method, ok: true };
      },
    ]),
  );
  const app = express();
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) {
      req.user = { role, sub: req.get('x-test-sub'), login: req.get('x-test-login') };
    }
    next();
  });
  app.use(
    '/operations',
    createAdminInstructionTaxonomyOperationsRouter({
      service,
      exportProvider: filters => {
        calls.push({ method: 'export', args: [filters] });
        return '\uFEFFdocument_id;url\r\n1;https://boykovdocs.ru/current\r\n';
      },
    }),
  );
  const base = await listen(t, app);
  async function request(route, { method = 'GET', role = 'admin', sub, login, body } = {}) {
    return fetch(`${base}/operations${route}`, {
      method,
      headers: {
        ...(role ? { 'x-test-role': role } : {}),
        ...(sub ? { 'x-test-sub': sub } : {}),
        ...(login ? { 'x-test-login': login } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return { service, calls, request };
}

test('all operations and exports require an administrator before consulting injected services', async t => {
  const f = await fixture(t);
  const routes = [
    ['/bindings', 'GET'],
    ['/history', 'GET'],
    ['/status', 'GET'],
    ['/export', 'GET'],
    ['/preview', 'POST', previewBody],
    ['/apply', 'POST', { previewId: 'preview-one', confirmed: true }],
    ['/history/operation-one/rollback-preview', 'POST'],
    ['/recover', 'POST', { operationId: 'operation-one', confirmed: true }],
  ];
  for (const role of [null, 'user', 'guest']) {
    for (const [route, method, body] of routes) {
      const response = await f.request(route, { method, role, body });
      assert.equal(response.status, 401, `${role} ${route}`);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      await response.arrayBuffer();
    }
  }
  assert.deepEqual(f.calls, []);
});

test('factory forwards exact filters and body DTOs and derives actors only from authenticated identity', async t => {
  const f = await fixture(t);
  const cases = [
    ['/bindings?query=Документ&section=W01&tag=T47&page=2&pageSize=20', {}, 'list'],
    ['/history?page=3&pageSize=10', {}, 'history'],
    ['/status', {}, 'status'],
    ['/preview', { method: 'POST', sub: 'admin-subject', body: previewBody }, 'preview'],
    [
      '/apply',
      { method: 'POST', login: 'admin-login', body: { previewId: 'preview-one', confirmed: true } },
      'apply',
    ],
    ['/history/operation-one/rollback-preview', { method: 'POST' }, 'previewRollback'],
    [
      '/recover',
      { method: 'POST', sub: 'recoverer', body: { operationId: 'operation-one', confirmed: true } },
      'recover',
    ],
  ];
  for (const [route, options, method] of cases) {
    const response = await f.request(route, options);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { method, ok: true });
  }
  assert.deepEqual(f.calls, [
    {
      method: 'list',
      args: [{ query: 'Документ', section: 'W01', tag: 'T47', page: 2, pageSize: 20 }],
    },
    { method: 'history', args: [{ page: 3, pageSize: 10 }] },
    { method: 'status', args: [] },
    { method: 'preview', args: [previewBody, 'admin-subject'] },
    { method: 'apply', args: [{ previewId: 'preview-one', confirmed: true }, 'admin-login'] },
    { method: 'previewRollback', args: ['operation-one', 'admin'] },
    { method: 'recover', args: [{ operationId: 'operation-one', confirmed: true }, 'recoverer'] },
  ]);
});

test('invalid query arrays, objects, unknown fields and mutation envelopes never reach the service', async t => {
  const f = await fixture(t);
  for (const route of [
    '/bindings?section=W01&section=W02',
    '/bindings?section[id]=W01',
    '/bindings?page=0',
    '/bindings?pageSize=2.5',
    '/bindings?ids=all',
    '/history?tag=T01',
    '/status?ignorePending=true',
    '/export?tag=T01&tag=T02',
    '/export?tag[id]=T01',
    '/export?page=1',
  ]) {
    const response = await f.request(route);
    assert.equal(response.status, 400, route);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await response.json()).code, 'INVALID_TAXONOMY_BULK_REQUEST');
  }
  for (const [route, body] of [
    ['/preview', { ...previewBody, actor: 'forged-admin' }],
    ['/preview', { ids: ['document-one'] }],
    ['/preview', []],
    ['/apply', { previewId: 'preview-one', confirmed: true, ids: ['another'] }],
    ['/apply', { confirmed: true }],
    ['/recover', { operationId: 'operation-one', confirmed: true, action: {} }],
    ['/history/operation-one/rollback-preview', { confirmed: true }],
  ]) {
    const response = await f.request(route, { method: 'POST', body });
    assert.equal(response.status, 400, route);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    await response.arrayBuffer();
  }
  assert.deepEqual(f.calls, []);
});

test('domain validation, access, conflict and storage errors preserve status, code and safe details', async t => {
  const f = await fixture(t);
  t.mock.method(console, 'error', () => {});
  for (const status of [400, 403, 409, 500]) {
    const error = new InstructionEditorError('Операция отклонена', {
      status,
      code: 'TEST_FAILURE',
    });
    error.details = { documents: 2 };
    f.service.preview = () => {
      throw error;
    };
    const response = await f.request('/preview', { method: 'POST', body: previewBody });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
      error: 'Операция отклонена',
      code: 'TEST_FAILURE',
      details: { documents: 2 },
    });
  }
});

test('export is a private UTF-8 CSV attachment from the explicitly injected provider', async t => {
  const f = await fixture(t);
  const response = await f.request('/export?section=office&tag=slesar&query=Название');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('content-type'), /^text\/csv; charset=utf-8$/u);
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="instruction-taxonomy-published.csv"',
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.deepEqual(f.calls, [
    { method: 'export', args: [{ query: 'Название', section: 'office', tag: 'slesar' }] },
  ]);
});

test('application gives operations requests the existing 2 MB admin JSON limit before the generic parser', async t => {
  const { createApp } = await import('../src/app.js');
  const base = await listen(t, createApp());
  const response = await fetch(`${base}/api/admin/instruction-taxonomy-operations/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...previewBody, ids: ['x'.repeat(150_000)] }),
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  await response.arrayBuffer();
  const tooLarge = await fetch(`${base}/api/admin/instruction-taxonomy-operations/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...previewBody, ids: ['x'.repeat(2_100_000)] }),
  });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.headers.get('cache-control'), 'private, no-store');
  await tooLarge.arrayBuffer();
  const malformed = await fetch(`${base}/api/admin/instruction-taxonomy-operations/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get('cache-control'), 'private, no-store');
  await malformed.arrayBuffer();
});
