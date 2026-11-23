import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { getVisitorStats, recordVisitorPageView } from '../services/visitorStatsService.js';
import {
  createVisitorTokens,
  isBrowserTrackingRequest,
  normalizeTrackingPath,
  VISITOR_COOKIE,
} from '../services/visitorTrackingPolicy.js';

function getCookie(req) {
  const part = String(req.get('cookie') || '')
    .split(';')
    .map(p => p.trim())
    .find(p => p.startsWith(VISITOR_COOKIE + '='));
  return part?.slice(VISITOR_COOKIE.length + 1);
}

export function createVisitorStatsRouter({
  tokens = createVisitorTokens(),
  record = recordVisitorPageView,
  getStats = getVisitorStats,
} = {}) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  router.post('/session', (req, res) => {
    if (!isBrowserTrackingRequest(req)) return res.status(204).end();
    try {
      const result = tokens.bootstrap({
        visitorId: req.body?.visitorId,
        cookie: getCookie(req),
        origin: `${req.protocol}://${req.get('host')}`,
      });
      if (!result) return res.status(204).end();
      res.cookie(VISITOR_COOKIE, result.cookie, {
        httpOnly: true,
        secure: req.secure,
        sameSite: 'lax',
        maxAge: result.cookieMaxAge,
        path: '/api/visitor-stats',
      });
      return res.json({ receipt: result.receipt, expiresAt: result.expiresAt });
    } catch {
      return res.status(204).end();
    }
  });
  router.post('/visit', (req, res) => {
    try {
      if (
        !isBrowserTrackingRequest(req) ||
        req.body?.schema !== 2 ||
        req.body.visible !== true ||
        req.body.automated !== false ||
        !normalizeTrackingPath(req.body.path)
      )
        return res.status(204).end();
      const visitorHash = tokens.verifyReceipt(
        req.body.receipt,
        `${req.protocol}://${req.get('host')}`,
        getCookie(req),
      );
      if (visitorHash) record({ visitorHash, eventId: req.body.eventId });
    } catch {
      /* Analytics must not interrupt the website or expose receipt data. */
    }
    return res.status(204).end();
  });
  router.get('/admin', requireAdmin, (_req, res) => {
    res.set('Vary', 'Authorization');
    try {
      return res.json(getStats());
    } catch {
      return res.status(500).json({ error: 'Не удалось получить статистику посетителей' });
    }
  });
  return router;
}
export const visitorStatsRouter = createVisitorStatsRouter();
