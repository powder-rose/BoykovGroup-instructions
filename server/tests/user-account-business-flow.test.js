import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';

import { verifyToken } from '../src/services/authService.js';

import { attachUser } from '../src/middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const TEST_JWT_SECRET = 'boykovdocs-user-account-business-flow-jwt-secret-6a4f255d';

const userServicePath = path.join(serverRoot, 'src', 'services', 'userService.js');

const consentServicePath = path.join(serverRoot, 'src', 'services', 'userConsentService.js');

const authRoutePath = path.join(serverRoot, 'src', 'routes', 'auth.js');

const authServiceUrl = pathToFileURL(
  path.join(serverRoot, 'src', 'services', 'authService.js'),
).href;

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function replaceExactly(source, before, after, description) {
  assert.equal(source.includes(before), true, `${description} changed unexpectedly`);

  return source.replace(before, after);
}

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);

    server.once('error', reject);
  });

  return server;
}

async function closeServer(server) {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function createIsolatedAccountFlow() {
  /*
   * Sandbox находится под server/,
   * чтобы bare imports вроде bcryptjs,
   * nanoid и express штатно находили
   * server/node_modules.
   */
  const root = fs.mkdtempSync(path.join(serverRoot, 'boykovdocs-user-account-flow-'));

  const dataDirectory = path.join(root, 'data');

  const usersFile = path.join(dataDirectory, 'users.json');

  const consentsFile = path.join(dataDirectory, 'registration-consents.json');

  const previousJwtSecret = process.env.JWT_SECRET;

  process.env.JWT_SECRET = TEST_JWT_SECRET;

  let server = null;

  try {
    /*
     * ------------------------------------------
     * Isolated user service
     * ------------------------------------------
     */
    let userSource = fs.readFileSync(userServicePath, 'utf8');

    userSource = replaceExactly(
      userSource,
      "const DATA_DIR = path.resolve(__dirname, '../../data');",
      `const DATA_DIR = ${JSON.stringify(dataDirectory)};`,
      'userService DATA_DIR declaration',
    );

    const isolatedUserPath = path.join(root, 'userService.mjs');

    fs.writeFileSync(isolatedUserPath, userSource, 'utf8');

    const isolatedUserUrl = pathToFileURL(isolatedUserPath).href + `?test=${crypto.randomUUID()}`;

    /*
     * ------------------------------------------
     * Isolated consent service
     * ------------------------------------------
     */
    let consentSource = fs.readFileSync(consentServicePath, 'utf8');

    consentSource = replaceExactly(
      consentSource,
      "const DATA_DIR = path.resolve(__dirname, '../../data');",
      `const DATA_DIR = ${JSON.stringify(dataDirectory)};`,
      'userConsentService DATA_DIR declaration',
    );

    const isolatedConsentPath = path.join(root, 'userConsentService.mjs');

    fs.writeFileSync(isolatedConsentPath, consentSource, 'utf8');

    const isolatedConsentUrl =
      pathToFileURL(isolatedConsentPath).href + `?test=${crypto.randomUUID()}`;

    /*
     * ------------------------------------------
     * Email stub
     * ------------------------------------------
     *
     * Никакого реального SMTP.
     */
    const emailStubPath = path.join(root, 'emailVerificationService.mjs');

    const emailStubSource = `
const verificationEmails = [];
const registrationNotifications = [];

export function isEmailVerificationConfigured() {
  return true;
}

export async function sendVerificationEmail(payload) {
  verificationEmails.push({
    ...payload,
  });

  return {
    ok: true,
  };
}

export async function sendRegistrationNotification(payload) {
  registrationNotifications.push({
    ...payload,
  });

  return {
    ok: true,
  };
}

export function getVerificationEmails() {
  return verificationEmails.map(
    item => ({
      ...item,
    }),
  );
}

export function getRegistrationNotifications() {
  return registrationNotifications.map(
    item => ({
      ...item,
    }),
  );
}
`;

    fs.writeFileSync(emailStubPath, emailStubSource, 'utf8');

    const emailStubUrl = pathToFileURL(emailStubPath).href + `?test=${crypto.randomUUID()}`;

    /*
     * ------------------------------------------
     * Production auth route
     * with isolated dependencies
     * ------------------------------------------
     */
    let authSource = fs.readFileSync(authRoutePath, 'utf8');

    authSource = replaceExactly(
      authSource,
      "'../services/authService.js'",
      JSON.stringify(authServiceUrl),
      'authService import',
    );

    authSource = replaceExactly(
      authSource,
      "'../services/userService.js'",
      JSON.stringify(isolatedUserUrl),
      'userService import',
    );

    authSource = replaceExactly(
      authSource,
      "'../services/emailVerificationService.js'",
      JSON.stringify(emailStubUrl),
      'emailVerificationService import',
    );

    authSource = replaceExactly(
      authSource,
      "'../services/userConsentService.js'",
      JSON.stringify(isolatedConsentUrl),
      'userConsentService import',
    );

    const isolatedAuthPath = path.join(root, 'authRoute.mjs');

    fs.writeFileSync(isolatedAuthPath, authSource, 'utf8');

    const authRouteUrl = pathToFileURL(isolatedAuthPath).href + `?test=${crypto.randomUUID()}`;

    const { authRouter } = await import(authRouteUrl);

    const userService = await import(isolatedUserUrl);

    const emailStub = await import(emailStubUrl);

    /*
     * Минимальный HTTP app использует
     * настоящий production authRouter
     * и настоящий attachUser.
     */
    const app = express();

    app.use(express.json());

    app.use(attachUser);

    app.use('/api/auth', authRouter);

    server = await listen(app);

    const address = server.address();

    const baseUrl = `http://127.0.0.1:${address.port}`;

    return {
      root,
      usersFile,
      consentsFile,
      userService,
      emailStub,
      baseUrl,

      async request(route, options = {}) {
        return fetch(`${baseUrl}${route}`, options);
      },

      async cleanup() {
        try {
          await closeServer(server);
        } finally {
          if (previousJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
          } else {
            process.env.JWT_SECRET = previousJwtSecret;
          }

          fs.rmSync(root, {
            recursive: true,
            force: true,
          });
        }
      },
    };
  } catch (error) {
    try {
      await closeServer(server);
    } finally {
      if (previousJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previousJwtSecret;
      }

      fs.rmSync(root, {
        recursive: true,
        force: true,
      });
    }

    throw error;
  }
}

function registrationPayload(overrides = {}) {
  return {
    name: 'Иван Тестовый',

    phone: '+7 999 000-00-01',

    email: ' Buyer.Account@Example.INVALID ',

    password: 'BusinessFlowPassword-2026',

    userAgreementAccepted: true,

    personalDataConsentAccepted: true,

    advertisingConsentAccepted: false,

    ...overrides,
  };
}

function jsonRequest(body, extra = {}) {
  return {
    method: 'POST',

    headers: {
      'content-type': 'application/json',

      ...(extra.headers ?? {}),
    },

    body: JSON.stringify(body),

    ...extra,

    headers: {
      'content-type': 'application/json',

      ...(extra.headers ?? {}),
    },
  };
}

test(
  'registration requires mandatory consents before creating an account',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedAccountFlow();

    try {
      const response = await flow.request(
        '/api/auth/register',

        jsonRequest(
          registrationPayload({
            personalDataConsentAccepted: false,
          }),
        ),
      );

      assert.equal(response.status, 400);

      assert.deepEqual(readJson(flow.usersFile), []);

      assert.deepEqual(readJson(flow.consentsFile), []);

      assert.equal(flow.emailStub.getVerificationEmails().length, 0);

      assert.equal(flow.emailStub.getRegistrationNotifications().length, 0);
    } finally {
      await flow.cleanup();
    }
  },
);

