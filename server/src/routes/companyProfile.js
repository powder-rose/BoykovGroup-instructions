import { Router } from 'express';
import { getUserById } from '../services/userService.js';
import {
  companyProfileRepository,
  notifyCompanyProfileSaved,
} from '../services/companyProfileService.js';

export function createCompanyProfileRouter({
  userLookup = getUserById,
  store = companyProfileRepository,
  notifier = notifyCompanyProfileSaved,
} = {}) {
  const router = Router();

  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.vary('Authorization');
    if (req.user?.role !== 'user' || typeof req.user.sub !== 'string') {
      return res.status(401).json({ error: 'Войдите в личный кабинет' });
    }
    try {
      const user = userLookup(req.user.sub);
      if (!user || user.role !== 'user' || user.id !== req.user.sub) {
        return res.status(401).json({ error: 'Войдите в личный кабинет' });
      }
      req.companyProfileUser = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get('/', (req, res, next) => {
    try {
      res.json(store.getView(req.companyProfileUser.id));
    } catch (error) {
      next(error);
    }
  });

  router.put('/', (req, res, next) => {
    try {
      const view = store.save(req.companyProfileUser, req.body?.companyProfile);
      // The durable outbox is already committed. Wake the worker without waiting for SMTP.
      try {
        notifier();
      } catch {
        console.warn('[CompanyProfileMail] Worker wake deferred; notification remains queued');
      }
      res.json(view);
    } catch (error) {
      next(error);
    }
  });

  router.post('/dismiss', (req, res, next) => {
    try {
      res.json(store.dismiss(req.companyProfileUser.id));
    } catch (error) {
      next(error);
    }
  });

  router.use((error, _req, res, _next) => {
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message, field: error.field });
    }
    console.error('[CompanyProfile] Unable to access company profile storage');
    return res.status(500).json({ error: 'Не удалось сохранить или загрузить данные компании' });
  });

  return router;
}

export const companyProfileRouter = createCompanyProfileRouter();
