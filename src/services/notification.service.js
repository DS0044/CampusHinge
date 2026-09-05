const db = require('../config/db');
const { sendOTPEmail } = require('./email.service');
const nodemailer = require('nodemailer');
const env = require('../config/env');

/**
 * Creates a 'like' notification and sends a debounced transactional email if opted in.
 */
async function createLikeNotification(fromUserId, toUserId) {
  try {
    const crypto = require('crypto');
    const nowIso = new Date().toISOString();

    // Check for existing notification from this user to prevent duplicates
    const { rows: existing } = await db.query(
      `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`,
      [toUserId, fromUserId]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE notifications
         SET type = 'like', is_read = 0, is_seen = 0, created_at = $1
         WHERE id = $2`,
        [nowIso, existing[0].id]
      );
    } else {
      const notifId = crypto.randomUUID();
      await db.query(
        `INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at)
         VALUES ($1, $2, $3, 'like', $4)`,
        [notifId, toUserId, fromUserId, nowIso]
      );
    }

    // 2. Fetch recipient info and email_notifications preference
    const { rows: recipientRows } = await db.query(
      `SELECT email, email_notifications FROM users WHERE id = $1`,
      [toUserId]
    );

    if (recipientRows.length === 0) return;
    const recipient = recipientRows[0];

    // Check if opted out of email notifications (1 = enabled, 0 = disabled)
    if (recipient.email_notifications === 0 || recipient.email_notifications === false) {
      console.log(`🔕  [NOTIF EMAIL] User ${toUserId} has opted out of email notifications.`);
      return;
    }

    // 3. Send transactional email notification to recipient
    await sendLikeDigestEmail(recipient.email, 1);
  } catch (err) {
    console.error('❌  Error creating like notification:', err.message);
  }
}

/**
 * Sends transactional email for likes (identity gated, no name/photo).
 */
async function sendLikeDigestEmail(toEmail, count = 1) {
  console.log(`📧  [NOTIF EMAIL] Preparing like notification email to ${toEmail}…`);

  const subject = count > 1 ? `You have ${count} new likes on CampusHinge 👀` : 'Someone likes your profile 👀';
  const ctaUrl = 'http://localhost:5173/notifications';

  const html = `
    <div style="font-family: 'Outfit', 'Inter', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 28px; background: #090a10; color: #f8fafc; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="background: linear-gradient(135deg, #ff4081 0%, #ff6b6b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 24px; margin-bottom: 12px; margin-top: 0;">
        CampusHinge
      </h2>
      <p style="color: #f8fafc; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
        A fellow VIT Bhopal student liked your profile! Open the app to see who likes you and match back.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ctaUrl}" style="background: linear-gradient(135deg, #ff4081 0%, #ff6b6b 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 9999px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(255,64,129,0.3);">
          Open App to View Like 💖
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">
        You can manage email notifications anytime in your CampusHinge profile settings.
      </p>
    </div>
  `;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_USER !== 'your_email@gmail.com') {
    try {
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });

      await transporter.sendMail({
        from: `"CampusHinge" <${env.SMTP_USER}>`,
        to: toEmail,
        subject,
        html,
      });
      console.log(`✅  [NOTIF EMAIL] Sent to ${toEmail}`);
    } catch (err) {
      console.error(`❌  [NOTIF EMAIL] SMTP error sending to ${toEmail}:`, err.message);
    }
  } else {
    console.log('');
    console.log('📧  [NOTIF EMAIL STUB] ═══════════════════════════════════');
    console.log(`   To:      ${toEmail}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   CTA:     ${ctaUrl}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
  }
}

module.exports = { createLikeNotification, sendLikeDigestEmail };
