import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';

import { instructionsRepository } from '../services/instructionsRepository.js';

import {
  recordInstructionView,
  getInstructionViewStats,
} from '../services/instructionViewService.js';

export const instructionViewsRouter = Router();

/*
 * Публичная фиксация просмотра.
 */
instructionViewsRouter.post('/:id/view', (req, res) => {
  const instruction = instructionsRepository.getById(req.params.id);

  if (!instruction) {
    return res.status(404).json({
      error: 'Инструкция не найдена',
    });
  }

  try {
    recordInstructionView(instruction.id);

    return res.status(204).end();
  } catch (error) {
    console.error('Instruction view error:', error);

    return res.status(500).json({
      error: 'Не удалось зарегистрировать просмотр',
    });
  }
});

/*
 * Статистика доступна
 * только администратору.
 */
instructionViewsRouter.get('/:id/views', requireAdmin, (req, res) => {
  const instruction = instructionsRepository.getById(req.params.id);

  if (!instruction) {
    return res.status(404).json({
      error: 'Инструкция не найдена',
    });
  }

  return res.json(getInstructionViewStats(instruction.id));
});
