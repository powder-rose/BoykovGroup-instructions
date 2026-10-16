import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';

import { attachUser } from '../src/middleware/auth.js';
import { issueAdminToken, issueUserToken } from '../src/services/authService.js';
import { createCompanyProfileRepository } from '../src/services/companyProfileRepository.js';

const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const jwtSecret = 'company-profile-pdf-access-isolated-test-secret-2026';

const sharedInstruction = {
  id: 'shared-instruction',
  slug: 'shared-instruction',
  title: 'Общая инструкция для работника',
  webIntro: 'WEB_INTRO_NOT_IN_PDF',
  editorialMeta: { seoAuthor: 'EDITOR_PRIVATE_NAME' },
  instructionContent: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'SHARED_DOCUMENT_TEXT Проверить рабочее место.' }],
      },
    ],
  },
};

const privateInstruction = {
  id: 'private-instruction',
  title: 'Личная оплаченная инструкция',
  intro: 'PRIVATE_DOCUMENT_TEXT Проверить оборудование.',
  sections: [{ number: 1, heading: 'Общие требования', paragraphs: ['Надеть защитные очки.'] }],
};

const profiles = {
  a: {
    companyName: 'ООО «Компания Альфа»',
    inn: '7701234567',
    headPosition: 'Руководитель Альфа',
    headFullName: 'Альфов Алексей Алексеевич',
    occupationalSafetyPosition: 'Специалист Альфа',
    occupationalSafetyFullName: 'Альфина Анна Андреевна',
  },
  b: {
    companyName: 'ООО «Компания Бета»',
    inn: '7812345678',
    headPosition: 'Руководитель Бета',
    headFullName: 'Бетов Борис Борисович',
    occupationalSafetyPosition: 'Специалист Бета',
    occupationalSafetyFullName: 'Бетова Белла Борисовна',
  },
  unverified: {
    companyName: 'ООО «Компания покупателя»',
    inn: '5001234567',
    headPosition: 'Руководитель покупателя',
    headFullName: 'Покупателев Павел Петрович',
  },
};

function replaceExactly(source, before, after) {
  assert.ok(source.includes(before), `Fixture source declaration changed: ${before}`);
  return source.replace(before, after);
}

