import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

import { createCompanyProfileRouter } from '../src/routes/companyProfile.js';
import { createCompanyProfileRepository } from '../src/services/companyProfileRepository.js';
import { attachUser } from '../src/middleware/auth.js';
import { issueUserToken, issueAdminToken } from '../src/services/authService.js';
import { EMPTY_COMPANY_PROFILE } from '../src/shared/companyProfile.js';

process.env.JWT_SECRET = 'company-profile-http-test-secret-not-used-in-production-2026';

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-company-profile-http-'));
  const file = path.join(directory, 'profiles.json');
  const store = createCompanyProfileRepository({ file });
  const users = new Map(
    ['a', 'b'].map(id => [
      id,
      { id, role: 'user', email: `${id}@example.com`, emailVerified: false },
    ]),
  );
  let wakes = 0;
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.use(
    '/api/account/company-profile',
    createCompanyProfileRouter({
      userLookup: id => users.get(id),
      store,
      notifier: () => {
        wakes += 1;
      },
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const request = (suffix = '', { userId = 'a', token, method = 'GET', body } = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/account/company-profile${suffix}`, {
      method,
      headers: {
        ...(userId === null
          ? {}
          : {
              authorization: `Bearer ${token ?? issueUserToken({ id: userId, email: `${userId}@example.com` })}`,
            }),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { request, users, store, file, wakes: () => wakes };
}

test('profile routes reject guest, admin, invalid and stale JWT on every endpoint', async t => {
  const { request, file } = await fixture(t);
  for (const auth of [
    { userId: null },
    { token: issueAdminToken() },
    { token: 'invalid' },
    { userId: 'deleted' },
  ]) {
    for (const [suffix, method] of [
      ['', 'GET'],
      ['', 'PUT'],
      ['/dismiss', 'POST'],
    ]) {
      const response = await request(suffix, {
        ...auth,
        method,
        body: method === 'PUT' ? { companyProfile: { companyName: 'No' } } : undefined,
      });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      await response.arrayBuffer();
    }
  }
  assert.equal(fs.existsSync(file), false);
});

test('unverified real accounts save optional details, while request identity cannot cross accounts', async t => {
  const { request, store, wakes } = await fixture(t);
  const response = await request('', {
    method: 'PUT',
    body: {
      userId: 'b',
      companyProfile: { companyName: 'ООО Первая', inn: '1234567890', userId: 'b' },
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('vary'), /Authorization/);
  const saved = await response.json();
  assert.equal(saved.companyProfile.companyName, 'ООО Первая');
  assert.equal(saved.companyProfile.userId, undefined);
  assert.ok(saved.updatedAt);
  assert.ok(saved.onboardingCompletedAt);
  assert.equal(wakes(), 1);
  assert.deepEqual(store.getView('b').companyProfile, EMPTY_COMPANY_PROFILE);

  const other = await request('', { userId: 'b' });
  assert.deepEqual((await other.json()).companyProfile, EMPTY_COMPANY_PROFILE);
  const reloaded = await request();
  assert.deepEqual(await reloaded.json(), saved);
  const dismissed = await request('/dismiss', {
    method: 'POST',
    body: { companyProfile: { companyName: 'Ignored' } },
  });
  assert.deepEqual(await dismissed.json(), saved);
  assert.equal(wakes(), 1);
});

test('bad fields return 400 without overwriting existing profile; clearing remains supported', async t => {
  const { request, store } = await fixture(t);
  const initial = await request('', {
    method: 'PUT',
    body: { companyProfile: { headFullName: 'Петров Пётр Петрович' } },
  });
  await initial.arrayBuffer();
  for (const companyProfile of [
    undefined,
    [],
    { inn: 'bad' },
    { headFullName: 42 },
    { companyName: 'too\nlong' },
  ]) {
    const response = await request('', { method: 'PUT', body: { companyProfile } });
    assert.equal(response.status, 400);
    await response.arrayBuffer();
  }
  assert.equal(store.getView('a').companyProfile.headFullName, 'Петров Пётр Петрович');
  const cleared = await request('', { method: 'PUT', body: { companyProfile: {} } });
  assert.equal(cleared.status, 200);
  assert.deepEqual((await cleared.json()).companyProfile, EMPTY_COMPANY_PROFILE);
});
