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

  const current = items[index];

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

  const updated = {
    ...current,

    code,

    type,

    value,

    active: patch.active !== undefined ? patch.active === true : current.active,

    maxUses: patch.maxUses !== undefined ? normalizeMaxUses(patch.maxUses) : current.maxUses,

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

  const item = readAll().find(promo => normalizeCode(promo.code) === code);

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

  const usedCount = Number(item.usedCount ?? 0);

  if (item.maxUses !== null && item.maxUses !== undefined && usedCount >= Number(item.maxUses)) {
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

export function markPromoCodeUsed(promoId, orderId) {
  if (!promoId || !orderId) {
    return false;
  }

  const items = readAll();

  const index = items.findIndex(item => item.id === promoId);

  if (index < 0) {
    return false;
  }

  const current = items[index];

  const usedOrderIds = Array.isArray(current.usedOrderIds) ? [...current.usedOrderIds] : [];

  if (usedOrderIds.includes(orderId)) {
    return true;
  }

  usedOrderIds.push(orderId);

  items[index] = {
    ...current,

    usedOrderIds,

    usedCount: Number(current.usedCount ?? 0) + 1,

    lastUsedAt: new Date().toISOString(),

    updatedAt: new Date().toISOString(),
  };

  writeAll(items);

  return true;
}
