import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

const MIN_JWT_SECRET_BYTES = 32;

const INSECURE_JWT_SECRETS = new Set([
  'dev-insecure-secret-change-me',
  'change-me-to-a-long-random-string',
  'change-me',
  'secret',
  'jwt-secret',
]);

function createJwtConfigurationError(message) {
  const error = new Error(`JWT_SECRET ${message}`);

  error.code = 'JWT_SECRET_INVALID';

  return error;
}

function getJwtSecret() {
  const raw = process.env.JWT_SECRET;

  if (typeof raw !== 'string' || !raw.trim()) {
    throw createJwtConfigurationError('is required');
  }

  const secret = raw.trim();

  if (raw !== secret) {
    throw createJwtConfigurationError('must not contain leading or trailing whitespace');
  }

  if (Buffer.byteLength(secret, 'utf8') < MIN_JWT_SECRET_BYTES) {
    throw createJwtConfigurationError(`must contain at least ${MIN_JWT_SECRET_BYTES} bytes`);
  }

  if (INSECURE_JWT_SECRETS.has(secret.toLowerCase())) {
    throw createJwtConfigurationError('uses a known insecure placeholder value');
  }

  return secret;
}

/*
 * Production entrypoint вызывает эту проверку до открытия HTTP-порта.
 *
 * Сами JWT operations тоже читают secret через getJwtSecret(),
 * поэтому auth остаётся fail-closed даже при использовании модулей
 * вне стандартного server/src/index.js bootstrap.
 */
export function assertJwtConfiguration() {
  getJwtSecret();

  return true;
}

function getAdminCredentials() {
  return {
    login: process.env.ADMIN_LOGIN,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
  };
}

export function isAdminConfigured() {
  const { login, passwordHash } = getAdminCredentials();

  return Boolean(login && passwordHash);
}

export function verifyAdminCredentials(login, password) {
  const { login: adminLogin, passwordHash } = getAdminCredentials();

  if (!adminLogin || !passwordHash) {
    return false;
  }

  if (login !== adminLogin) {
    return false;
  }

  try {
    return bcrypt.compareSync(password, passwordHash);
  } catch {
    return false;
  }
}

export function issueAdminToken() {
  return jwt.sign(
    {
      sub: 'admin',
      login: 'admin',
      role: 'admin',
    },
    getJwtSecret(),
    {
      expiresIn: JWT_EXPIRES_IN,
    },
  );
}

export function issueUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      login: user.email,
      email: user.email,
      role: 'user',
    },
    getJwtSecret(),
    {
      expiresIn: JWT_EXPIRES_IN,
    },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}
