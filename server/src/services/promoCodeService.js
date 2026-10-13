import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_FILE = path.join(__dirname, '..', 'data', 'promoCodes.json');

function ensureStorage() {
  fs.mkdirSync(path.dirname(DATA_FILE), {
    recursive: true,
  });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]\n', 'utf8');
  }
}

function readAll() {
  ensureStorage();

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[PromoCodes] read error:', error);

    return [];
  }
}

function writeAll(items) {
  ensureStorage();

  const temp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;

  fs.writeFileSync(temp, JSON.stringify(items, null, 2) + '\n', 'utf8');

  fs.renameSync(temp, DATA_FILE);
}

function normalizeCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function createId() {
  return 'promo_' + Date.now().toString(36) + '_' + crypto.randomBytes(6).toString('hex');
}

function createReservationId() {
  return 'promo_res_' + Date.now().toString(36) + '_' + crypto.randomBytes(12).toString('hex');
}

function normalizeType(value) {
  return value === 'percent' ? 'percent' : 'fixed_price';
}

function normalizeMaxUses(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function normalizeExpiresAt(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function activeReservations(item, nowMs = Date.now()) {
  const source = Array.isArray(item?.reservations) ? item.reservations : [];

  return source.filter(reservation => {
    const id = String(reservation?.id ?? '').trim();

    const expiresAt = Date.parse(String(reservation?.expiresAt ?? ''));

    return Boolean(id) && Number.isFinite(expiresAt) && expiresAt > nowMs;
  });
}

function cleanExpiredReservations(item, nowMs = Date.now()) {
  const source = Array.isArray(item?.reservations) ? item.reservations : [];

  const active = activeReservations(item, nowMs);

  return {
    item: {
      ...item,
      reservations: active,
    },

    reservations: active,

    changed: Array.isArray(item?.reservations) && source.length !== active.length,
  };
}

function hasAvailableQuota(item, reservations) {
  if (item.maxUses === null || item.maxUses === undefined) {
    return true;
  }

  const maxUses = Number(item.maxUses);

  const usedCount = Number(item.usedCount ?? 0);

  return usedCount + reservations.length < maxUses;
}

function resolvePricingForItem(item, originalAmount, reservations) {
  if (!item || item.active !== true) {
    return {
      ok: false,

      code: 'PROMO_INVALID',

      error: 'Промокод не найден или отключён',
    };
  }

  if (item.expiresAt && Date.now() > new Date(item.expiresAt).getTime()) {
    return {
      ok: false,

      code: 'PROMO_EXPIRED',

      error: 'Срок действия промокода истёк',
    };
  }

  if (!hasAvailableQuota(item, reservations)) {
    return {
      ok: false,

      code: 'PROMO_LIMIT_REACHED',

      error: 'Лимит использований промокода исчерпан',
    };
  }

  const base = Number(originalAmount);

  let amount = base;

  if (item.type === 'percent') {
    amount = base * (1 - Number(item.value) / 100);
  } else {
    amount = Number(item.value);
  }

  amount = Math.round(amount * 100) / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,

      code: 'PROMO_PRICE_INVALID',

      error: 'Промокод формирует некорректную стоимость',
    };
  }

  if (amount > base) {
    return {
      ok: false,

      code: 'PROMO_PRICE_INVALID',

      error: 'Стоимость по промокоду не может быть выше обычной',
    };
  }

  return {
    ok: true,

    promo: {
      id: item.id,

      code: item.code,

      type: item.type,

      value: item.value,
    },

    originalAmount: base,

    amount,

    discountAmount: Math.round((base - amount) * 100) / 100,
  };
}

function publicPromoView(item) {
  return {
    id: item.id,

    code: item.code,

    type: item.type,

    value: item.value,

    active: item.active === true,

    maxUses: item.maxUses ?? null,

    usedCount: Number(item.usedCount ?? 0),

    expiresAt: item.expiresAt ?? null,

    createdAt: item.createdAt,

    updatedAt: item.updatedAt,

    lastUsedAt: item.lastUsedAt ?? null,
  };
}

export function listPromoCodes() {
  return readAll()
    .map(publicPromoView)
    .sort((left, right) =>
      String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
    );
}

