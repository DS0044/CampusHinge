/**
 * Email Service — HTTP-based (Workers-compatible).
 *
 * Uses Resend API (or falls back to console logging for dev).
 * Replaces nodemailer which requires Node.js SMTP support.
 */

/**
 * Send an OTP verification email.
 * @param {object} env - Worker env bindings
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit code
 */
export async function sendOTPEmail(env, to, otp) {
  // If no Resend API key, log to console (dev mode)
  if (!env.RESEND_API_KEY) {
    console.log(`📧 [EMAIL STUB] To: ${to} | OTP: ${otp}`);
    return;
  }

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
    // Don't throw — let OTP flow continue so dev can use console OTP
  }
}
