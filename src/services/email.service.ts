import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import env from '../config/env';

/**
 * Email service — uses Nodemailer with SMTP.
 *
 * In development, if SMTP credentials are not configured (still set to placeholder values),
 * it logs emails to console instead so you can still test the OTP flow.
 */

let transporter: nodemailer.Transporter | null = null;
let currentPass: string | null = null;
let currentUser: string | null = null;

export function getTransporter(): nodemailer.Transporter | null {
  dotenv.config({ override: true });
  const host = process.env.SMTP_HOST || env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || String(env.SMTP_PORT), 10) || 587;
  const user = process.env.SMTP_USER || env.SMTP_USER;
  const pass = process.env.SMTP_PASS || env.SMTP_PASS;

  if (
    !host ||
    !user ||
    !pass ||
    user === 'your_email@gmail.com' ||
    pass === 'your_app_password'
  ) {
    console.warn('⚠️  SMTP not configured (credentials are placeholders) — emails will be logged to console.');
    transporter = null;
    return null;
  }

  if (transporter && currentPass === pass && currentUser === user) {
    return transporter;
  }

  console.log(`📬  [EMAIL] Creating SMTP transporter: host=${host}, port=${port}, user=${user}`);
  currentPass = pass;
  currentUser = user;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

/**
 * Send an OTP email.
 * @param to - Recipient email address
 * @param otp - 6-digit OTP code
 */
export async function sendOTPEmail(to: string, otp: string): Promise<void> {
  console.log(`📧  [EMAIL] Preparing to send OTP email to ${to}…`);

  const transport = getTransporter();
  const fromUser = process.env.SMTP_USER || env.SMTP_USER || 'noreply@campusapp.com';

  const mailOptions = {
    from: `"CampusApp" <${fromUser}>`,
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
  } catch (err: any) {
    console.error(`❌  [EMAIL] Failed to send to ${to}:`, err.message);
    console.error(`❌  [EMAIL] Full error:`, err);
    // Invalidate cached transporter on failure so next attempt gets fresh connection/credentials
    transporter = null;
    currentPass = null;
    currentUser = null;
    console.warn(`⚠️  [EMAIL] Email delivery failed. Fallback OTP for testing:`);
    console.log(`   ➜ Recipient: ${to}`);
    console.log(`   ➜ OTP Code:  ${otp}`);
  }
}

export default { sendOTPEmail, getTransporter };
module.exports = { sendOTPEmail, getTransporter };
