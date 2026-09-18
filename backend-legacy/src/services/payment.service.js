const env = require('../config/env');

/**
 * Payment service — abstracts Razorpay subscription creation.
 * 
 * In development/mock mode, returns fake subscription data.
 * In production, uses the Razorpay SDK.
 *
 * This is the ONLY file that touches Razorpay directly — swap this to change payment provider.
 */

let razorpayInstance;

function getRazorpay() {
  if (razorpayInstance) return razorpayInstance;

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET ||
      env.RAZORPAY_KEY_ID === 'your_razorpay_key_id') {
    console.warn('⚠️  Razorpay not configured — payments will be mocked.');
    return null;
  }

  const Razorpay = require('razorpay');
  razorpayInstance = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });

  return razorpayInstance;
}

/**
 * Create a subscription for a user.
 * @param {string} userId - Internal user ID
 * @param {string} email - User's email
 * @returns {{ subscriptionId: string, shortUrl?: string, mock: boolean }}
 */
async function createSubscription(userId, email) {
  const rp = getRazorpay();

  // Mock mode
  if (!rp) {
    const mockId = `mock_sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      subscriptionId: mockId,
      shortUrl: `https://rzp.io/mock/${mockId}`,
      mock: true,
    };
  }

  // Real Razorpay call
  const subscription = await rp.subscriptions.create({
    plan_id: env.RAZORPAY_PLAN_ID,
    customer_notify: 1,
    total_count: 1,
    notes: {
      user_id: userId,
      email: email,
    },
  });

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url,
    mock: false,
  };
}

/**
 * Verify Razorpay webhook signature.
 * @param {string} body - Raw request body
 * @param {string} signature - X-Razorpay-Signature header value
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature) {
  const rp = getRazorpay();

  if (!rp) {
    // In mock mode, always verify
    return true;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

module.exports = { createSubscription, verifyWebhookSignature };
