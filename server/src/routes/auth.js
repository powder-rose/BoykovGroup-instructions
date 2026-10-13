import { Router } from 'express';

import {
  verifyAdminCredentials,
  issueAdminToken,
  issueUserToken,
} from '../services/authService.js';

import {
  createUser,
  getUserById,
  verifyUserCredentials,
  normalizeEmail,
  createEmailVerificationToken,
  markVerificationEmailSent,
  getVerificationResendDelay,
  verifyEmailToken,
} from '../services/userService.js';

import {
  isEmailVerificationConfigured,
  sendVerificationEmail,
  sendRegistrationNotification,
} from '../services/emailVerificationService.js';

import { recordRegistrationConsents } from '../services/userConsentService.js';

export const authRouter = Router();

function serializeUser(user) {
  return {
    login: user.email,

    email: user.email,

    name: user.name ?? '',

    phone: user.phone ?? '',

    role: 'user',

    emailVerified: user.emailVerified === true,

    verifiedAt: user.verifiedAt ?? null,
  };
}

async function sendUserVerification(user) {
  const generated = createEmailVerificationToken(user.id);

  await sendVerificationEmail({
    email: user.email,

    token: generated.token,
  });

  markVerificationEmailSent(user.id);

  return true;
}

/*
 * Регистрация пользователя.
 */
authRouter.post('/register', async (req, res) => {
  const {
    name,
    phone,
    email,
    password,
    userAgreementAccepted,
    personalDataConsentAccepted,
    advertisingConsentAccepted,
  } = req.body ?? {};

  /*
   * REGISTRATION CONSENT VALIDATION
   */
  if (userAgreementAccepted !== true) {
    return res.status(400).json({
      error:
        'Регистрация на Сайте осуществляется только после ознакомления Пользователя с настоящим Соглашением и подтверждения его принятия посредством самостоятельного проставления соответствующей отметки (чекбокса).',
    });
  }

  if (personalDataConsentAccepted !== true) {
    return res.status(400).json({
      error:
        'Согласие предоставляется посредством совершения Пользователем соответствующего действия на Сайте, в том числе путем самостоятельного проставления отметки (чекбокса) в поле о согласии на обработку персональных данных и последующего направления формы, регистрации на Сайте или совершения иного действия, сопровождаемого предоставлением персональных данных.',
    });
  }

  try {
    const user = createUser(email, password, name, phone);

    /*
     * REGISTRATION USER NOTIFICATION
     */
    try {
      await sendRegistrationNotification({
        name: user.name,

        phone: user.phone,

        email: user.email,
      });
    } catch (notificationError) {
      console.error('Registration notification error:', notificationError);
    }

    /*
     * REGISTRATION CONSENT RECORD
     */
    try {
      recordRegistrationConsents({
        userId: user.id,

        email: user.email ?? email,

        userAgreementAccepted,
        personalDataConsentAccepted,
        advertisingConsentAccepted: advertisingConsentAccepted === true,
      });
    } catch (consentError) {
      console.error('Unable to record registration consents:', consentError);
    }

    let verificationEmailSent = false;

    if (isEmailVerificationConfigured()) {
      try {
        await sendUserVerification(user);

        verificationEmailSent = true;
      } catch (mailError) {
        console.error('Verification email error:', mailError);
      }
    }

    const token = issueUserToken(user);

    return res.status(201).json({
      token,

      user: serializeUser(user),

      verificationEmailSent,
    });
  } catch (error) {
    if (error?.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (error?.code === 'USER_EXISTS') {
      return res.status(409).json({
        error: error.message,
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      error: 'Не удалось зарегистрировать пользователя',
    });
  }
});

/*
 * Вход admin/user.
 */
authRouter.post('/login', (req, res) => {
  const { login, email, password } = req.body ?? {};

  const loginValue = String(login ?? email ?? '').trim();

  if (!loginValue || !password) {
    return res.status(400).json({
      error: 'Укажите email или логин и пароль',
    });
  }

  if (verifyAdminCredentials(loginValue, password)) {
    return res.json({
      token: issueAdminToken(),

      user: {
        login: loginValue,

        role: 'admin',

        emailVerified: true,
      },
    });
  }

  const user = verifyUserCredentials(normalizeEmail(loginValue), password);

  if (!user) {
    return res.status(401).json({
      error: 'Неверный email, логин или пароль',
    });
  }

  return res.json({
    token: issueUserToken(user),

    user: serializeUser(user),
  });
});

/*
 * Текущий пользователь.
 *
 * Статус подтверждения email читается
 * из users.json, а не из JWT.
 */
authRouter.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Не авторизован',
    });
  }

  if (req.user.role === 'admin') {
    return res.json({
      user: {
        login: req.user.login ?? req.user.sub,

        role: 'admin',

        emailVerified: true,
      },
    });
  }

  const user = getUserById(req.user.sub);

  if (!user) {
    return res.status(401).json({
      error: 'Пользователь не найден',
    });
  }

  return res.json({
    user: serializeUser(user),
  });
});

/*
 * Ссылка из письма.
 */
authRouter.get('/verify-email', (req, res) => {
  const token = req.query?.token;

  try {
    verifyEmailToken(token);

    return res.redirect(302, '/?emailVerified=1');
  } catch (error) {
    const status = error?.code === 'VERIFICATION_TOKEN_EXPIRED' ? 'expired' : 'invalid';

    return res.redirect(302, `/?emailVerified=${status}`);
  }
});

/*
 * Повторная отправка письма.
 */
authRouter.post('/resend-verification', async (req, res) => {
  if (!req.user || req.user.role !== 'user') {
    return res.status(401).json({
      error: 'Требуется авторизация',
    });
  }

  const user = getUserById(req.user.sub);

  if (!user) {
    return res.status(401).json({
      error: 'Пользователь не найден',
    });
  }

  if (user.emailVerified) {
    return res.json({
      ok: true,
      emailVerified: true,
    });
  }

  if (!isEmailVerificationConfigured()) {
    return res.status(503).json({
      error: 'Отправка email временно недоступна',
    });
  }

  const retryAfter = getVerificationResendDelay(user.id);

  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));

    return res.status(429).json({
      error: `Повторное письмо можно отправить через ${retryAfter} сек.`,
      retryAfter,
    });
  }

  try {
    await sendUserVerification(user);

    return res.json({
      ok: true,
      emailVerified: false,
    });
  } catch (error) {
    console.error('Resend verification error:', error);

    return res.status(502).json({
      error: 'Не удалось отправить письмо. Попробуйте позже.',
    });
  }
});
