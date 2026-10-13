import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';

import {
  getVisitorStats,
  isLikelyBot,
  recordVisitorPageView,
} from '../services/visitorStatsService.js';

export const visitorStatsRouter = Router();

/*
 * Публичная фиксация просмотра.
 *
 * Не сохраняем:
 * - IP;
 * - email;
 * - имя;
 * - User-Agent.
 *
 * visitorId хешируется перед записью.
 */
visitorStatsRouter.post('/visit', (req, res) => {
  try {
    const userAgent = String(req.get('user-agent') ?? '');

    if (isLikelyBot(userAgent)) {
      return res.status(204).end();
    }

    const visitorId = req.body?.visitorId;

    recordVisitorPageView({
      visitorId,
    });

    res.set('Cache-Control', 'no-store');

    return res.status(204).end();
  } catch (error) {
    console.error('Visitor tracking error:', error);

    /*
     * Ошибка аналитики никогда
     * не должна ломать сайт.
     */
    return res.status(204).end();
  }
});

/*
 * Статистика только для администратора.
 */
visitorStatsRouter.get('/admin', requireAdmin, (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    return res.json(getVisitorStats());
  } catch (error) {
    console.error('Visitor stats error:', error);

    return res.status(500).json({
      error: 'Не удалось получить статистику посетителей',
    });
  }
});
