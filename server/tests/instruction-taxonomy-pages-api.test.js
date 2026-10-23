import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import test from 'node:test';

import express from 'express';

import { createApp } from '../src/app.js';
import { createInstructionTaxonomyRouter } from '../src/routes/instructionTaxonomy.js';
import { InstructionEditorError } from '../src/services/instructionEditorError.js';

const origin = 'https://catalog.example';
const pathname = '/instrukcii-po-ohrane-truda/po-vidam-rabot/';

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

function provider() {
  const calls = [];
  const navigation = { revision: 3, root: null, catalogs: [], tags: [] };
  const page = { code: 'H02', name: 'По видам работ', path: pathname, items: [] };
  const state = { resolution: { status: 200, page } };
  const service = {
    snapshot() {
      calls.push({ method: 'snapshot' });
      return {
        navigation(value) {
          calls.push({ method: 'navigation', origin: value });
          return navigation;
        },
        resolve(path, query, value) {
          calls.push({ method: 'resolve', path, query, origin: value });
          return state.resolution;
        },
      };
    },
  };
  return { calls, navigation, page, state, service };
}

async function fixture(t) {
  const f = provider();
  const app = express();
  app.set('query parser', 'extended');
  app.use('/taxonomy', createInstructionTaxonomyRouter({ service: f.service, origin }));
  const base = await listen(t, app);
  return {
    ...f,
    request(route, options) {
      return fetch(`${base}/taxonomy${route}`, options);
    },
  };
}

function assertPrivateApi(response) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(response.headers.get('content-type'), /^application\/json/u);
}

test('public navigation and page requests use exactly one injected snapshot and a configured origin', async t => {
  const f = await fixture(t);
  const headers = { Host: 'untrusted.example', 'X-Forwarded-Host': 'forwarded.example' };
  const navigation = await f.request('/navigation', { headers });
  assert.equal(navigation.status, 200);
  assertPrivateApi(navigation);
  assert.deepEqual(await navigation.json(), f.navigation);

  const page = await f.request(
    `/page?${new URLSearchParams({ path: pathname, q: 'Работы', sort: 'newest', page: '2', utm_source: 'newsletter' })}`,
    { headers },
  );
  assert.equal(page.status, 200);
  assertPrivateApi(page);
  assert.deepEqual(await page.json(), f.page);
  assert.deepEqual(f.calls, [
    { method: 'snapshot' },
    { method: 'navigation', origin },
    { method: 'snapshot' },
    {
      method: 'resolve',
      path: pathname,
      query: { q: 'Работы', sort: 'newest', page: '2', utm_source: 'newsletter' },
      origin,
    },
  ]);
});

test('page aliases return a JSON redirect target without redirecting the API request to HTML', async t => {
  const f = await fixture(t);
  f.state.resolution = { status: 301, location: `${pathname}?q=работы` };
  const response = await f.request(`/page?${new URLSearchParams({ path: pathname.slice(0, -1) })}`);
  assert.equal(response.status, 200);
  assertPrivateApi(response);
  assert.equal(response.headers.get('location'), null);
  assert.deepEqual(await response.json(), { redirect: `${pathname}?q=работы` });
});

test('unpublished and absent pages have the same safe nonindexable not-found response', async t => {
  const f = await fixture(t);
  f.state.resolution = { status: 404, privateDraft: 'PRIVATE_DRAFT_METADATA' };
  const response = await f.request(`/page?${new URLSearchParams({ path: pathname })}`);
  assert.equal(response.status, 404);
  assertPrivateApi(response);
  assert.deepEqual(await response.json(), {
    error: 'Страница не найдена',
    code: 'TAXONOMY_PAGE_NOT_FOUND',
  });
});

test('query arrays, objects and malformed page paths are rejected before reading a snapshot', async t => {
  const f = await fixture(t);
  for (const route of [
    '/navigation?refresh=true',
    '/page',
    '/page?path=',
    '/page?path=https://external.example/catalog',
    '/page?path=//external.example/catalog',
    '/page?path=%2Fcatalog%3Fpage%3D2',
    '/page?path=%2Fcatalog%23fragment',
    '/page?path=%2Fcatalog%5Csection',
    '/page?path=%2Fcatalog%00',
    `/page?${new URLSearchParams({ path: pathname })}&path=/another`,
    `/page?${new URLSearchParams({ path: pathname })}&q=one&q=two`,
    `/page?${new URLSearchParams({ path: pathname })}&q[term]=one`,
    `/page?${new URLSearchParams({ path: pathname })}&page[]=2`,
    `/page?${new URLSearchParams({ path: pathname })}&tracking[key]=value`,
  ]) {
    const response = await f.request(route);
    assert.equal(response.status, 400, route);
    assertPrivateApi(response);
    assert.equal((await response.json()).code, 'INVALID_TAXONOMY_PUBLIC_QUERY');
  }
  assert.deepEqual(f.calls, []);
});

test('validation errors retain their status while storage and unexpected failures never expose internals', async t => {
  const f = await fixture(t);
  t.mock.method(console, 'error', () => {});
  const failures = [
    new InstructionEditorError('Некорректная страница списка', {
      status: 400,
      code: 'INVALID_TAXONOMY_PUBLIC_QUERY',
    }),
    new InstructionEditorError('PRIVATE /server/data/taxonomy.json', {
      status: 500,
      code: 'PRIVATE_STORAGE_CODE',
    }),
    new Error('PRIVATE_TOKEN_AND_PATH'),
  ];
  for (const [index, error] of failures.entries()) {
    f.service.snapshot = () => {
      throw error;
    };
    const response = await f.request('/navigation');
    assert.equal(response.status, index === 0 ? 400 : 500);
    assertPrivateApi(response);
    assert.deepEqual(
      await response.json(),
      index === 0
        ? { error: 'Некорректная страница списка', code: 'INVALID_TAXONOMY_PUBLIC_QUERY' }
        : { error: 'Не удалось загрузить структуру каталога', code: 'TAXONOMY_PUBLIC_ERROR' },
    );
  }
});

test('application mounts the taxonomy API with an isolated public service provider', async t => {
  const f = provider();
  const base = await listen(t, createApp({ taxonomyPublicService: f.service }));
  const response = await fetch(`${base}/api/instruction-taxonomy/navigation`, {
    headers: { Host: 'untrusted.example' },
  });
  assert.equal(response.status, 200);
  assertPrivateApi(response);
  assert.deepEqual(await response.json(), f.navigation);
  assert.deepEqual(f.calls, [
    { method: 'snapshot' },
    { method: 'navigation', origin: process.env.SITE_URL || 'https://boykovdocs.ru' },
  ]);

  const malformed = await fetch(`${base}/api/instruction-taxonomy/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assertPrivateApi(malformed);
  await malformed.arrayBuffer();
  assert.equal(f.calls.length, 2);
});

test('deployment proxies deep taxonomy URLs before static fallback and retains existing instruction routes', () => {
  const config = fs.readFileSync(
    new URL('../../deploy/nginx/default.conf', import.meta.url),
    'utf8',
  );
  const deep = config.match(/location\s+\^~\s+\/instrukcii-po-ohrane-truda\/\s*\{([^}]+)\}/u);
  assert.ok(deep);
  assert.match(deep[1], /proxy_pass\s+http:\/\/api:4000;/u);
  assert.doesNotMatch(deep[1], /try_files/u);
  assert.match(config, /location\s+=\s+\/instrukcii-po-ohrane-truda\s*\{/u);
  assert.match(config, /location\s+\^~\s+\/instrukciya-po-ohrane-truda\/\s*\{/u);
});
