import nodemailer from 'nodemailer';
import { Socket } from 'node:net';

const DEFAULT_SMTP_HOST = 'smtp.beget.com';

const DEFAULT_SMTP_PORT = 465;

const DEFAULT_PUBLIC_URL = 'https://boykovdocs.ru';

function getConfig() {
  const port = Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT);

  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;

  return {
    host: process.env.SMTP_HOST || DEFAULT_SMTP_HOST,

    port,

    secure,

    user: process.env.SMTP_USER || '',

    pass: process.env.SMTP_PASS || '',

    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',

    publicUrl: (process.env.PUBLIC_BASE_URL || DEFAULT_PUBLIC_URL).replace(/\/+$/, ''),
  };
}

export function isEmailVerificationConfigured() {
  const config = getConfig();

  return Boolean(config.host && config.port && config.user && config.pass && config.from);
}

function createTransporter(options = {}) {
  const config = getConfig();

  return nodemailer.createTransport({
    host: config.host,

    port: config.port,

    secure: config.secure,

    auth: {
      user: config.user,

      pass: config.pass,
    },
    ...options,
  });
}

export async function verifyEmailTransport() {
  if (!isEmailVerificationConfigured()) {
    return {
      ok: false,
      configured: false,
    };
  }

  const transporter = createTransporter();

  await transporter.verify();

  return {
    ok: true,
    configured: true,
  };
}

export async function sendVerificationEmail({ email, token }) {
  if (!isEmailVerificationConfigured()) {
    const error = new Error('Отправка email не настроена');

    error.code = 'EMAIL_NOT_CONFIGURED';

    throw error;
  }

  const config = getConfig();

  const verificationUrl = `${config.publicUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `БОЙКОВГРУПП <${config.from}>`,

    to: email,

    subject: 'Подтвердите e-mail на БОЙКОВГРУПП',

    text: [
      'Здравствуйте!',
      '',
      'Подтвердите ваш e-mail, чтобы скачивать инструкции по охране труда в PDF.',
      '',
      verificationUrl,
      '',
      'Ссылка действует 24 часа.',
      '',
      'Если вы не регистрировались на сайте, просто проигнорируйте это письмо.',
    ].join('\n'),

    html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Подтвердите e-mail</h2>

          <p>
            Подтвердите ваш e-mail, чтобы скачивать
            инструкции по охране труда в PDF.
          </p>

          <p>
            <a
              href="${verificationUrl}"
              style="
                display:inline-block;
                padding:12px 20px;
                background:#111827;
                color:#ffffff;
                text-decoration:none;
                border-radius:4px;
                font-weight:700;
              "
            >
              Подтвердить e-mail
            </a>
          </p>

          <p>
            Ссылка действует 24 часа.
          </p>

          <p style="color:#6b7280;font-size:13px">
            Если вы не регистрировались на сайте,
            просто проигнорируйте это письмо.
          </p>
        </div>
      `,
  });

  return {
    ok: true,
  };
}

export async function sendRegistrationNotification({ name, phone, email }) {
  if (!isEmailVerificationConfigured()) {
    const error = new Error('Отправка email не настроена');

    error.code = 'EMAIL_NOT_CONFIGURED';

    throw error;
  }

  const config = getConfig();

  const normalizedName = String(name ?? '').trim();

  const normalizedPhone = String(phone ?? '').trim();

  const normalizedEmail = String(email ?? '').trim();

  const registrationText = `Регистрация пользователя ${normalizedName}`;

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `БОЙКОВГРУПП <${config.from}>`,

    to: 'bd@boykovdocs.ru',

    subject: registrationText,

    text: [
      registrationText,
      '',
      `Имя: ${normalizedName}`,
      `Телефон: ${normalizedPhone}`,
      `Email: ${normalizedEmail}`,
    ].join('\n'),
  });

  return {
    ok: true,
  };
}

/*
 * SYSTEM_EMAIL_SENDER_V1
 *
 * Универсальная отправка системных писем
 * через существующий SMTP BoykovDocs.
 */
export async function sendSystemEmail({ to, subject, text = '', html = '', messageId, timeoutMs }) {
  // Keep the underlying socket so the overall deadline also aborts SMTP/TLS work.
  const socket = timeoutMs ? new Socket() : undefined;
  const transporter = createTransporter(
    timeoutMs
      ? {
          socket,
          connectionTimeout: timeoutMs,
          greetingTimeout: timeoutMs,
          socketTimeout: timeoutMs,
        }
      : {},
  );
  let timer;
  try {
    const delivery = transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'bd@boykovdocs.ru',
      to,
      subject,
      text,
      html,
      messageId,
    });
    if (!timeoutMs) return await delivery;
    return await Promise.race([
      delivery,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('System email delivery timed out');
          error.code = 'EMAIL_TIMEOUT';
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    socket?.destroy();
    transporter.close();
  }
}
