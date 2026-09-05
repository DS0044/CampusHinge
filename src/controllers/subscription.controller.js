const db = require('../config/db');
const env = require('../config/env');
const { createSubscription, verifyWebhookSignature } = require('../services/payment.service');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/subscribe
 * Creates a Razorpay subscription order for the authenticated user.
 */
async function subscribe(req, res, next) {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    // Check if user already has active subscription
    const { rows: userRows } = await db.query(
      `SELECT subscription_status, subscription_expiry FROM users WHERE id = $1`,
      [userId]
    );

    if (
      userRows[0].subscription_status === 'active' &&
      userRows[0].subscription_expiry &&
      new Date(userRows[0].subscription_expiry) > new Date()
    ) {
      throw new AppError('You already have an active subscription.', 400);
    }

    // Create subscription via payment service
    const { subscriptionId, shortUrl, mock } = await createSubscription(userId, email);

    // Store subscription record
    await db.query(
      `INSERT INTO subscriptions (user_id, razorpay_subscription_id, status)
       VALUES ($1, $2, 'pending')`,
      [userId, subscriptionId]
    );

    // If mock mode, auto-activate the subscription for testing
    if (mock) {
      const expiresAt = new Date(Date.now() + env.SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      await db.query(
        `UPDATE subscriptions SET status = 'active', activated_at = NOW(), expires_at = $1
         WHERE razorpay_subscription_id = $2`,
        [expiresAt, subscriptionId]
      );

      await db.query(
        `UPDATE users SET subscription_status = 'active', subscription_expiry = $1, updated_at = NOW()
         WHERE id = $2`,
        [expiresAt, userId]
      );

      // Unlock all existing matches for this user
      await db.query(
        `UPDATE matches SET is_unlocked = true
         WHERE (user1_id = $1 OR user2_id = $1) AND is_unlocked = false`,
        [userId]
      );

      return res.status(200).json({
        success: true,
        message: 'Subscription activated (mock mode).',
        data: {
          subscription_id: subscriptionId,
          status: 'active',
          expires_at: expiresAt,
          mock: true,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription created. Complete payment to activate.',
      data: {
        subscription_id: subscriptionId,
        payment_url: shortUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/subscribe/webhook
 * Razorpay webhook handler — receives payment confirmation.
 * Must use raw body for signature verification.
 */
async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!verifyWebhookSignature(rawBody, signature)) {
      throw new AppError('Invalid webhook signature.', 400);
    }

    const event = req.body;
    const eventType = event.event;

    if (eventType === 'subscription.activated' || eventType === 'subscription.charged') {
      const subscriptionId = event.payload?.subscription?.entity?.id;

      if (!subscriptionId) {
        throw new AppError('Missing subscription ID in webhook payload.', 400);
      }

      // Find our subscription record
      const { rows } = await db.query(
        `SELECT id, user_id FROM subscriptions WHERE razorpay_subscription_id = $1`,
        [subscriptionId]
      );

      if (rows.length === 0) {
        console.warn(`⚠️  Webhook: subscription not found: ${subscriptionId}`);
        return res.status(200).json({ success: true }); // ACK to prevent retries
      }

      const userId = rows[0].user_id;
      const expiresAt = new Date(Date.now() + env.SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      // Activate subscription
      await db.query(
        `UPDATE subscriptions SET status = 'active', activated_at = NOW(), expires_at = $1
         WHERE razorpay_subscription_id = $2`,
        [expiresAt, subscriptionId]
      );

      // Update user's subscription status
      await db.query(
        `UPDATE users SET subscription_status = 'active', subscription_expiry = $1, updated_at = NOW()
         WHERE id = $2`,
        [expiresAt, userId]
      );

      // Unlock all existing matches for this user
      await db.query(
        `UPDATE matches SET is_unlocked = true
         WHERE (user1_id = $1 OR user2_id = $1) AND is_unlocked = false`,
        [userId]
      );

      console.log(`✅  Subscription activated for user ${userId}, expires ${expiresAt}`);
    }

    // Always ACK webhook
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { subscribe, handleWebhook };