async function fixture(t, { pdfFailure = false } = {}) {
  // Keep bare dependencies resolvable while every writable repository is isolated.
  const root = fs.mkdtempSync(path.join(serverRoot, 'boykovdocs-company-pdf-access-'));
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = jwtSecret;
  let server;
  t.after(async () => {
    if (server) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    fs.rmSync(root, { recursive: true, force: true });
  });

  function stub(name, source) {
    const filename = path.join(root, `${name}.mjs`);
    fs.writeFileSync(filename, source);
    return pathToFileURL(filename).href;
  }

  function copy(relativePath, { imports = {}, transform = value => value } = {}) {
    const original = path.join(serverRoot, 'src', relativePath);
    const source = transform(fs.readFileSync(original, 'utf8')).replace(
      /from '(\.{1,2}\/[^']+)'/gu,
      (_match, specifier) => {
        const target =
          imports[specifier] ?? pathToFileURL(path.resolve(path.dirname(original), specifier)).href;
        return `from ${JSON.stringify(target)}`;
      },
    );
    return stub(path.basename(relativePath, '.js'), source);
  }

  const dataDirectory = path.join(root, 'data');
  fs.mkdirSync(dataDirectory);
  const users = ['a', 'b', 'unverified', 'blank'].map(id => ({
    id,
    email: `${id}@example.test`,
    name: `Пользователь ${id}`,
    role: 'user',
    emailVerified: id !== 'unverified',
  }));
  fs.writeFileSync(path.join(dataDirectory, 'users.json'), JSON.stringify(users));
  const userModule = copy('services/userService.js', {
    transform: source =>
      replaceExactly(
        source,
        "const DATA_DIR = path.resolve(__dirname, '../../data');",
        `const DATA_DIR = ${JSON.stringify(dataDirectory)};`,
      ),
  });

  const profileFile = path.join(dataDirectory, 'profiles.json');
  const store = createCompanyProfileRepository({ file: profileFile });
  for (const [id, profile] of Object.entries(profiles)) {
    store.save(
      users.find(user => user.id === id),
      profile,
    );
  }
  const profileRepositoryUrl = pathToFileURL(
    path.join(serverRoot, 'src/services/companyProfileRepository.js'),
  ).href;
  // Never import/start the production SMTP worker; only the actual isolated store is read.
  const profileModule = stub(
    'profileLookup',
    `import { createCompanyProfileRepository } from ${JSON.stringify(profileRepositoryUrl)};
const store = createCompanyProfileRepository({ file: ${JSON.stringify(profileFile)} });
export function getCompanyProfile(id) { return store.getView(id).companyProfile; }
`,
  );
  const pdfProfileModule = copy('services/instructionPdfProfile.js', {
    imports: { './userService.js': userModule, './companyProfileService.js': profileModule },
  });
  const accessModule = copy('middleware/pdfAccess.js', {
    imports: { '../services/userService.js': userModule },
  });
  const repositoryModule = stub(
    'instructionsRepository',
    `export const instruction = ${JSON.stringify(sharedInstruction)};
export const instructionsRepository = {
  getById(id) { return id === instruction.id ? instruction : null; },
};
`,
  );
  const statsModule = stub('downloadStats', 'export function recordInstructionDownload() {}\n');
  const quotaFile = path.join(dataDirectory, 'download-quotas.json');
  const quotaServiceUrl = pathToFileURL(
    path.join(serverRoot, 'src/services/downloadQuotaService.js'),
  ).href;
  const quotaModule = stub(
    'downloadQuota',
    `import { createDownloadQuotaService } from ${JSON.stringify(quotaServiceUrl)};
export const downloadQuotaService = createDownloadQuotaService({
  file: ${JSON.stringify(quotaFile)},
  historyFile: ${JSON.stringify(path.join(root, 'download-events.jsonl'))},
});\n`,
  );
  const orderModule = copy('services/publicGenerationOrderService.js', {
    transform: source =>
      replaceExactly(
        source,
        "const ORDERS_DIR = path.join(__dirname, '..', 'data', 'publicGenerationOrders');",
        `const ORDERS_DIR = ${JSON.stringify(path.join(root, 'orders'))};`,
      ),
  });
  const unusedServices = stub(
    'unusedExternalServices',
    `function unexpected() { throw new Error('Unexpected external operation in PDF fixture'); }
export const queuePublicGenerationOrder = unexpected;
export const getCloudPaymentsTransaction = unexpected;
export const reservePromoCodeForOrder = unexpected;
export const releasePromoCodeReservation = unexpected;
export const markPromoCodeUsed = unexpected;
`,
  );
  const freeRouteModule = copy('routes/instructionPdf.js', {
    imports: {
      '../services/instructionsRepository.js': repositoryModule,
      '../middleware/pdfAccess.js': accessModule,
      '../services/instructionPdfProfile.js': pdfProfileModule,
      '../services/downloadStatsService.js': statsModule,
      '../services/downloadQuotaService.js': quotaModule,
      ...(pdfFailure
        ? {
            '../services/instructionPdfService.js': stub(
              'failedPdf',
              "export async function createInstructionPdfBuffer() { throw new Error('PDF test failure'); }\n",
            ),
          }
        : {}),
    },
    transform: source =>
      replaceExactly(
        source,
        "const PDF_ERROR_LOG = path.resolve(__dirname, '../../data/pdf-download-errors.log');",
        `const PDF_ERROR_LOG = ${JSON.stringify(path.join(root, 'pdf-errors.log'))};`,
      ),
  });
  const paidRouteModule = copy('routes/publicGeneration.js', {
    imports: {
      '../services/publicGenerationOrderService.js': orderModule,
      '../services/instructionsRepository.js': repositoryModule,
      '../services/instructionPdfProfile.js': pdfProfileModule,
      '../services/publicPaidGenerationService.js': unusedServices,
      '../services/cloudPaymentsApiService.js': unusedServices,
      '../services/promoCodeService.js': unusedServices,
    },
  });
  const { instructionPdfRouter } = await import(freeRouteModule);
  const { publicGenerationRouter } = await import(paidRouteModule);
  const orders = await import(orderModule);
  const repository = await import(repositoryModule);
  const { downloadQuotaService: quotaService } = await import(quotaModule);
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.use('/api/instructions', instructionPdfRouter);
  app.use('/api/public-generation', publicGenerationRouter);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const request = (url, { userId = 'a', token, headers = {}, method = 'GET' } = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers: {
        ...(userId === null
          ? {}
          : {
              Authorization: `Bearer ${token ?? issueUserToken({ id: userId, email: `${userId}@example.test` })}`,
            }),
        ...headers,
      },
    });
  return { request, store, users, orders, repository, quotaService, quotaFile };
}

