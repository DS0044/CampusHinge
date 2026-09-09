import nodemailer from 'nodemailer';

/**
 * Send an OTP verification email.
 * Supports SMTP (e.g. Gmail) or Resend API or console fallback.
 *
 * @param {object} env - Worker env bindings
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit code
 */
export async function sendOTPEmail(env, to, otp) {
  const smtpUser = env.SMTP_USER || 'dd961847@gmail.com';
  const smtpPass = env.SMTP_PASS || 'hvwibnrrdjadptve';
  const smtpHost = env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(env.SMTP_PORT || '587', 10);

  // 1. Try SMTP if configured
  if (smtpUser && smtpPass && smtpPass !== 'your_app_password') {
    try {
      console.log(`📧 [EMAIL] Sending OTP to ${to} via SMTP (${smtpHost}:${smtpPort})…`);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"CampusHinge" <${smtpUser}>`,
        to,
        subject: `${otp} is your CampusHinge verification code`,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #6C63FF; margin-bottom: 8px;">CampusHinge</h2>
            <p style="color: #333;">Your verification code is:</p>
            <div style="background: #F3F2FF; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6C63FF;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.<br/>Do not share it with anyone.</p>
          </div>
        `,
      });
      console.log(`✅ [EMAIL] Sent successfully to ${to}`);
      return;
    } catch (err) {
      console.error(`❌ [EMAIL SMTP Error]:`, err.message);
    }
  }

  // 2. Try Resend if configured
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
        from: env.EMAIL_FROM || 'CampusHinge <noreply@campushinge.com>',
        to: [to],
        subject: `${otp} is your CampusHinge verification code`,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #6C63FF; margin-bottom: 8px;">CampusHinge</h2>
            <p style="color: #333;">Your verification code is:</p>
            <div style="background: #F3F2FF; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6C63FF;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.<br/>Do not share it with anyone.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ [EMAIL] Failed: ${res.status} ${errText}`);
    } else {
      console.log(`✅ [EMAIL] Sent to ${to}`);
    }
  } catch (err) {
    console.error(`❌ [EMAIL] Error: ${err.message}`);
    }
  }

  // 3. Fallback: log to console if no email provider configured
  if (!env.RESEND_API_KEY && (!smtpUser || !smtpPass)) {
    console.log(`📧 [EMAIL STUB] To: ${to} | OTP: ${otp}`);
  }
}