test(
  'user registration login verification and ownership lifecycle stays consistent',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedAccountFlow();

    try {
      const password = 'BusinessFlowPassword-2026';

      /*
       * ========================================
       * REGISTER
       * ========================================
       */
      const registerResponse = await flow.request(
        '/api/auth/register',

        jsonRequest(
          registrationPayload({
            password,
          }),
        ),
      );

      assert.equal(registerResponse.status, 201);

      const registration = await registerResponse.json();

      assert.equal(registration.user.email, 'buyer.account@example.invalid');

      assert.equal(registration.user.role, 'user');

      assert.equal(registration.user.emailVerified, false);

      assert.equal(registration.verificationEmailSent, true);

      assert.equal(typeof registration.token, 'string');

      const tokenPayload = verifyToken(registration.token);

      assert.equal(tokenPayload.role, 'user');

      assert.equal(tokenPayload.email, 'buyer.account@example.invalid');

      assert.ok(tokenPayload.sub);

      /*
       * ========================================
       * PERSISTED USER
       * ========================================
       */
      const users = readJson(flow.usersFile);

      assert.equal(users.length, 1);

      const storedUser = users[0];

      assert.equal(storedUser.id, tokenPayload.sub);

      assert.equal(storedUser.email, 'buyer.account@example.invalid');

      assert.equal(typeof storedUser.passwordHash, 'string');

      assert.notEqual(storedUser.passwordHash, password);

      assert.equal(Object.prototype.hasOwnProperty.call(storedUser, 'password'), false);

      const rawUsersFile = fs.readFileSync(flow.usersFile, 'utf8');

      assert.equal(
        rawUsersFile.includes(password),
        false,
        'plaintext password must never be persisted',
      );

      /*
       * ========================================
       * CONSENTS
       * ========================================
       */
      const consents = readJson(flow.consentsFile);

      assert.equal(consents.length, 1);

      assert.equal(consents[0].userId, tokenPayload.sub);

      assert.equal(consents[0].email, 'buyer.account@example.invalid');

      assert.equal(consents[0].userAgreement.accepted, true);

      assert.equal(consents[0].personalDataConsent.accepted, true);

      assert.equal(consents[0].advertisingConsent.accepted, false);

      /*
       * ========================================
       * EMAIL WAS PREPARED, NOT REALLY SENT
       * ========================================
       */
      const verificationEmails = flow.emailStub.getVerificationEmails();

      assert.equal(verificationEmails.length, 1);

      assert.equal(verificationEmails[0].email, 'buyer.account@example.invalid');

      assert.equal(typeof verificationEmails[0].token, 'string');

      assert.ok(verificationEmails[0].token.length > 30);

      const verificationToken = verificationEmails[0].token;

      assert.equal(
        rawUsersFile.includes(verificationToken),
        false,
        'raw verification token must not be persisted',
      );

      assert.equal(flow.emailStub.getRegistrationNotifications().length, 1);

      /*
       * ========================================
       * /ME BEFORE VERIFICATION
       * ========================================
       */
      const meBeforeResponse = await flow.request('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${registration.token}`,
        },
      });

      assert.equal(meBeforeResponse.status, 200);

      const meBefore = await meBeforeResponse.json();

      assert.equal(meBefore.user.emailVerified, false);

      /*
       * ========================================
       * RESEND COOLDOWN
       * ========================================
       */
      const resendResponse = await flow.request('/api/auth/resend-verification', {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${registration.token}`,
        },
      });

      assert.equal(resendResponse.status, 429);

      const resendBody = await resendResponse.json();

      assert.ok(resendBody.retryAfter > 0);

      assert.equal(
        flow.emailStub.getVerificationEmails().length,
        1,
        'cooldown must prevent duplicate verification email',
      );

      /*
       * ========================================
       * LOGIN
       * ========================================
       */
      const loginResponse = await flow.request(
        '/api/auth/login',

        jsonRequest({
          email: ' BUYER.ACCOUNT@EXAMPLE.INVALID ',

          password,
        }),
      );

      assert.equal(loginResponse.status, 200);

      const loginBody = await loginResponse.json();

      const loginPayload = verifyToken(loginBody.token);

      assert.equal(loginPayload.sub, tokenPayload.sub);

      assert.equal(loginPayload.role, 'user');

      const badLogin = await flow.request(
        '/api/auth/login',

        jsonRequest({
          email: 'buyer.account@example.invalid',

          password: 'definitely-wrong-password',
        }),
      );

      assert.equal(badLogin.status, 401);

      /*
       * ========================================
       * VERIFY EMAIL
       * ========================================
       */
      const verifyResponse = await flow.request(
        '/api/auth/verify-email?' +
          new URLSearchParams({
            token: verificationToken,
          }),
        {
          redirect: 'manual',
        },
      );

      assert.equal(verifyResponse.status, 302);

      assert.equal(verifyResponse.headers.get('location'), '/?emailVerified=1');

      /*
       * Старый JWT остаётся пригодным,
       * а /me читает свежий статус
       * подтверждения из users.json.
       */
      const meAfterResponse = await flow.request('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${registration.token}`,
        },
      });

      assert.equal(meAfterResponse.status, 200);

      const meAfter = await meAfterResponse.json();

      assert.equal(meAfter.user.emailVerified, true);

      assert.ok(meAfter.user.verifiedAt);

      /*
       * Verification token одноразовый.
       */
      const reuseResponse = await flow.request(
        '/api/auth/verify-email?' +
          new URLSearchParams({
            token: verificationToken,
          }),
        {
          redirect: 'manual',
        },
      );

      assert.equal(reuseResponse.status, 302);

      assert.equal(reuseResponse.headers.get('location'), '/?emailVerified=invalid');

      /*
       * После подтверждения resend
       * не отправляет новое письмо.
       */
      const resendVerifiedResponse = await flow.request('/api/auth/resend-verification', {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${registration.token}`,
        },
      });

      assert.equal(resendVerifiedResponse.status, 200);

      const resendVerified = await resendVerifiedResponse.json();

      assert.equal(resendVerified.emailVerified, true);

      assert.equal(flow.emailStub.getVerificationEmails().length, 1);

      /*
       * ========================================
       * FINAL STORAGE STATE
       * ========================================
       */
      const finalUsers = readJson(flow.usersFile);

      assert.equal(finalUsers.length, 1);

      assert.equal(finalUsers[0].emailVerified, true);

      assert.ok(finalUsers[0].verifiedAt);

      assert.equal(finalUsers[0].verificationTokenHash, null);

      assert.equal(finalUsers[0].verificationTokenExpiresAt, null);

      assert.equal(finalUsers[0].verificationEmailSentAt, null);

      /*
       * ========================================
       * DUPLICATE REGISTRATION
       * ========================================
       */
      const duplicateResponse = await flow.request(
        '/api/auth/register',

        jsonRequest(
          registrationPayload({
            email: 'BUYER.ACCOUNT@EXAMPLE.INVALID',

            password,
          }),
        ),
      );

      assert.equal(duplicateResponse.status, 409);

      assert.equal(readJson(flow.usersFile).length, 1);

      assert.equal(
        readJson(flow.consentsFile).length,
        1,
        'duplicate registration must not create another consent record',
      );

      assert.equal(flow.emailStub.getRegistrationNotifications().length, 1);

      assert.equal(flow.emailStub.getVerificationEmails().length, 1);
    } finally {
      await flow.cleanup();
    }
  },
);