async function pdfText(response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/pdf/);
  assert.match(response.headers.get('cache-control'), /private/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const parsed = await parsePdf(new Uint8Array(await response.arrayBuffer()));
  return parsed.text.replace(/\s+/gu, ' ');
}

function assertProfile(text, own, others = []) {
  for (const value of Object.values(own)) assert.ok(text.includes(value), `Missing ${value}`);
  for (const other of others) {
    for (const value of Object.values(other)) assert.ok(!text.includes(value), `Leaked ${value}`);
  }
}

test('public instruction PDFs enforce verified access and isolate fresh company profiles per download', async t => {
  const { request, store, users, repository } = await fixture(t);
  const url = '/api/instructions/shared-instruction/pdf';
  for (const [auth, status] of [
    [{ userId: null }, 401],
    [{ token: 'invalid' }, 401],
    [{ userId: 'deleted' }, 401],
    [{ userId: 'unverified' }, 403],
  ]) {
    const response = await request(url, auth);
    assert.equal(response.status, status);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    await response.arrayBuffer();
  }

  const [alphaResponse, betaResponse] = await Promise.all([
    request(url, { userId: 'a' }),
    request(url, { userId: 'b' }),
  ]);
  const alpha = await pdfText(alphaResponse);
  const beta = await pdfText(betaResponse);
  assertProfile(alpha, profiles.a, [profiles.b, profiles.unverified]);
  assertProfile(beta, profiles.b, [profiles.a, profiles.unverified]);
  for (const text of [alpha, beta]) {
    assert.ok(text.includes('SHARED_DOCUMENT_TEXT'));
    assert.ok(!text.includes('WEB_INTRO_NOT_IN_PDF'));
    assert.ok(!text.includes('EDITOR_PRIVATE_NAME'));
  }

  const updated = { ...profiles.a, companyName: 'ООО «Обновлённая Альфа»' };
  store.save(
    users.find(user => user.id === 'a'),
    updated,
  );
  const nextAlpha = await pdfText(await request(url));
  assertProfile(nextAlpha, updated, [profiles.b, profiles.unverified]);
  assert.ok(!nextAlpha.includes(profiles.a.companyName));
  assertProfile(await pdfText(await request(url, { userId: 'b' })), profiles.b, [updated]);

  for (const auth of [{ userId: 'blank' }, { token: issueAdminToken() }]) {
    const generic = await pdfText(await request(url, auth));
    assertProfile(generic, {}, [...Object.values(profiles), updated]);
    assert.ok(generic.includes('SHARED_DOCUMENT_TEXT'));
  }
  assert.deepEqual(repository.instruction, sharedInstruction, 'Shared publication is immutable');
});

