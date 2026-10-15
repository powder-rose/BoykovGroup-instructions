import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const promoServicePath = path.join(serverRoot, 'src', 'services', 'promoCodeService.js');

function loadIsolatedPromoService() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-promo-reservation-'));

  const dataFile = path.join(directory, 'promoCodes.json');

  const modulePath = path.join(directory, 'promoCodeService.mjs');

  const originalSource = fs.readFileSync(promoServicePath, 'utf8');

  const dataFileDeclaration =
    "const DATA_FILE = path.join(__dirname, '..', 'data', 'promoCodes.json');";

  if (!originalSource.includes(dataFileDeclaration)) {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });

    throw new Error('promoCodeService DATA_FILE declaration changed unexpectedly');
  }

  const isolatedSource = originalSource.replace(
    dataFileDeclaration,
    `const DATA_FILE = ${JSON.stringify(dataFile)};`,
  );

  fs.writeFileSync(modulePath, isolatedSource, 'utf8');

  return {
    directory,
    dataFile,
    moduleUrl: pathToFileURL(modulePath).href + `?test=${crypto.randomUUID()}`,
  };
}

async function withIsolatedPromoService(callback) {
  const isolated = loadIsolatedPromoService();

  try {
    const service = await import(isolated.moduleUrl);

    return await callback({
      service,
      dataFile: isolated.dataFile,
    });
  } finally {
    fs.rmSync(isolated.directory, {
      recursive: true,
      force: true,
    });
  }
}

function futureExpiry(milliseconds = 60_000) {
  return new Date(Date.now() + milliseconds).toISOString();
}

/*
 * On the vulnerable implementation there is no reservation API,
 * so this deliberately falls back to the existing resolve-only
 * order-creation behavior.
 *
 * After the fix, the same regression exercises the real
 * reservation operation instead.
 */
function reserveLikeOrderCreation(service, code, originalAmount, expiresAt) {
  if (typeof service.reservePromoCodeForOrder === 'function') {
    return service.reservePromoCodeForOrder(code, originalAmount, {
      expiresAt,
    });
  }

  return service.resolvePromoCode(code, originalAmount);
}

test('maxUses=1 blocks a second pending promo reservation', async () => {
  await withIsolatedPromoService(async ({ service }) => {
    service.createPromoCode({
      code: 'LIMIT1',
      type: 'fixed_price',
      value: 1,
      maxUses: 1,
      active: true,
    });

    const first = reserveLikeOrderCreation(service, 'LIMIT1', 500, futureExpiry());

    assert.equal(first.ok, true, 'first pending order should obtain the promo');

    const second = reserveLikeOrderCreation(service, 'LIMIT1', 500, futureExpiry());

    assert.equal(
      second.ok,
      false,
      'second pending order must not obtain the same final promo slot',
    );

    assert.equal(second.code, 'PROMO_LIMIT_REACHED');
  });
});

test('an expired promo reservation releases quota', async () => {
  await withIsolatedPromoService(async ({ service }) => {
    assert.equal(
      typeof service.reservePromoCodeForOrder,
      'function',
      'promo service must expose an order reservation operation',
    );

    service.createPromoCode({
      code: 'EXPIRE1',
      type: 'fixed_price',
      value: 10,
      maxUses: 1,
      active: true,
    });

    const first = service.reservePromoCodeForOrder('EXPIRE1', 500, {
      expiresAt: futureExpiry(25),
    });

    assert.equal(first.ok, true);

    await new Promise(resolve => setTimeout(resolve, 60));

    const second = service.reservePromoCodeForOrder('EXPIRE1', 500, {
      expiresAt: futureExpiry(),
    });

    assert.equal(second.ok, true, 'expired reservation must stop consuming quota');
  });
});

