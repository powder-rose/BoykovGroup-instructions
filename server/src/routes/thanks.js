import { Router } from 'express';

import path from 'node:path';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const THANKS_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'public_html',
  'thanks',
  'index.html',
);

export const thanksRouter = Router();

thanksRouter.get(
  ['/thanks', '/thanks/'],

  (req, res) => {
    /*
     * Страница содержит состояние
     * конкретного оплаченного заказа,
     * поэтому HTML не кэшируем.
     */
    res.set('Cache-Control', 'no-store');

    return res.sendFile(THANKS_FILE);
  },
);
