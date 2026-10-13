import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createApp } from '../src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const repositoryRoot = path.resolve(__dirname, '../..');

async function startTestServer() {
  const app = createApp({
    clientOrigin: 'http://localhost:5173',
  });

  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();

  return {
    app,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  if (!server?.listening) {
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
}

function productionProxyHeaders(attempt = 1) {
  return {
    /*
     * Production topology as seen by Node:
     *
     * leftmost attacker-controlled value is ignored,
     * 203.0.113.50 is the real client,
     * 10.0.0.2 is the trusted system nginx hop,
     * and the Docker nginx socket is the direct peer.
     */
    'X-Forwarded-For': `198.51.100.${attempt}, 203.0.113.50, 10.0.0.2`,
  };
}

test('Express trusts exactly two production proxy hops', () => {
  const app = createApp({
    clientOrigin: 'http://localhost:5173',
  });

  assert.equal(app.get('trust proxy'), 2, 'BoykovDocs runs behind system nginx and Docker nginx');
});

test('system nginx replaces untrusted client X-Forwarded-For', () => {
  const config = fs.readFileSync(
    path.join(repositoryRoot, 'deploy', 'system-nginx', 'boykovdocs.ru'),
    'utf8',
  );

  assert.match(
    config,
    /proxy_set_header\s+X-Forwarded-For\s+\$remote_addr\s*;/u,
    'edge nginx must replace X-Forwarded-For with the real socket client address',
  );

  assert.doesNotMatch(
    config,
    /proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for\s*;/u,
    'edge nginx must not preserve an attacker-supplied X-Forwarded-For chain',
  );
});

test('forged leftmost X-Forwarded-For values cannot bypass the login limiter', async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const statuses = [];

    let finalResponse = null;

    for (let attempt = 1; attempt <= 11; attempt += 1) {
      finalResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          ...productionProxyHeaders(attempt),
        },

        body: JSON.stringify({
          login: 'rate-limit-probe@example.invalid',
          password: 'definitely-wrong-password',
        }),
      });

      statuses.push(finalResponse.status);
    }

    assert.deepEqual(
      statuses.slice(0, 10),
      Array(10).fill(401),
      'first ten failed login attempts should reach authentication',
    );

    assert.equal(statuses[10], 429, 'eleventh failed login attempt must be rate limited');

    assert.ok(
      finalResponse.headers.get('ratelimit'),
      '429 response should expose a standard RateLimit header',
    );

    assert.ok(finalResponse.headers.get('retry-after'), '429 response should expose Retry-After');

    const body = await finalResponse.json();

    assert.equal(body.code, 'RATE_LIMITED');
  } finally {
    await closeServer(server);
  }
});

test('registration endpoint is bounded per client IP', async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const statuses = [];

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          ...productionProxyHeaders(attempt),
        },

        /*
         * Deliberately invalid request:
         * it exercises the limiter without creating users.
         */
        body: JSON.stringify({}),
      });

      statuses.push(response.status);
    }

    assert.deepEqual(statuses.slice(0, 5), Array(5).fill(400));

    assert.equal(statuses[5], 429);
  } finally {
    await closeServer(server);
  }
});

test('payment confirmation endpoint has a bounded verification budget', async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const statuses = [];

    for (let attempt = 1; attempt <= 21; attempt += 1) {
      const response = await fetch(
        `${baseUrl}/api/public-generation/orders/pg_rate_limit_probe/confirm-payment`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'x-order-token': 'invalid-token',
            ...productionProxyHeaders(attempt),
          },

          body: JSON.stringify({
            transactionId: '1',
          }),
        },
      );

      statuses.push(response.status);
    }

    assert.deepEqual(statuses.slice(0, 20), Array(20).fill(404));

    assert.equal(statuses[20], 429);
  } finally {
    await closeServer(server);
  }
});
