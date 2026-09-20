import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { subscribe, handleWebhook } from '../controllers/subscription.controller';

const router = Router();

// POST /api/subscribe — create a subscription (requires auth)
router.post('/', authenticate, subscribe);

// POST /api/subscribe/webhook — Razorpay webhook (no auth, but signature-verified)
// Needs raw body for signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, _res: Response, next: NextFunction) => {
    (req as any).rawBody = req.body.toString();
    req.body = JSON.parse(req.body);
    next();
  },
  handleWebhook
);

export default router;
module.exports = router;