export function createPromoCode(input = {}) {
  const code = normalizeCode(input.code);

  if (!/^[A-Z0-9_-]{2,40}$/u.test(code)) {
    throw new Error('Промокод должен содержать 2–40 символов: A-Z, 0-9, _ или -');
  }

  const items = readAll();

  if (items.some(item => normalizeCode(item.code) === code)) {
    throw new Error('Такой промокод уже существует');
  }

  const type = normalizeType(input.type);

  const value = Number(input.value);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Укажите корректное значение скидки');
  }

  if (type === 'percent' && value >= 100) {
    throw new Error('Процент скидки должен быть меньше 100');
  }

  const now = new Date().toISOString();

  const item = {
    id: createId(),

    code,

    type,

    value,

    active: input.active !== false,

    maxUses: normalizeMaxUses(input.maxUses),

    usedCount: 0,

    usedOrderIds: [],

    reservations: [],

    expiresAt: normalizeExpiresAt(input.expiresAt),

    createdAt: now,

    updatedAt: now,

    lastUsedAt: null,
  };

  items.push(item);

  writeAll(items);

  return publicPromoView(item);
}

export function updatePromoCode(id, patch = {}) {
  const items = readAll();

  const index = items.findIndex(item => item.id === id);

  if (index < 0) {
    return null;
  }

  const cleaned = cleanExpiredReservations(items[index]);

  const current = cleaned.item;

  let code = current.code;

  if (patch.code !== undefined) {
    code = normalizeCode(patch.code);

    if (!/^[A-Z0-9_-]{2,40}$/u.test(code)) {
      throw new Error('Некорректный промокод');
    }

    const duplicate = items.some(item => item.id !== id && normalizeCode(item.code) === code);

    if (duplicate) {
      throw new Error('Такой промокод уже существует');
    }
  }

  const type = patch.type !== undefined ? normalizeType(patch.type) : current.type;

  const value = patch.value !== undefined ? Number(patch.value) : Number(current.value);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Некорректное значение скидки');
  }

  if (type === 'percent' && value >= 100) {
    throw new Error('Процент скидки должен быть меньше 100');
  }

  const maxUses = patch.maxUses !== undefined ? normalizeMaxUses(patch.maxUses) : current.maxUses;

  if (
    maxUses !== null &&
    maxUses !== undefined &&
    Number(current.usedCount ?? 0) + cleaned.reservations.length > Number(maxUses)
  ) {
    throw new Error(
      'Лимит нельзя установить ниже количества уже использованных и зарезервированных применений',
    );
  }

  const updated = {
    ...current,

    code,

    type,

    value,

    active: patch.active !== undefined ? patch.active === true : current.active,

    maxUses,

    expiresAt:
      patch.expiresAt !== undefined ? normalizeExpiresAt(patch.expiresAt) : current.expiresAt,

    updatedAt: new Date().toISOString(),
  };

  items[index] = updated;

  writeAll(items);

  return publicPromoView(updated);
}

export function deletePromoCode(id) {
  const items = readAll();

  const next = items.filter(item => item.id !== id);

  if (next.length === items.length) {
    return false;
  }

  writeAll(next);

  return true;
}

export function resolvePromoCode(rawCode, originalAmount) {
  const code = normalizeCode(rawCode);

  if (!code) {
    return {
      ok: false,

      code: 'PROMO_REQUIRED',

      error: 'Введите промокод',
    };
  }

  const items = readAll();

  const index = items.findIndex(promo => normalizeCode(promo.code) === code);

  if (index < 0) {
    return {
      ok: false,

      code: 'PROMO_INVALID',

      error: 'Промокод не найден или отключён',
    };
  }

  const cleaned = cleanExpiredReservations(items[index]);

  if (cleaned.changed) {
    items[index] = cleaned.item;

    writeAll(items);
  }

  return resolvePricingForItem(cleaned.item, originalAmount, cleaned.reservations);
}

/*
 * Reserve one promo application for a pending order.
 *
 * The operation is intentionally synchronous:
 * read -> quota check -> reservation write contains no await/yield,
 * so concurrent requests in the current single API process cannot
 * interleave between the quota check and the reservation write.
 */
