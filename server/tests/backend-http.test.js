import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { createApp } from '../src/app.js';
import { importsRouter } from '../src/routes/imports.js';
import { issueAdminToken } from '../src/services/authService.js';
import {
  createImport,
  removeImport,
  updateImportFile,
} from '../src/services/importHistoryService.js';

const TEST_JWT_SECRET = 'boykovdocs-backend-http-test-only-jwt-secret-7f4f3f70';

let previousJwtSecret;

let server = null;
let baseUrl = '';

before(async () => {
  previousJwtSecret = process.env.JWT_SECRET;

  process.env.JWT_SECRET = TEST_JWT_SECRET;

  const app = createApp({
    clientOrigin: 'http://localhost:5173',
  });

  server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);

    server.once('error', reject);
  });

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  } finally {
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  }
});

test('GET /api/health returns healthy API status', async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.ok, true);

  assert.equal(typeof body.yandexGptConfigured, 'boolean');

  assert.equal(typeof body.adminConfigured, 'boolean');
});

test('unknown API route returns real 404', async () => {
  const response = await fetch(`${baseUrl}/api/__missing_route__`);

  assert.equal(response.status, 404);

  const body = await response.json();

  assert.deepEqual(body, {
    error: 'Маршрут не найден',
  });
});

test('configured frontend origin is allowed by CORS', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'http://localhost:5173',
    },
  });

  assert.equal(response.status, 200);

  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('taxonomy administration is mounted with bearer auth and the rich-text JSON size limit', async () => {
  const endpoint = `${baseUrl}/api/admin/instruction-taxonomy`;
  const unauthorized = await fetch(endpoint);
  assert.equal(unauthorized.status, 401);
  await unauthorized.arrayBuffer();

  const headers = {
    Authorization: `Bearer ${issueAdminToken()}`,
    'Content-Type': 'application/json',
  };
  const response = await fetch(endpoint, { headers });
  assert.equal(response.status, 200);
  const { registry } = await response.json();
  assert.equal(Array.isArray(registry.sections), true);
  assert.equal(Number.isSafeInteger(registry.revision), true);
  assert.equal(Object.hasOwn(registry, 'legacyCatalog'), false);

  const large = await fetch(`${endpoint}/root`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ expectedRevision: 0, entity: { name: 'x'.repeat(150_000) } }),
  });
  assert.equal(large.status, 400);
  assert.equal((await large.json()).code, 'INVALID_INSTRUCTION_TAXONOMY_REGISTRY');

  const malformed = await fetch(`${endpoint}/root`, {
    method: 'POST',
    headers,
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'Некорректный JSON в запросе');

  const oversized = await fetch(`${endpoint}/root`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ expectedRevision: 0, entity: { name: 'x'.repeat(2_100_000) } }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error, 'Текст превышает допустимый размер запроса');
});

test('POST /api/imports/:id/retry does not register duplicate retry routes', async () => {
  const importTask = createImport([
    {
      originalname: 'missing-retry-test.docx',
    },
  ]);

  const file = importTask.files[0];

  updateImportFile(importTask.id, file.id, {
    status: 'failed',
    error: 'test failure',
  });

  const countRetryRoutes = () =>
    importsRouter.stack.filter(
      layer => layer.route?.path === '/:id/retry' && layer.route.methods?.post,
    ).length;

  const retryRoutesBefore = countRetryRoutes();

  try {
    const response = await fetch(
      `${baseUrl}/api/imports/${encodeURIComponent(importTask.id)}/retry`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${issueAdminToken()}`,
        },
      },
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.message, 'Повторная обработка завершена');
    assert.equal(body.count, 1);

    assert.equal(
      countRetryRoutes(),
      retryRoutesBefore,
      'retry request must not register another Express route',
    );
  } finally {
    removeImport(importTask.id);
  }
});