test('paid PDFs remain owner-only, permit an unverified purchaser and never serialize company details', async t => {
  const { request, store, users, orders, repository, quotaService } = await fixture(t);
  for (let index = 0; index < 5; index += 1) quotaService.consume('unverified');
  const created = orders.createPublicGenerationOrder(
    'Работник',
    {},
    {
      userId: 'unverified',
      email: 'unverified@example.test',
    },
  );
  orders.updatePublicGenerationOrder(created.id, {
    status: 'completed',
    generatedInstruction: structuredClone(privateInstruction),
  });
  const originalOrder = orders.getPublicGenerationOrder(created.id);
  const url = `/api/public-generation/my-orders/${created.id}/pdf`;
  const owner = await pdfText(await request(url, { userId: 'unverified' }));
  assertProfile(owner, profiles.unverified, [profiles.a, profiles.b]);
  assert.ok(owner.includes('PRIVATE_DOCUMENT_TEXT'));

  const stranger = await request(url, { userId: 'b' });
  const missing = await request('/api/public-generation/my-orders/pg_missing_order_12345/pdf', {
    userId: 'unverified',
  });
  assert.equal(stranger.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await stranger.json(), await missing.json());
  for (const auth of [
    { userId: null },
    { token: issueAdminToken() },
    { userId: null, headers: { 'x-order-token': created.accessToken } },
  ]) {
    const response = await request(url, auth);
    assert.equal(response.status, 401);
    await response.arrayBuffer();
  }

  const updated = { ...profiles.unverified, companyName: 'ООО «Новый профиль покупателя»' };
  store.save(
    users.find(user => user.id === 'unverified'),
    updated,
  );
  const nextOwner = await pdfText(await request(url, { userId: 'unverified' }));
  assertProfile(nextOwner, updated, [profiles.a, profiles.b]);
  assert.ok(!nextOwner.includes(profiles.unverified.companyName));

  const ownerViewResponse = await request(`/api/public-generation/my-orders/${created.id}`, {
    userId: 'unverified',
  });
  assert.equal(ownerViewResponse.status, 200);
  const ownerView = await ownerViewResponse.json();
  const tokenView = orders.getPublicGenerationOrderView(created.id, created.accessToken);
  for (const view of [ownerView, tokenView]) {
    assert.deepEqual(view.instruction, privateInstruction);
    const json = JSON.stringify(view);
    assert.ok(!json.includes('companyProfile'));
    assertProfile(json, {}, [...Object.values(profiles), updated]);
  }
  assert.deepEqual(orders.getPublicGenerationOrder(created.id), originalOrder);
  assert.deepEqual(repository.instruction, sharedInstruction);

  // Published fallback must personalize for the purchaser without changing the public record.
  orders.updatePublicGenerationOrder(created.id, {
    generatedInstruction: null,
    instructionId: sharedInstruction.id,
  });
  const fallback = await pdfText(await request(url, { userId: 'unverified' }));
  assertProfile(fallback, updated, [profiles.a, profiles.b]);
  assert.ok(fallback.includes('SHARED_DOCUMENT_TEXT'));
  assert.deepEqual(repository.instruction, sharedInstruction);
  assert.equal(quotaService.get('unverified').remaining, 0);
});

test('quota endpoint returns only the current account balance without spending downloads', async t => {
  const { request, quotaService } = await fixture(t);
  quotaService.consume('a');
  quotaService.consume('a');
  const url = '/api/instructions/download-quota';

  for (const path of [url, `${url}?userId=b&remaining=5`, url]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert.deepEqual(await response.json(), { limit: 5, used: 2, remaining: 3 });
  }

  const other = await request(url, { userId: 'b' });
  assert.deepEqual(await other.json(), { limit: 5, used: 0, remaining: 5 });
  await pdfText(await request('/api/instructions/shared-instruction/pdf'));
  const afterDownload = await request(url);
  assert.deepEqual(await afterDownload.json(), { limit: 5, used: 3, remaining: 2 });

  quotaService.consume('a');
  quotaService.consume('a');
  const exhausted = await request(url);
  assert.equal(exhausted.status, 200);
  assert.deepEqual(await exhausted.json(), { limit: 5, used: 5, remaining: 0 });
});

test('quota endpoint enforces access and reports unavailable storage without limiting admins', async t => {
  const { request, quotaFile } = await fixture(t);
  const url = '/api/instructions/download-quota';
  for (const [auth, status] of [
    [{ userId: null }, 401],
    [{ token: 'invalid' }, 401],
    [{ userId: 'deleted' }, 401],
    [{ userId: 'unverified' }, 403],
  ]) {
    const response = await request(url, auth);
    assert.equal(response.status, status);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    await response.json();
  }
  assert.equal(fs.existsSync(quotaFile), false);

  fs.writeFileSync(quotaFile, 'invalid quota');
  const failed = await request(url);
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).code, 'DOWNLOAD_QUOTA_UNAVAILABLE');
  const admin = await request(url, { token: issueAdminToken() });
  assert.equal(admin.status, 200);
  assert.deepEqual(await admin.json(), { unlimited: true });
});