export function reservePromoCodeForOrder(rawCode, originalAmount, options = {}) {
  const code = normalizeCode(rawCode);

  if (!code) {
    return {
      ok: false,

      code: 'PROMO_REQUIRED',

      error: 'Введите промокод',
    };
  }

  const reservationExpiresAt = normalizeExpiresAt(options.expiresAt);

  const reservationExpiryMs = Date.parse(String(reservationExpiresAt ?? ''));

  if (
    !reservationExpiresAt ||
    !Number.isFinite(reservationExpiryMs) ||
    reservationExpiryMs <= Date.now()
  ) {
    return {
      ok: false,

      code: 'PROMO_RESERVATION_INVALID',

      error: 'Не удалось зарезервировать промокод для заказа',
    };
  }

  const items = readAll();

  const index = items.findIndex(promo => normalizeCode(promo.code) === code);

  if (index < 0) {
    return {
      ok: false,

      code: 'PROMO_INVALID',

      error: 'Промокод не найден или отключён',
    };
  }

  const cleaned = cleanExpiredReservations(items[index]);

  const pricing = resolvePricingForItem(cleaned.item, originalAmount, cleaned.reservations);

  if (!pricing.ok) {
    if (cleaned.changed) {
      items[index] = cleaned.item;

      writeAll(items);
    }

    return pricing;
  }

  const reservation = {
    id: createReservationId(),

    createdAt: new Date().toISOString(),

    expiresAt: reservationExpiresAt,
  };

  items[index] = {
    ...cleaned.item,

    reservations: [...cleaned.reservations, reservation],

    updatedAt: new Date().toISOString(),
  };

  writeAll(items);

  return {
    ...pricing,

    promo: {
      ...pricing.promo,

      reservationId: reservation.id,
    },
  };
}

export function isPromoCodeReservationActive(promoId, reservationId) {
  if (!promoId || !reservationId) {
    return false;
  }

  const items = readAll();

  const index = items.findIndex(item => item.id === promoId);

  if (index < 0) {
    return false;
  }

  const cleaned = cleanExpiredReservations(items[index]);

  if (cleaned.changed) {
    items[index] = cleaned.item;

    writeAll(items);
  }

  return cleaned.reservations.some(reservation => reservation.id === reservationId);
}

export function releasePromoCodeReservation(promoId, reservationId) {
  if (!promoId || !reservationId) {
    return false;
  }

  const items = readAll();

  const index = items.findIndex(item => item.id === promoId);

  if (index < 0) {
    return false;
  }

  const cleaned = cleanExpiredReservations(items[index]);

  const nextReservations = cleaned.reservations.filter(
    reservation => reservation.id !== reservationId,
  );

  const removed = nextReservations.length !== cleaned.reservations.length;

  if (!removed && !cleaned.changed) {
    return false;
  }

  items[index] = {
    ...cleaned.item,

    reservations: nextReservations,

    updatedAt: new Date().toISOString(),
  };

  writeAll(items);

  return removed;
}

export function markPromoCodeUsed(promoId, orderId, reservationId = null) {
  if (!promoId || !orderId) {
    return false;
  }

  const items = readAll();

  const index = items.findIndex(item => item.id === promoId);

  if (index < 0) {
    return false;
  }

  const cleaned = cleanExpiredReservations(items[index]);

  const current = cleaned.item;

  const usedOrderIds = Array.isArray(current.usedOrderIds) ? [...current.usedOrderIds] : [];

  /*
   * Payment callbacks are allowed to repeat.
   * Once this order consumed the promo, every later callback
   * is a no-op success.
   */
  if (usedOrderIds.includes(orderId)) {
    if (cleaned.changed) {
      items[index] = current;

      writeAll(items);
    }

    return true;
  }

  let reservations = cleaned.reservations;

  if (reservationId) {
    const reservationIndex = reservations.findIndex(
      reservation => reservation.id === reservationId,
    );

    if (reservationIndex < 0) {
      if (cleaned.changed) {
        items[index] = current;

        writeAll(items);
      }

      return false;
    }

    reservations = reservations.filter((_, position) => position !== reservationIndex);
  } else {
    /*
     * Compatibility for orders created before reservations
     * existed. They may consume a promo only when doing so
     * cannot steal quota reserved by a newer pending order.
     */
    if (
      current.maxUses !== null &&
      current.maxUses !== undefined &&
      Number(current.usedCount ?? 0) + reservations.length >= Number(current.maxUses)
    ) {
      if (cleaned.changed) {
        items[index] = current;

        writeAll(items);
      }

      return false;
    }
  }

  usedOrderIds.push(orderId);

  items[index] = {
    ...current,

    reservations,

    usedOrderIds,

    usedCount: Number(current.usedCount ?? 0) + 1,

    lastUsedAt: new Date().toISOString(),

    updatedAt: new Date().toISOString(),
  };

  writeAll(items);

  return true;
}
