import { Router } from 'express';

import { requireAdmin } from '../middleware/auth.js';

import {
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  resolvePromoCode,
} from '../services/promoCodeService.js';

import { PUBLIC_GENERATION_PRICE_RUB } from '../services/publicGenerationOrderService.js';

export const promoCodesRouter = Router();

/*
 * Публичная проверка.
 *
 * Клиент может узнать только:
 * - валиден ли код;
 * - какая будет итоговая цена.
 */
promoCodesRouter.post(
  '/validate',

  (req, res) => {
    const result = resolvePromoCode(req.body?.code, PUBLIC_GENERATION_PRICE_RUB);

    if (!result.ok) {
      return res.status(422).json(result);
    }

    return res.json(result);
  },
);

/*
 * ADMIN — список.
 */
promoCodesRouter.get(
  '/admin',

  requireAdmin,

  (req, res) => {
    return res.json({
      items: listPromoCodes(),
    });
  },
);

/*
 * ADMIN — создание.
 */
promoCodesRouter.post(
  '/admin',

  requireAdmin,

  (req, res) => {
    try {
      const promo = createPromoCode(req.body ?? {});

      return res.status(201).json({
        promo,
      });
    } catch (error) {
      return res.status(422).json({
        error: error?.message || 'Не удалось создать промокод',
      });
    }
  },
);

/*
 * ADMIN — изменение.
 */
promoCodesRouter.patch(
  '/admin/:id',

  requireAdmin,

  (req, res) => {
    try {
      const promo = updatePromoCode(req.params.id, req.body ?? {});

      if (!promo) {
        return res.status(404).json({
          error: 'Промокод не найден',
        });
      }

      return res.json({
        promo,
      });
    } catch (error) {
      return res.status(422).json({
        error: error?.message || 'Не удалось изменить промокод',
      });
    }
  },
);

/*
 * ADMIN — удаление.
 */
promoCodesRouter.delete(
  '/admin/:id',

  requireAdmin,

  (req, res) => {
    const deleted = deletePromoCode(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Промокод не найден',
      });
    }

    return res.json({
      ok: true,
    });
  },
);
