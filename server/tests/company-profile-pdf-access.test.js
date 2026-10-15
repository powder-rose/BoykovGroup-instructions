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
    headFullName: 'Покупателев Павел Петрович',
  },
};

function replaceExactly(source, before, after) {
  assert.ok(source.includes(before), `Fixture source declaration changed: ${before}`);
  return source.replace(before, after);
}

async function fixture(t) {
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
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.use('/api/instructions', instructionPdfRouter);
  app.use('/api/public-generation', publicGenerationRouter);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const request = (url, { userId = 'a', token, headers = {} } = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      headers: {
        ...(userId === null
          ? {}
          : {
              Authorization: `Bearer ${token ?? issueUserToken({ id: userId, email: `${userId}@example.test` })}`,
            }),
        ...headers,
      },
    });
  return { request, store, users, orders, repository };
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
  const { request, store, users, orders, repository } = await fixture(t);
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
});
