/**
 * Send an OTP verification email.
 * Uses HTTP-based email APIs that work natively in Cloudflare Workers.
 * 
 * Priority order:
 * 1. Resend API (if RESEND_API_KEY is set)
 * 2. Brevo/Sendinblue API (if BREVO_API_KEY is set)  
 * 3. Gmail SMTP via worker-mailer (cloudflare:sockets — may fail on some plans)
 *
 * @param {object} env - Worker env bindings
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit code
 * @throws {Error} If all email providers fail
 */
export async function sendOTPEmail(env, to, otp) {
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #6C63FF; margin-bottom: 8px;">CampusHinge</h2>
      <p style="color: #334155; font-size: 15px;">Your verification code is:</p>
      <div style="background: #F3F2FF; border-radius: 8px; padding: 18px; text-align: center; margin: 18px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6C63FF;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code expires in 10 minutes.<br/>Do not share this code with anyone.</p>
    </div>
  `;

  const textBody = `Your CampusHinge verification code is: ${otp}\n\nThis code expires in 10 minutes.\nDo not share it with anyone.`;
  const subject = `${otp} is your CampusHinge verification code`;
  const fromEmail = env.SMTP_USER || 'dd961847@gmail.com';
  const fromName = 'CampusHinge';

  const errors = [];

  // ─── 1. Try Resend API ───
  if (env.RESEND_API_KEY) {
    try {
      console.log(`📧 [EMAIL] Sending to ${to} via Resend API…`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${env.RESEND_FROM || 'onboarding@resend.dev'}>`,
          to: [to],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [EMAIL] Sent via Resend to ${to} (id: ${data.id})`);
        return;
      }
      const errText = await res.text();
      throw new Error(`Resend API ${res.status}: ${errText}`);
    } catch (err) {
      console.error(`⚠️ [EMAIL] Resend failed:`, err.message);
      errors.push(`Resend: ${err.message}`);
    }
  }

  // ─── 2. Try Brevo (Sendinblue) API ───
  if (env.BREVO_API_KEY) {
    try {
      console.log(`📧 [EMAIL] Sending to ${to} via Brevo API…`);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: htmlBody,
          textContent: textBody,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [EMAIL] Sent via Brevo to ${to} (messageId: ${data.messageId})`);
        return;
      }
      const errText = await res.text();
      throw new Error(`Brevo API ${res.status}: ${errText}`);
    } catch (err) {
      console.error(`⚠️ [EMAIL] Brevo failed:`, err.message);
      errors.push(`Brevo: ${err.message}`);
    }
  }

  // ─── 3. Try worker-mailer SMTP (may fail on some CF plans) ───
  if (env.SMTP_PASS && env.SMTP_PASS !== 'your_app_password') {
    try {
      const { WorkerMailer } = await import('worker-mailer');
      const smtpHost = env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(env.SMTP_PORT || '587', 10);

      console.log(`📧 [EMAIL] Sending to ${to} via SMTP ${smtpHost}:${smtpPort}…`);

      const mailer = await WorkerMailer.connect({
        credentials: {
          username: fromEmail,
          password: env.SMTP_PASS,
        },
        authType: 'plain',
        host: smtpHost,
        port: smtpPort,
        secure: true,
      });

      await mailer.send({
        from: { name: fromName, email: fromEmail },
        to: { email: to },
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`✅ [EMAIL] Sent via SMTP to ${to}`);
      return;
    } catch (err) {
      console.error(`⚠️ [EMAIL] SMTP failed:`, err.message);
      errors.push(`SMTP: ${err.message}`);
    }
  }

  // ─── All providers failed ───
  const noProviderConfigured = !env.RESEND_API_KEY && !env.BREVO_API_KEY && (!env.SMTP_PASS || env.SMTP_PASS === 'your_app_password');
  if (noProviderConfigured) {
    console.error('❌ [EMAIL] No email provider configured! Set RESEND_API_KEY, BREVO_API_KEY, or SMTP_PASS.');
    throw new Error('No email provider configured. Please contact support.');
  }

  console.error(`❌ [EMAIL] All providers failed for ${to}:`, errors.join(' | '));
  throw new Error(`Failed to send verification email. Please try again.`);
}

/**
 * Send a Super Like notification email.
 */
export async function sendSuperLikeEmail(env, to, senderName, sharedInterests = []) {
  const topInterests = sharedInterests.slice(0, 3).join(', ');
  const interestsText = topInterests ? ` including ${topInterests}` : '';
  const count = sharedInterests.length;

  const subject = 'You got a Super Like on CampusHinge ⭐';
  const ctaUrl = 'https://campushinge.pages.dev/notifications';
  const textBody = `${senderName} Super Liked your profile — you both share ${count} interests${interestsText}. Open CampusHinge to see their profile and like back to start chatting.`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 28px; background: #090a10; color: #f8fafc; border-radius: 16px; border: 1px solid rgba(255,215,0,0.3);">
      <div style="display: inline-block; background: linear-gradient(135deg, #ffd700, #ff8c00); color: #000; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px;">
        ⭐ Super Like
      </div>
      <h2 style="color: #ffd700; font-size: 22px; margin: 0 0 12px 0;">You got a Super Like!</h2>
      <p style="color: #f8fafc; font-size: 15px; line-height: 1.5; margin-bottom: 18px;">
        ${textBody}
      </p>
      <div style="background: rgba(255, 215, 0, 0.08); border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 10px; padding: 12px; margin-bottom: 20px;">
        <span style="font-size: 13px; color: #fcd34d; font-weight: 600;">✨ Shared Interests (${count}):</span>
        <div style="color: #ffffff; font-size: 14px; margin-top: 4px;">
          ${sharedInterests.join(' • ')}
        </div>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${ctaUrl}" style="background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%); color: #000; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 700; font-size: 14px; display: inline-block;">
          View Super Like ⭐
        </a>
      </div>
    </div>
  `;

  const fromEmail = env.SMTP_USER || 'dd961847@gmail.com';
  const fromName = 'CampusHinge';

  // 1. Resend
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${env.RESEND_FROM || 'onboarding@resend.dev'}>`,
          to: [to],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });
      if (res.ok) {
        console.log(`✅ [SUPER LIKE EMAIL] Sent via Resend to ${to}`);
        return;
      }
    } catch (err) {
      console.warn(`⚠️ [SUPER LIKE EMAIL] Resend failed:`, err.message);
    }
  }

  // 2. Brevo
  if (env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: htmlBody,
          textContent: textBody,
        }),
      });
      if (res.ok) {
        console.log(`✅ [SUPER LIKE EMAIL] Sent via Brevo to ${to}`);
        return;
      }
    } catch (err) {
      console.warn(`⚠️ [SUPER LIKE EMAIL] Brevo failed:`, err.message);
    }
  }
}

