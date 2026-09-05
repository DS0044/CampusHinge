const nodemailer = require('nodemailer');
const env = require('../config/env');

/**
 * Email service — uses Nodemailer with SMTP.
 *
 * In development, if SMTP credentials are not configured (still set to placeholder values),
 * it logs emails to console instead so you can still test the OTP flow.
 */

let transporter;

function isSmtpConfigured() {
  return (
    env.SMTP_HOST &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    env.SMTP_USER !== 'your_email@gmail.com' &&
    env.SMTP_PASS !== 'your_app_password'
  );
}

function getTransporter() {
  if (transporter) return transporter;

  if (!isSmtpConfigured()) {
    console.warn('⚠️  SMTP not configured (credentials are placeholders) — emails will be logged to console.');
    return null;
  }

  console.log(`📬  [EMAIL] Creating SMTP transporter: host=${env.SMTP_HOST}, port=${env.SMTP_PORT}, user=${env.SMTP_USER}`);

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Send an OTP email.
 * @param {string} to - Recipient email address
 * @param {string} otp - 6-digit OTP code
 */
async function sendOTPEmail(to, otp) {
  console.log(`📧  [EMAIL] Preparing to send OTP email to ${to}…`);

  const transport = getTransporter();

  const mailOptions = {
    from: `"CampusApp" <${env.SMTP_USER || 'noreply@campusapp.com'}>`,
    to,
    subject: 'Your CampusApp Verification Code',
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6C63FF; margin-bottom: 8px;">CampusApp</h2>
        <p style="color: #333;">Your verification code is:</p>
        <div style="background: #F3F2FF; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6C63FF;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.<br/>Do not share it with anyone.</p>
      </div>
    `,
  };

  // Stub mode: log to console
  if (!transport) {
    console.log('');
    console.log('📧  [EMAIL STUB] ═══════════════════════════════════');
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    console.log(`   OTP:     ${otp}`);
    console.log('   ─────────────────────────────────────────────────');
    console.log(`   ➜ Use this code to verify: ${otp}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    return;
  }

  // Real SMTP send
  try {
    console.log(`📧  [EMAIL] Sending via SMTP to ${to}…`);
    const info = await transport.sendMail(mailOptions);
    console.log(`✅  [EMAIL] Sent successfully! Message ID: ${info.messageId}`);
  } catch (err) {
    console.error(`❌  [EMAIL] Failed to send to ${to}:`, err.message);
    console.error(`❌  [EMAIL] Full error:`, err);
    // Don't throw — let the OTP flow continue so the user can still test with console OTP
    console.warn(`⚠️  [EMAIL] Email failed but OTP was generated. Check console logs for the code.`);
  }
}

module.exports = { sendOTPEmail };
