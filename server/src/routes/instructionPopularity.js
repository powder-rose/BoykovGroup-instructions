import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';

import { getInstructionPopularity } from '../services/instructionPopularityService.js';

export const instructionPopularityRouter = Router();

instructionPopularityRouter.get('/', requireAdmin, (req, res) => {
  try {
    const result = getInstructionPopularity({
      period: String(req.query?.period ?? 'total'),

      limit: 10,
    });

    res.set('Cache-Control', 'no-store');

    return res.json(result);
  } catch (error) {
    console.error('Instruction popularity error:', error);

    return res.status(500).json({
      error: 'Не удалось получить статистику просмотров',
    });
  }
});