test('committing a promo reservation is idempotent', async () => {
  await withIsolatedPromoService(async ({ service }) => {
    assert.equal(typeof service.reservePromoCodeForOrder, 'function');

    assert.equal(typeof service.markPromoCodeUsed, 'function');

    service.createPromoCode({
      code: 'COMMIT1',
      type: 'fixed_price',
      value: 10,
      maxUses: 1,
      active: true,
    });

    const reservation = service.reservePromoCodeForOrder('COMMIT1', 500, {
      expiresAt: futureExpiry(),
    });

    assert.equal(reservation.ok, true);

    assert.ok(
      reservation.promo?.reservationId,
      'reservation must expose a non-empty reservationId',
    );

    const { id: promoId, reservationId } = reservation.promo;

    assert.equal(service.markPromoCodeUsed(promoId, 'order-a', reservationId), true);

    /*
     * Payment callbacks can legitimately repeat.
     * The second commit must not increment usedCount again.
     */
    assert.equal(service.markPromoCodeUsed(promoId, 'order-a', reservationId), true);

    const items = service.listPromoCodes();

    assert.equal(items.length, 1);

    assert.equal(
      items[0].usedCount,
      1,
      'repeated payment confirmation must not consume promo twice',
    );

    const another = service.reservePromoCodeForOrder('COMMIT1', 500, {
      expiresAt: futureExpiry(),
    });

    assert.equal(another.ok, false);

    assert.equal(another.code, 'PROMO_LIMIT_REACHED');
  });
});

test('explicitly releasing a promo reservation frees quota', async () => {
  await withIsolatedPromoService(async ({ service }) => {
    assert.equal(typeof service.releasePromoCodeReservation, 'function');

    service.createPromoCode({
      code: 'RELEASE1',
      type: 'fixed_price',
      value: 10,
      maxUses: 1,
      active: true,
    });

    const first = service.reservePromoCodeForOrder('RELEASE1', 500, {
      expiresAt: futureExpiry(),
    });

    assert.equal(first.ok, true);

    assert.equal(
      service.releasePromoCodeReservation(first.promo.id, first.promo.reservationId),
      true,
    );

    const second = service.reservePromoCodeForOrder('RELEASE1', 500, {
      expiresAt: futureExpiry(),
    });

    assert.equal(second.ok, true, 'released reservation must immediately return quota');
  });
});

async function withIsolatedOrderService(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-promo-order-'));

  const ordersDirectory = path.join(directory, 'orders');

  const modulePath = path.join(directory, 'publicGenerationOrderService.mjs');

  const sourcePath = path.join(serverRoot, 'src', 'services', 'publicGenerationOrderService.js');

  const originalSource = fs.readFileSync(sourcePath, 'utf8');

  const directoryDeclaration =
    "const ORDERS_DIR = path.join(__dirname, '..', 'data', 'publicGenerationOrders');";

  if (!originalSource.includes(directoryDeclaration)) {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });

    throw new Error('publicGenerationOrderService ORDERS_DIR declaration changed unexpectedly');
  }

  const isolatedSource = originalSource
    .replace(directoryDeclaration, `const ORDERS_DIR = ${JSON.stringify(ordersDirectory)};`)
    .replace(/from '(\.{1,2}\/[^']+)'/gu, (_match, specifier) => {
      const absolutePath = path.resolve(path.dirname(sourcePath), specifier);
      return `from '${pathToFileURL(absolutePath).href}'`;
    });

  fs.writeFileSync(modulePath, isolatedSource, 'utf8');

  try {
    const service = await import(pathToFileURL(modulePath).href + `?test=${crypto.randomUUID()}`);

    return await callback(service);
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
}

test('order snapshot persists promo reservation without exposing it publicly', async () => {
  await withIsolatedOrderService(async service => {
    const reservationId = 'promo_res_test_snapshot';

    const expiresAt = futureExpiry(2 * 60 * 1000);

    const order = service.createPublicGenerationOrder(
      'Тестовая профессия',
      {
        originalAmount: 500,

        amount: 1,

        expiresAt,

        promo: {
          id: 'promo_test_snapshot',

          code: 'SNAPSHOT1',

          type: 'fixed_price',

          value: 1,

          reservationId,
        },
      },
      {
        userId: 'user-test',

        email: 'user@example.invalid',
      },
    );

    assert.equal(order.expiresAt, expiresAt, 'order TTL must match promo reservation TTL');

    assert.equal(
      order.promo?.reservationId,
      reservationId,
      'internal order snapshot must retain reservation identity',
    );

    const stored = service.getPublicGenerationOrder(order.id);

    assert.equal(
      stored?.promo?.reservationId,
      reservationId,
      'reservation identity must survive persistence',
    );

    const publicView = service.getPublicGenerationOrderView(order.id, order.accessToken);

    assert.ok(publicView);

    assert.equal(publicView.promo?.code, 'SNAPSHOT1');

    assert.equal(
      Object.prototype.hasOwnProperty.call(publicView.promo, 'reservationId'),
      false,
      'reservationId must remain server-side only',
    );
  });
});
