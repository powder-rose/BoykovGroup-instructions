import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL = 15 * 60 * 1000;
const COOKIE_TTL = 365 * 86400000;
export const VISITOR_COOKIE = 'boykovdocs_visitor_v2';
export const visitorIdPattern = /^[a-zA-Z0-9_-]{16,128}$/u;
export const visitorHashPattern = /^[a-f0-9]{64}$/u;

export function isLikelyBot(userAgent = '') {
  const value = String(userAgent).trim();
  return (
    !value ||
    /bot|crawler|spider|slurp|preview|headless|phantom|playwright|puppeteer|selenium|lighthouse|pagespeed|curl\b|wget\b|python|aiohttp|httpx|node-fetch|undici|go-http-client|httpclient|uptime|monitoring/iu.test(
      value,
    )
  );
}

export function isBrowserTrackingRequest(req) {
  const agent = req.get('user-agent') || '';
  if (req.user?.role === 'admin' || isLikelyBot(agent) || !/mozilla\//iu.test(agent)) return false;
  if (!req.is('application/json')) return false;
  const site = `${req.protocol}://${req.get('host')}`;
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  const destination = req.get('sec-fetch-dest');
  if ((fetchSite && fetchSite !== 'same-origin') || (destination && destination !== 'empty'))
    return false;
  if (origin) return origin === site;
  if (fetchSite === 'same-origin') return true;
  try {
    return new URL(req.get('referer')).origin === site;
  } catch {
    return false;
  }
}

export function normalizeTrackingPath(value) {
  if (
    typeof value !== 'string' ||
    value.length > 1800 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    Array.from(value).some(character => character === '\\' || character.charCodeAt(0) <= 32)
  )
    return null;
  let url;
  try {
    url = new URL(value, 'https://tracking.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'https://tracking.invalid' || /%(?:00|0a|0d|5c)/iu.test(url.pathname))
    return null;
  if (/^\/(?:api|assets|account|admin|thanks|oplata-instrukcii)(?:\/|$)/u.test(url.pathname))
    return null;
  const page = url.searchParams.get('page');
  return (
    url.pathname +
    (page && /^[1-9]\d{0,5}$/u.test(page) && Number(page) > 1 ? `?page=${Number(page)}` : '')
  );
}

export function hashVisitorId(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createVisitorTokens({
  secret = () => process.env.JWT_SECRET,
  clock = Date.now,
} = {}) {
  function sign(purpose, payload) {
    const key = secret();
    if (typeof key !== 'string' || Buffer.byteLength(key) < 32)
      throw new Error('Visitor signing is not configured');
    return createHmac('sha256', key)
      .update(`boykovdocs-analytics-v2:${purpose}:${payload}`)
      .digest('base64url');
  }
  function issue(purpose, visitor, origin, ttl) {
    const payload = Buffer.from(
      JSON.stringify({ visitor, origin, expires: clock() + ttl }),
    ).toString('base64url');
    return `${payload}.${sign(purpose, payload)}`;
  }
  function verify(purpose, token, origin) {
    if (typeof token !== 'string' || token.length > 1600) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const expected = Buffer.from(sign(purpose, parts[0]));
    const actual = Buffer.from(parts[1]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      return visitorHashPattern.test(data.visitor || '') &&
        data.origin === origin &&
        Number.isSafeInteger(data.expires) &&
        data.expires > clock()
        ? data
        : null;
    } catch {
      return null;
    }
  }
  return {
    bootstrap({ visitorId, cookie, origin }) {
      const existing = verify('cookie', cookie, origin);
      if (!existing && (typeof visitorId !== 'string' || !visitorIdPattern.test(visitorId)))
        return null;
      const visitor = existing?.visitor || hashVisitorId(visitorId);
      return {
        receipt: issue('receipt', visitor, origin, TOKEN_TTL),
        expiresAt: clock() + TOKEN_TTL,
        cookie: issue('cookie', visitor, origin, COOKIE_TTL),
        cookieMaxAge: COOKIE_TTL,
      };
    },
    verifyReceipt(token, origin, cookie) {
      const data = verify('receipt', token, origin);
      if (!data) return null;
      const persisted = verify('cookie', cookie, origin);
      return persisted && persisted.visitor !== data.visitor ? null : data.visitor;
    },
  };
}
