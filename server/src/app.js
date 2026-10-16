import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { attachUser } from './middleware/auth.js';
import { adminInstructionsRouter } from './routes/adminInstructions.js';
import { instructionPagesRouter } from './routes/instructionPages.js';

import { createRateLimiters } from './middleware/rateLimits.js';

import { authRouter } from './routes/auth.js';
import { companyProfileRouter } from './routes/companyProfile.js';
import { walletRouter } from './routes/wallet.js';
import { walletWebhookRouter } from './routes/walletWebhook.js';

import { cloudPaymentsWebhookRouter } from './routes/cloudPaymentsWebhook.js';

import { importsRouter } from './routes/imports.js';

import { instructionPdfRouter } from './routes/instructionPdf.js';

import { instructionPopularityRouter } from './routes/instructionPopularity.js';
import { commerceStatsRouter } from './routes/commerceStats.js';

import { instructionsRouter } from './routes/instructions.js';

import { instructionViewsRouter } from './routes/instructionViews.js';

import { promoCodesRouter } from './routes/promoCodes.js';

import { publicGenerationRouter } from './routes/publicGeneration.js';

import { publicGenerationCheckoutRouter } from './routes/publicGenerationCheckout.js';

import seoRouter from './routes/seo.js';

import { thanksRouter } from './routes/thanks.js';

import { visitorStatsRouter } from './routes/visitorStats.js';

import { isAdminConfigured } from './services/authService.js';

import { isYandexGptConfigured } from './services/yandexGptService.js';

export function createApp({
  clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173',
} = {}) {
  const app = express();

  /*
   * Production topology:
   *
   * Internet -> system nginx -> Docker nginx -> Node.
   *
   * Trust exactly the two reverse-proxy hops nearest
   * the application. The edge nginx is responsible
   * for replacing untrusted client X-Forwarded-For.
   */
  app.set('trust proxy', 2);

  const rateLimits = createRateLimiters();

  app.use(
    cors({
      origin: clientOrigin,
    }),
  );

  app.use('/api/public-generation/cloudpayments', walletWebhookRouter, cloudPaymentsWebhookRouter);

  app.use('/api/admin/instructions', express.json({ limit: '2mb' }));
  app.use(express.json());

  app.use(morgan('dev'));

  app.use(attachUser);

  /*
   * Public abuse controls.
   *
   * CloudPayments webhook is intentionally not included:
   * its authenticity is enforced separately with HMAC.
   */
  app.post('/api/auth/login', rateLimits.loginIp, rateLimits.loginIdentity);

  app.post('/api/auth/register', rateLimits.registration);

  app.post('/api/auth/resend-verification', rateLimits.resendVerification);

  app.put('/api/account/company-profile', rateLimits.companyProfileWrite);
  app.post('/api/account/company-profile/dismiss', rateLimits.companyProfileWrite);

  app.post('/api/account/wallet/topups', rateLimits.walletWrite);
  app.post('/api/account/wallet/topups/:id/confirm', rateLimits.walletConfirmation);
  app.post('/api/account/wallet/purchases', rateLimits.walletWrite);

  app.post('/api/promo-codes/validate', rateLimits.promoValidation);

  app.post('/api/public-generation/validate', rateLimits.publicGenerationValidation);

  app.post('/api/public-generation/orders', rateLimits.publicOrderCreation);

  app.post('/api/public-generation/orders/:id/confirm-payment', rateLimits.paymentConfirmation);

  app.post('/api/visitor-stats/visit', rateLimits.analyticsWrite);

  app.post('/api/instructions/:id/view', rateLimits.analyticsWrite);

  app.use('/api/imports', importsRouter);

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,

      yandexGptConfigured: isYandexGptConfigured(),

      adminConfigured: isAdminConfigured(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/account/company-profile', companyProfileRouter);
  app.use('/api/account/wallet', walletRouter);
  app.use('/api/admin/instructions', adminInstructionsRouter);

  app.use('/api/promo-codes', promoCodesRouter);

  app.use('/api/public-generation', publicGenerationCheckoutRouter);

  app.use('/api/public-generation', publicGenerationRouter);

  app.use('/api/instructions', instructionPdfRouter);

  app.use('/api/admin/instruction-popularity', instructionPopularityRouter);
  app.use('/api/admin/commerce-stats', commerceStatsRouter);

  app.use('/api/visitor-stats', visitorStatsRouter);

  app.use('/api/instructions', instructionViewsRouter);

  app.use('/api/instructions', instructionPagesRouter);

  app.use('/api/instructions', instructionsRouter);

  app.use('/', seoRouter);

  app.use('/', thanksRouter);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Маршрут не найден',
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Текст превышает допустимый размер запроса' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Некорректный JSON в запросе' });
    }
    console.error(err);

    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
    });
  });

  return app;
}
