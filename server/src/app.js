import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { attachUser } from './middleware/auth.js';

import { authRouter } from './routes/auth.js';

import { cloudPaymentsWebhookRouter } from './routes/cloudPaymentsWebhook.js';

import { importsRouter } from './routes/imports.js';

import { instructionPdfRouter } from './routes/instructionPdf.js';

import { instructionPopularityRouter } from './routes/instructionPopularity.js';

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

  app.use(
    cors({
      origin: clientOrigin,
    }),
  );

  app.use('/api/public-generation/cloudpayments', cloudPaymentsWebhookRouter);

  app.use(express.json());

  app.use(morgan('dev'));

  app.use(attachUser);

  app.use('/api/imports', importsRouter);

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,

      yandexGptConfigured: isYandexGptConfigured(),

      adminConfigured: isAdminConfigured(),
    });
  });

  app.use('/api/auth', authRouter);

  app.use('/api/promo-codes', promoCodesRouter);

  app.use('/api/public-generation', publicGenerationCheckoutRouter);

  app.use('/api/public-generation', publicGenerationRouter);

  app.use('/api/instructions', instructionPdfRouter);

  app.use('/api/admin/instruction-popularity', instructionPopularityRouter);

  app.use('/api/visitor-stats', visitorStatsRouter);

  app.use('/api/instructions', instructionViewsRouter);

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
    console.error(err);

    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
    });
  });

  return app;
}
