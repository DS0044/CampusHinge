/**
 * Subscription Routes — Razorpay integration
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const subscription = new Hono();

// POST /api/subscribe — Create subscription
subscription.post('/', authenticate(), async (c) => {
  const userId = c.get('user').id;
  const email = c.get('user').email;
  const db = c.env.DB;
  const env = c.env;

  const { rows: userRows } = await query(db, `SELECT subscription_status, subscription_expiry FROM users WHERE id = $1`, [userId]);
  if (userRows[0].subscription_status === 'active' && userRows[0].subscription_expiry && new Date(userRows[0].subscription_expiry) > new Date()) {
    return c.json({ success: false, error: { message: 'You already have an active subscription.' } }, 400);
  }

  const isMock = !env.RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID === 'your_razorpay_key_id';
  let subscriptionId, shortUrl;

  if (isMock) {
    subscriptionId = `mock_sub_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    shortUrl = `https://rzp.io/mock/${subscriptionId}`;
  } else {
    // Real Razorpay call via fetch
    const rpAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const rpRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${rpAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: env.RAZORPAY_PLAN_ID, customer_notify: 1, total_count: 1, notes: { user_id: userId, email } }),
    });
    const rpData = await rpRes.json();
    subscriptionId = rpData.id;
    shortUrl = rpData.short_url;
  }

  const subRecordId = crypto.randomUUID();
  await query(db, `INSERT INTO subscriptions (id, user_id, razorpay_subscription_id, status) VALUES ($1, $2, $3, 'pending')`,
    [subRecordId, userId, subscriptionId]);

  // Mock auto-activate
  if (isMock) {
    const days = parseInt(env.SUBSCRIPTION_DURATION_DAYS || '35');
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const now = new Date().toISOString();
    await query(db, `UPDATE subscriptions SET status = 'active', activated_at = $1, expires_at = $2 WHERE razorpay_subscription_id = $3`, [now, expiresAt, subscriptionId]);
    await query(db, `UPDATE users SET subscription_status = 'active', subscription_expiry = $1, updated_at = $2 WHERE id = $3`, [expiresAt, now, userId]);
    await query(db, `UPDATE matches SET is_unlocked = 1 WHERE (user1_id = $1 OR user2_id = $1) AND is_unlocked = 0`, [userId]);
    return c.json({ success: true, message: 'Subscription activated (mock mode).', data: { subscription_id: subscriptionId, status: 'active', expires_at: expiresAt, mock: true } });
  }

  return c.json({ success: true, message: 'Subscription created. Complete payment to activate.', data: { subscription_id: subscriptionId, payment_url: shortUrl } });
});

// POST /api/subscribe/webhook — Razorpay webhook
subscription.post('/webhook', async (c) => {
  const db = c.env.DB;
  const env = c.env;
  const body = await c.req.text();
  const signature = c.req.header('x-razorpay-signature');

  // Verify signature (skip in mock mode)
  if (env.RAZORPAY_WEBHOOK_SECRET && signature) {
    const key = new TextEncoder().encode(env.RAZORPAY_WEBHOOK_SECRET);
    const data = new TextEncoder().encode(body);
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (expected !== signature) return c.json({ success: false, error: { message: 'Invalid signature.' } }, 400);
  }

  const event = JSON.parse(body);
  if (event.event === 'subscription.activated' || event.event === 'subscription.charged') {
    const subId = event.payload?.subscription?.entity?.id;
    if (!subId) return c.json({ success: true });

    const { rows } = await query(db, `SELECT id, user_id FROM subscriptions WHERE razorpay_subscription_id = $1`, [subId]);
    if (rows.length === 0) return c.json({ success: true });

    const userId = rows[0].user_id;
    const days = parseInt(env.SUBSCRIPTION_DURATION_DAYS || '35');
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const now = new Date().toISOString();

    await query(db, `UPDATE subscriptions SET status = 'active', activated_at = $1, expires_at = $2 WHERE razorpay_subscription_id = $3`, [now, expiresAt, subId]);
    await query(db, `UPDATE users SET subscription_status = 'active', subscription_expiry = $1, updated_at = $2 WHERE id = $3`, [expiresAt, now, userId]);
    await query(db, `UPDATE matches SET is_unlocked = 1 WHERE (user1_id = $1 OR user2_id = $1) AND is_unlocked = 0`, [userId]);
  }

  return c.json({ success: true });
});

export default subscription;
