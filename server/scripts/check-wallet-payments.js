import 'dotenv/config';
import { fetchWithTimeout } from '../src/utils/fetchWithTimeout.js';
import { assessCloudPaymentsNotification } from '../src/utils/cloudPaymentsNotificationSettings.js';

const publicId = String(process.env.CLOUDPAYMENTS_PUBLIC_ID || '').trim();
const secret = String(process.env.CLOUDPAYMENTS_API_SECRET || '').trim();
const site = String(process.env.SITE_URL || 'https://boykovdocs.ru').replace(/\/+$/u, '');

if (!publicId || !secret) {
  console.error('CloudPayments: отсутствует PUBLIC_ID или API_SECRET');
  process.exitCode = 1;
} else {
  const authorization = Buffer.from(`${publicId}:${secret}`).toString('base64');
  // Read only: this command never changes the merchant's terminal settings.
  await Promise.all(
    ['check', 'pay', 'refund'].map(async type => {
      const expected = `${site}/api/public-generation/cloudpayments/${type}`;
      try {
        const response = await fetchWithTimeout(
          globalThis.fetch,
          `https://api.cloudpayments.ru/site/notifications/${type}/get`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authorization}`,
              'Content-Type': 'application/json',
            },
            body: '{}',
          },
          { timeoutMs: 15_000, timeoutCode: 'CLOUDPAYMENTS_HTTP_TIMEOUT' },
        );
        const payload = await response.json();
        if (!response.ok || payload?.Success !== true) {
          console.error(`${type}: не удалось проверить настройки CloudPayments`);
          process.exitCode = 1;
          return;
        }

        const result = assessCloudPaymentsNotification(type, payload.Model, expected);
        if (result.checkDisabled) {
          console.log('check: выключен (допустимо при проверке платежа через Pay)');
        } else {
          console.log(
            `${type}: ${result.valid ? 'OK' : `проверьте настройки: POST, UTF8, CloudPayments, ${expected}`}`,
          );
        }
        if (!result.valid) process.exitCode = 1;
      } catch {
        console.error(`${type}: не удалось прочитать настройки CloudPayments`);
        process.exitCode = 1;
      }
    }),
  );
}
