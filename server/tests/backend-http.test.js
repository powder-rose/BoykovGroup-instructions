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

let server = null;
let baseUrl = '';

before(async () => {
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
  if (!server || !server.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
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