test('catalog quota allows exactly five downloads across concurrent requests, instructions and sessions', async t => {
  const { request, quotaService, repository } = await fixture(t);
  const url = '/api/instructions/shared-instruction/pdf';
  const responses = await Promise.all(Array.from({ length: 10 }, () => request(url)));
  const downloads = responses.filter(response => response.status === 200);
  const blocked = responses.filter(response => response.status === 403);
  assert.equal(downloads.length, 5);
  assert.equal(blocked.length, 5);
  assert.deepEqual(
    downloads.map(response => Number(response.headers.get('x-download-remaining'))).sort(),
    [0, 1, 2, 3, 4],
  );
  for (const response of downloads) {
    assert.equal(response.headers.get('x-download-limit'), '5');
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.ok((await response.arrayBuffer()).byteLength >= 1000);
  }
  for (const response of blocked) {
    const body = await response.json();
    assert.equal(body.code, 'DOWNLOAD_LIMIT_REACHED');
    assert.equal(body.remaining, 0);
    assert.match(body.error, /скачивания из каталога закончились/);
  }
  assert.deepEqual(quotaService.get('a'), { limit: 5, used: 5, remaining: 0 });

  repository.instruction.id = 'another-instruction';
  const anotherUrl = '/api/instructions/another-instruction/pdf';
  const newToken = issueUserToken({ id: 'a', email: 'a@example.test', name: 'New session' });
  const next = await request(anotherUrl, { token: newToken });
  assert.equal(next.status, 403);
  await next.json();
  await pdfText(await request(anotherUrl, { userId: 'b' }));
  assert.equal(quotaService.get('b').used, 1);

  for (let index = 0; index < 6; index += 1) {
    const admin = await request(anotherUrl, { token: issueAdminToken() });
    assert.equal(admin.headers.get('x-download-limit'), null);
    await pdfText(admin);
  }
});

test('denied access, missing instructions, HEAD and PDF generation failures do not spend downloads', async t => {
  const { request, quotaService } = await fixture(t, { pdfFailure: true });
  const url = '/api/instructions/shared-instruction/pdf';
  for (const [auth, status] of [
    [{ userId: null }, 401],
    [{ userId: 'unverified' }, 403],
    [{ userId: 'deleted' }, 401],
    [{ method: 'HEAD' }, 200],
    [{}, 500],
  ]) {
    const response = await request(url, auth);
    assert.equal(response.status, status);
    await response.arrayBuffer();
  }
  const missing = await request('/api/instructions/missing/pdf');
  assert.equal(missing.status, 404);
  await missing.json();
  assert.equal(quotaService.get('a').used, 0);
  assert.equal(quotaService.get('unverified').used, 0);
});

test('conditional catalog requests deliver a full PDF for the consumed download', async t => {
  const { request, quotaService } = await fixture(t);
  const response = await request('/api/instructions/shared-instruction/pdf', {
    headers: { 'If-None-Match': '*' },
  });
  await pdfText(response);
  assert.equal(quotaService.get('a').used, 1);
});

test('unreadable quota fails closed without blocking paid PDFs', async t => {
  const { request, quotaFile, orders } = await fixture(t);
  fs.writeFileSync(quotaFile, 'corrupted quota');
  const blocked = await request('/api/instructions/shared-instruction/pdf');
  assert.equal(blocked.status, 503);
  assert.equal((await blocked.json()).code, 'DOWNLOAD_QUOTA_UNAVAILABLE');

  const order = orders.createPublicGenerationOrder(
    'Работник',
    {},
    {
      userId: 'a',
      email: 'a@example.test',
    },
  );
  orders.updatePublicGenerationOrder(order.id, {
    status: 'completed',
    generatedInstruction: structuredClone(privateInstruction),
  });
  await pdfText(await request(`/api/public-generation/my-orders/${order.id}/pdf`));
});
