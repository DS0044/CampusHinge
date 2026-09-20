import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from '../config/db';
import env from '../config/env';
import { createSubscription, verifyWebhookSignature } from '../services/payment.service';
import { AppError } from '../middleware/errorHandler';

/**
 * POST /api/subscribe
 * Creates a Razorpay subscription order for the authenticated user.
 */
export async function subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;

    // Check if user already has active subscription
    const { rows: userRows } = await db.query<{
      subscription_status: string;
      subscription_expiry: string | null;
    }>(
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

    const { subscriptionId, shortUrl, mock } = await createSubscription(userId, email);

    const subRecordId = crypto.randomUUID();
    await db.query(
      `INSERT INTO subscriptions (id, user_id, razorpay_subscription_id, status)
       VALUES ($1, $2, $3, 'pending')`,
      [subRecordId, userId, subscriptionId]
    );

    // If mock mode, auto-activate the subscription for testing
    if (mock) {
      const expiresAt = new Date(Date.now() + env.SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);
      const nowIso = new Date().toISOString();

      await db.query(
        `UPDATE subscriptions SET status = 'active', activated_at = $1, expires_at = $2
         WHERE razorpay_subscription_id = $3`,
        [nowIso, expiresAt.toISOString(), subscriptionId]
      );

      await db.query(
        `UPDATE users SET subscription_status = 'active', subscription_expiry = $1, updated_at = $2
         WHERE id = $3`,
        [expiresAt.toISOString(), nowIso, userId]
      );

      // Unlock all existing matches for this user
      await db.query(
        `UPDATE matches SET is_unlocked = 1
         WHERE (user1_id = $1 OR user2_id = $1) AND is_unlocked = 0`,
        [userId]
      );

      res.status(200).json({
        success: true,
        message: 'Subscription activated (mock mode).',
        data: {
          subscription_id: subscriptionId,
          status: 'active',
          expires_at: expiresAt,
          mock: true,
        },
      });
      return;
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
 */
export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody;

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

      const { rows } = await db.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM subscriptions WHERE razorpay_subscription_id = $1`,
        [subscriptionId]
      );

      if (rows.length === 0) {
        console.warn(`⚠️  Webhook: subscription not found: ${subscriptionId}`);
        res.status(200).json({ success: true });
        return;
      }

      const userId = rows[0].user_id;
      const expiresAt = new Date(Date.now() + env.SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);
      const nowIso = new Date().toISOString();

      await db.query(
        `UPDATE subscriptions SET status = 'active', activated_at = $1, expires_at = $2
         WHERE razorpay_subscription_id = $3`,
        [nowIso, expiresAt.toISOString(), subscriptionId]
      );

      await db.query(
        `UPDATE users SET subscription_status = 'active', subscription_expiry = $1, updated_at = $2
         WHERE id = $3`,
        [expiresAt.toISOString(), nowIso, userId]
      );

      await db.query(
        `UPDATE matches SET is_unlocked = 1
         WHERE (user1_id = $1 OR user2_id = $1) AND is_unlocked = 0`,
        [userId]
      );

      console.log(`✅  Subscription activated for user ${userId}, expires ${expiresAt}`);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

export default { subscribe, handleWebhook };
module.exports = { subscribe, handleWebhook };
