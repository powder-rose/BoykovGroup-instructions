import crypto from 'node:crypto';

import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const MINUTE_MS = 60 * 1000;

const RATE_LIMIT_RESPONSE = {
  code: 'RATE_LIMITED',
  error: 'Слишком много запросов. Повторите попытку позже.',
};

function hashedIdentifier(value) {
  return crypto
    .createHash('sha256')
    .update(String(value ?? ''))
    .digest('hex')
    .slice(0, 32);
}

function normalizedLogin(req) {
  return String(req.body?.login ?? req.body?.email ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 320);
}

function normalizedIp(req) {
  return ipKeyGenerator(req.ip);
}

function userOrIpKey(req) {
  if (req.user?.sub) {
    return `user:${hashedIdentifier(req.user.sub)}`;
  }

  return `ip:${normalizedIp(req)}`;
}

function createLimiter(options) {
  return rateLimit({
    standardHeaders: 'draft-8',

    legacyHeaders: false,

    passOnStoreError: false,

    message: RATE_LIMIT_RESPONSE,

    ...options,
  });
}

export function createRateLimiters() {
  /*
   * Broad CPU/brute-force protection.
   *
   * Successful logins are not counted against
   * the failed-login quota.
   */
  const loginIp = createLimiter({
    identifier: 'auth-login-ip',

    windowMs: 15 * MINUTE_MS,

    limit: 50,

    skipSuccessfulRequests: true,
  });

  /*
   * Stricter bucket for one IP + one login.
   *
   * ipKeyGenerator prevents IPv6 address rotation
   * inside an assigned subnet from trivially creating
   * new rate-limit identities.
   */
  const loginIdentity = createLimiter({
    identifier: 'auth-login-identity',

    windowMs: 15 * MINUTE_MS,

    limit: 10,

    skipSuccessfulRequests: true,

    keyGenerator(req) {
      return [normalizedIp(req), hashedIdentifier(normalizedLogin(req) || 'missing-login')].join(
        ':',
      );
    },
  });

  const registration = createLimiter({
    identifier: 'auth-register',

    windowMs: 60 * MINUTE_MS,

    limit: 5,
  });

  const resendVerification = createLimiter({
    identifier: 'auth-resend-verification',

    windowMs: 60 * MINUTE_MS,

    limit: 6,

    keyGenerator(req) {
      return userOrIpKey(req);
    },
  });

  const promoValidation = createLimiter({
    identifier: 'promo-validation',

    windowMs: 10 * MINUTE_MS,

    limit: 30,
  });

  const publicGenerationValidation = createLimiter({
    identifier: 'public-generation-validation',

    windowMs: 10 * MINUTE_MS,

    limit: 60,
  });

  const publicOrderCreation = createLimiter({
    identifier: 'public-order-creation',

    windowMs: 60 * MINUTE_MS,

    limit: 20,

    keyGenerator(req) {
      return userOrIpKey(req);
    },
  });

  const paymentConfirmation = createLimiter({
    identifier: 'payment-confirmation',

    windowMs: 10 * MINUTE_MS,

    limit: 20,

    keyGenerator(req) {
      return [normalizedIp(req), hashedIdentifier(req.params?.id ?? '')].join(':');
    },
  });

  /*
   * Analytics endpoints currently write runtime state.
   * The higher limit keeps normal navigation unaffected
   * while bounding obvious automated write amplification.
   */
  const analyticsWrite = createLimiter({
    identifier: 'analytics-write',

    windowMs: MINUTE_MS,

    limit: 120,
  });

  const companyProfileWrite = createLimiter({
    identifier: 'company-profile-write',
    windowMs: 15 * MINUTE_MS,
    limit: 20,
    keyGenerator: userOrIpKey,
  });

  const walletWrite = createLimiter({
    identifier: 'wallet-write',
    windowMs: 15 * MINUTE_MS,
    limit: 30,
    keyGenerator: userOrIpKey,
  });
  const walletConfirmation = createLimiter({
    identifier: 'wallet-confirmation',
    windowMs: 10 * MINUTE_MS,
    limit: 60,
    keyGenerator: userOrIpKey,
  });

  return {
    walletWrite,
    walletConfirmation,
    loginIp,
    loginIdentity,
    registration,
    resendVerification,
    promoValidation,
    publicGenerationValidation,
    publicOrderCreation,
    paymentConfirmation,
    analyticsWrite,
    companyProfileWrite,
  };
}
