const { Router } = require('express');
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { subscribe, handleWebhook } = require('../controllers/subscription.controller');

const router = Router();

// POST /api/subscribe — create a subscription (requires auth)
router.post('/', authenticate, subscribe);

// POST /api/subscribe/webhook — Razorpay webhook (no auth, but signature-verified)
// Needs raw body for signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    req.rawBody = req.body.toString();
    req.body = JSON.parse(req.body);
    next();
  },
  handleWebhook
);

module.exports = router;
