import express, { Router } from 'express';
import {
  verifyCloudPaymentsHmac,
  parseCloudPaymentsNotification,
} from '../utils/cloudPaymentsNotification.js';
import { walletPaymentService } from '../services/walletPaymentService.js';

export function createWalletWebhookRouter({ payments = walletPaymentService } = {}) {
  const router = Router();
  router.post(
    ['/check', '/pay', '/refund'],
    express.raw({ type: '*/*', limit: '100kb' }),
    (req, res, next) => {
      if (!verifyCloudPaymentsHmac(req)) return res.status(403).json({ code: 13 });
      let data;
      try {
        data = parseCloudPaymentsNotification(req);
      } catch {
        return res.status(400).json({ code: 13 });
      }
      if (!String(data?.InvoiceId ?? '').startsWith('wt_')) {
        return req.path === '/refund' ? res.json({ code: 0 }) : next();
      }
      try {
        if (req.path === '/check') return res.json({ code: payments.check(data) });
        if (req.path === '/refund') payments.refund(data);
        else payments.pay(data);
        return res.json({ code: 0 });
      } catch (error) {
        console.error('[Wallet notification]', error.code || 'WALLET_UNAVAILABLE');
        // Ask CloudPayments to retry until the verified operation is durably recorded.
        return res.status(503).json({ code: 13 });
      }
    },
  );
  return router;
}

export const walletWebhookRouter = createWalletWebhookRouter();
