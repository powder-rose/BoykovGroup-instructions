import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { getCommerceStats } from '../services/commerceStatsService.js';

export function createCommerceStatsRouter({ getStats = getCommerceStats } = {}) {
  const router = Router();

  router.get('/', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.vary('Authorization');
    try {
      return res.json(getStats({ period: req.query?.period }));
    } catch (error) {
      console.error('Commerce stats error:', error);
      return res.status(500).json({ error: 'Не удалось получить статистику покупок и скачиваний' });
    }
  });

  return router;
}

export const commerceStatsRouter = createCommerceStatsRouter();
