import { COMPANY_PROFILE_FIELDS } from '../shared/companyProfile.js';
import { isEmailVerificationConfigured, sendSystemEmail } from './emailVerificationService.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

export function formatCompanyProfileNotification(event) {
  const timestamp = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(event.createdAt));
  const rows = [
    ['Дата сохранения (Москва)', timestamp],
    ['ID пользователя', event.user.id],
    ['Имя пользователя', event.user.name],
    ['Email пользователя', event.user.email],
    ['Телефон пользователя', event.user.phone],
    ...COMPANY_PROFILE_FIELDS.map(({ name, label }) => [label, event.companyProfile[name]]),
  ].map(([label, value]) => [label, value || 'Не заполнено']);

  return {
    subject: 'Данные компании пользователя — БОЙКОВГРУПП',
    messageId: `<company-profile-${event.id}@boykovdocs.ru>`,
    text: [
      'Пользователь сохранил данные компании для персонализации инструкций.',
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Данные компании пользователя</h2>
      <p>Данные сохранены для персонализации скачиваемых инструкций.</p>
      <table style="border-collapse:collapse">${rows
        .map(
          ([label, value]) =>
            `<tr><th style="border:1px solid #d1d5db;padding:8px;text-align:left">${escapeHtml(label)}</th><td style="border:1px solid #d1d5db;padding:8px">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}</table></div>`,
  };
}

export async function sendCompanyProfileNotification(event) {
  if (!isEmailVerificationConfigured()) {
    const error = new Error('Company profile notification email is not configured');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  return sendSystemEmail({
    to: process.env.COMPANY_PROFILE_NOTIFICATION_TO?.trim() || 'bd@boykovdocs.ru',
    ...formatCompanyProfileNotification(event),
    timeoutMs: 10_000,
  });
}

export function createCompanyProfileNotificationWorker({
  repository,
  send = sendCompanyProfileNotification,
  intervalMs = 30_000,
  batchSize = 3,
  logger = console,
}) {
  let timer;
  let running;
  let stopped = true;

  function schedule(delay = intervalMs) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await flush();
      } catch {
        logger.error('[CompanyProfileMail] Unable to access notification storage');
      } finally {
        schedule();
      }
    }, delay);
    timer.unref?.();
  }

  function flush() {
    if (running) return running;
    running = (async () => {
      const pending = repository.getPending(batchSize);
      for (const event of pending) {
        // stop() lets the current SMTP request finish but never starts another one.
        if (stopped) break;
        try {
          await send(event);
        } catch {
          repository.retry(event.id);
          logger.warn('[CompanyProfileMail] Delivery deferred; saved data remains available');
          continue;
        }
        repository.acknowledge(event.id);
      }
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      schedule(0);
    },
    wake() {
      if (!running) schedule(0);
    },
    flush,
    async stop() {
      stopped = true;
      clearTimeout(timer);
      if (running) await running;
    },
  };
}
