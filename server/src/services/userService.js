import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');

const USERS_FILE = path.join(DATA_DIR, 'users.json');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]\n', {
      encoding: 'utf8',
      mode: 0o600,
    });
  }
}

function readUsers() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error('users.json must contain an array');
    }

    return parsed;
  } catch (error) {
    console.error('Unable to read users storage:', error);

    throw new Error('Не удалось прочитать базу пользователей');
  }
}

function writeUsers(users) {
  ensureStorage();

  const temporaryFile = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;

  fs.writeFileSync(temporaryFile, `${JSON.stringify(users, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });

  fs.renameSync(temporaryFile, USERS_FILE);
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,

    name: user.name ?? '',

    phone: user.phone ?? '',

    role: 'user',
    emailVerified: user.emailVerified === true,
    verifiedAt: user.verifiedAt ?? null,
  };
}

function hashVerificationToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function validateRegistration(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return {
      ok: false,
      error: 'Укажите корректный email',
    };
  }

  if (typeof password !== 'string' || password.length < 8) {
    return {
      ok: false,
      error: 'Пароль должен содержать не менее 8 символов',
    };
  }

  if (password.length > 128) {
    return {
      ok: false,
      error: 'Пароль слишком длинный',
    };
  }

  return {
    ok: true,
    email: normalizedEmail,
  };
}

export function createUser(email, password, name, phone) {
  const normalizedName = String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  const normalizedPhone = String(phone ?? '').trim();

  if (!normalizedName) {
    const error = new Error('Укажите имя');

    error.code = 'VALIDATION_ERROR';

    throw error;
  }

  if (!normalizedPhone) {
    const error = new Error('Укажите телефон');

    error.code = 'VALIDATION_ERROR';

    throw error;
  }

  const validation = validateRegistration(email, password);

  if (!validation.ok) {
    const error = new Error(validation.error);

    error.code = 'VALIDATION_ERROR';

    throw error;
  }

  const normalizedEmail = validation.email;

  const users = readUsers();

  const exists = users.some(user => normalizeEmail(user.email) === normalizedEmail);

  if (exists) {
    const error = new Error('Пользователь с таким email уже зарегистрирован');

    error.code = 'USER_EXISTS';

    throw error;
  }

  const user = {
    id: nanoid(18),

    name: normalizedName,

    phone: normalizedPhone,

    email: normalizedEmail,

    passwordHash: bcrypt.hashSync(password, 12),

    role: 'user',

    emailVerified: false,

    verifiedAt: null,

    verificationTokenHash: null,

    verificationTokenExpiresAt: null,

    verificationEmailSentAt: null,

    createdAt: new Date().toISOString(),
  };

  users.push(user);

  writeUsers(users);

  return publicUser(user);
}

export function getUserById(id) {
  if (!id) {
    return null;
  }

  const users = readUsers();

  const user = users.find(item => item.id === id);

  return publicUser(user);
}

export function verifyUserCredentials(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || typeof password !== 'string') {
    return null;
  }

  const users = readUsers();

  const user = users.find(item => normalizeEmail(item.email) === normalizedEmail);

  if (!user || !user.passwordHash) {
    return null;
  }

  try {
    if (!bcrypt.compareSync(password, user.passwordHash)) {
      return null;
    }
  } catch {
    return null;
  }

  return publicUser(user);
}

export function createEmailVerificationToken(userId) {
  const users = readUsers();

  const index = users.findIndex(user => user.id === userId);

  if (index === -1) {
    const error = new Error('Пользователь не найден');

    error.code = 'USER_NOT_FOUND';

    throw error;
  }

  if (users[index].emailVerified === true) {
    const error = new Error('Email уже подтверждён');

    error.code = 'EMAIL_ALREADY_VERIFIED';

    throw error;
  }

  const token = crypto.randomBytes(32).toString('hex');

  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();

  users[index] = {
    ...users[index],

    verificationTokenHash: hashVerificationToken(token),

    verificationTokenExpiresAt: expiresAt,
  };

  writeUsers(users);

  return {
    token,
    expiresAt,
    user: publicUser(users[index]),
  };
}

export function markVerificationEmailSent(userId) {
  const users = readUsers();

  const index = users.findIndex(user => user.id === userId);

  if (index === -1) {
    return false;
  }

  users[index] = {
    ...users[index],

    verificationEmailSentAt: new Date().toISOString(),
  };

  writeUsers(users);

  return true;
}

export function getVerificationResendDelay(userId) {
  const users = readUsers();

  const user = users.find(item => item.id === userId);

  if (!user || !user.verificationEmailSentAt) {
    return 0;
  }

  const sentAt = new Date(user.verificationEmailSentAt).getTime();

  if (!Number.isFinite(sentAt)) {
    return 0;
  }

  const remaining = VERIFICATION_RESEND_COOLDOWN_MS - (Date.now() - sentAt);

  if (remaining <= 0) {
    return 0;
  }

  return Math.ceil(remaining / 1000);
}

export function verifyEmailToken(token) {
  const normalizedToken = String(token ?? '').trim();

  if (!normalizedToken) {
    const error = new Error('Некорректная ссылка подтверждения');

    error.code = 'INVALID_VERIFICATION_TOKEN';

    throw error;
  }

  const tokenHash = hashVerificationToken(normalizedToken);

  const users = readUsers();

  const index = users.findIndex(user => user.verificationTokenHash === tokenHash);

  if (index === -1) {
    const error = new Error('Ссылка подтверждения недействительна');

    error.code = 'INVALID_VERIFICATION_TOKEN';

    throw error;
  }

  const expiresAt = new Date(users[index].verificationTokenExpiresAt).getTime();

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    users[index] = {
      ...users[index],

      verificationTokenHash: null,

      verificationTokenExpiresAt: null,
    };

    writeUsers(users);

    const error = new Error('Срок действия ссылки подтверждения истёк');

    error.code = 'VERIFICATION_TOKEN_EXPIRED';

    throw error;
  }

  const verifiedAt = new Date().toISOString();

  users[index] = {
    ...users[index],

    emailVerified: true,

    verifiedAt,

    verificationTokenHash: null,

    verificationTokenExpiresAt: null,

    verificationEmailSentAt: null,
  };

  writeUsers(users);

  return publicUser(users[index]);
}
