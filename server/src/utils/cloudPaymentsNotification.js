import crypto from 'node:crypto';

export function verifyCloudPaymentsHmac(req) {
  const secret = String(process.env.CLOUDPAYMENTS_API_SECRET ?? '');
  if (!secret || !Buffer.isBuffer(req.body)) return false;
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
  const received = String(req.get('Content-HMAC') ?? '');
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(received, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function parseCloudPaymentsNotification(req) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  return String(req.get('content-type') ?? '')
    .toLowerCase()
    .includes('application/json')
    ? JSON.parse(raw || '{}')
    : Object.fromEntries(new URLSearchParams(raw));
}
