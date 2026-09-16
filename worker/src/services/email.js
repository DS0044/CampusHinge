/**
 * Email service for Cloudflare Workers.
 * Uses HTTP-based email APIs and TCP-socket SMTP that work natively in Cloudflare Workers.
 * 
 * Priority order:
 * 1. Resend API (if RESEND_API_KEY is set)
 * 2. Brevo/Sendinblue API (if BREVO_API_KEY is set)  
 * 3. WorkerMailer SMTP via Cloudflare TCP sockets (if SMTP_PASS is set)
 */

/**
 * Universal email dispatcher across supported providers.
 */
async function sendViaAvailableProviders(env, { to, subject, html, text, logName = 'EMAIL' }) {
  const fromEmail = env.SMTP_USER || 'dd961847@gmail.com';
  const fromName = 'CampusHinge';
  const errors = [];

  // ─── 1. Try Resend API ───
  if (env.RESEND_API_KEY) {
    try {
      console.log(`📧 [${logName}] Sending to ${to} via Resend API…`);
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
          html,
          text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [${logName}] Sent via Resend to ${to} (id: ${data.id})`);
        return;
      }
      const errText = await res.text();
      throw new Error(`Resend API ${res.status}: ${errText}`);
    } catch (err) {
      console.error(`⚠️ [${logName}] Resend failed:`, err.message);
      errors.push(`Resend: ${err.message}`);
    }
  }

  // ─── 2. Try Brevo (Sendinblue) API ───
  if (env.BREVO_API_KEY) {
    try {
      console.log(`📧 [${logName}] Sending to ${to} via Brevo API…`);
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
          htmlContent: html,
          textContent: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [${logName}] Sent via Brevo to ${to} (messageId: ${data.messageId})`);
        return;
      }
      const errText = await res.text();
      throw new Error(`Brevo API ${res.status}: ${errText}`);
    } catch (err) {
      console.error(`⚠️ [${logName}] Brevo failed:`, err.message);
      errors.push(`Brevo: ${err.message}`);
    }
  }

  // ─── 3. Try worker-mailer SMTP (TCP socket support in CF Workers) ───
  if (env.SMTP_PASS && env.SMTP_PASS !== 'your_app_password') {
    try {
      const { WorkerMailer } = await import('worker-mailer');
      const smtpHost = env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(env.SMTP_PORT || '587', 10);

      console.log(`📧 [${logName}] Sending to ${to} via SMTP ${smtpHost}:${smtpPort}…`);

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
        text,
        html,
      });

      console.log(`✅ [${logName}] Sent via SMTP to ${to}`);
      return;
    } catch (err) {
      console.error(`⚠️ [${logName}] SMTP failed:`, err.message);
      errors.push(`SMTP: ${err.message}`);
    }
  }

  // ─── All providers failed ───
  const noProviderConfigured = !env.RESEND_API_KEY && !env.BREVO_API_KEY && (!env.SMTP_PASS || env.SMTP_PASS === 'your_app_password');
  if (noProviderConfigured) {
    console.error(`❌ [${logName}] No email provider configured! Set RESEND_API_KEY, BREVO_API_KEY, or SMTP_PASS.`);
    throw new Error('No email provider configured. Please contact support.');
  }

  console.error(`❌ [${logName}] All providers failed for ${to}:`, errors.join(' | '));
  throw new Error(`Failed to send email to ${to}: ${errors.join(' | ')}`);
}

/**
 * Send an OTP verification email.
 */
export async function sendOTPEmail(env, to, otp) {
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #ff4081; margin-bottom: 8px; font-size: 22px;">CampusHinge</h2>
      <p style="color: #334155; font-size: 15px;">Your verification code is:</p>
      <div style="background: #fff0f5; border-radius: 8px; padding: 18px; text-align: center; margin: 18px 0; border: 1px solid #fed7e2;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ff4081;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code expires in 10 minutes.<br/>Do not share this code with anyone.</p>
    </div>
  `;

  const textBody = `Your CampusHinge verification code is: ${otp}\n\nThis code expires in 10 minutes.\nDo not share it with anyone.`;
  const subject = `${otp} is your CampusHinge verification code`;

  await sendViaAvailableProviders(env, {
    to,
    subject,
    html: htmlBody,
    text: textBody,
    logName: 'OTP EMAIL',
  });
}

/**
 * Send a Like notification email.
 */
export async function sendLikeEmail(env, to) {
  const baseUrl = env.FRONTEND_URL || 'https://frontend-mu-eight-a3le6bxaal.vercel.app';
  const ctaUrl = `${baseUrl.replace(/\/$/, '')}/notifications`;
  const subject = 'Someone liked your profile on CampusHinge 👀';
  const textBody = `A fellow student liked your profile on CampusHinge!\n\nOpen the app to see who likes you and match back: ${ctaUrl}`;

  const htmlBody = `
    <div style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 28px; background: #090a10; color: #f8fafc; border-radius: 16px; border: 1px solid rgba(255,64,129,0.25); box-shadow: 0 8px 32px rgba(255,64,129,0.15);">
      <div style="display: inline-block; background: linear-gradient(135deg, #ff4081, #ff6b6b); color: #ffffff; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 14px; letter-spacing: 0.05em;">
        💖 New Like
      </div>
      <h2 style="background: linear-gradient(135deg, #ff4081 0%, #ff6b6b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 24px; font-weight: 800; margin-bottom: 12px; margin-top: 0;">
        CampusHinge
      </h2>
      <p style="color: #f8fafc; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        A fellow student liked your profile! Open CampusHinge to see who likes you and like them back to match.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ctaUrl}" style="background: linear-gradient(135deg, #ff4081 0%, #ff6b6b 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 9999px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 18px rgba(255,64,129,0.35);">
          Open App to View Like 💖
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
        You can manage your email notification preferences anytime in your CampusHinge profile settings.
      </p>
    </div>
  `;

  await sendViaAvailableProviders(env, {
    to,
    subject,
    html: htmlBody,
    text: textBody,
    logName: 'LIKE EMAIL',
  });
}

/**
 * Send a Super Like notification email.
 */
export async function sendSuperLikeEmail(env, to, senderName, sharedInterests = []) {
  const baseUrl = env.FRONTEND_URL || 'https://frontend-mu-eight-a3le6bxaal.vercel.app';
  const ctaUrl = `${baseUrl.replace(/\/$/, '')}/notifications`;

  const topInterests = sharedInterests.slice(0, 3).join(', ');
  const interestsText = topInterests ? ` including ${topInterests}` : '';
  const count = sharedInterests.length;

  const subject = 'You got a Super Like on CampusHinge ⭐';
  const textBody = `${senderName} Super Liked your profile — you both share ${count} interests${interestsText}. Open CampusHinge to see their profile and like back to start chatting: ${ctaUrl}`;

  const htmlBody = `
    <div style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 28px; background: #090a10; color: #f8fafc; border-radius: 16px; border: 1px solid rgba(255,215,0,0.3); box-shadow: 0 8px 32px rgba(255,215,0,0.15);">
      <div style="display: inline-block; background: linear-gradient(135deg, #ffd700, #ff8c00); color: #000; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 14px; letter-spacing: 0.05em;">
        ⭐ Super Like
      </div>
      <h2 style="background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 24px; font-weight: 800; margin: 0 0 12px 0;">
        You got a Super Like!
      </h2>
      <p style="color: #f8fafc; font-size: 15px; line-height: 1.6; margin-bottom: 18px;">
        ${senderName} Super Liked your profile — you both share ${count} interests${interestsText}. Open CampusHinge to see their profile and like back to start chatting.
      </p>
      ${count > 0 ? `
      <div style="background: rgba(255, 215, 0, 0.08); border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 10px; padding: 14px; margin-bottom: 20px;">
        <span style="font-size: 13px; color: #fcd34d; font-weight: 600;">✨ Shared Interests (${count}):</span>
        <div style="color: #ffffff; font-size: 14px; margin-top: 4px; font-weight: 500;">
          ${sharedInterests.join(' • ')}
        </div>
      </div>` : ''}
      <div style="text-align: center; margin: 24px 0;">
        <a href="${ctaUrl}" style="background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%); color: #000; text-decoration: none; padding: 13px 32px; border-radius: 9999px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 18px rgba(255,215,0,0.35);">
          View Super Like ⭐
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
        You can manage your email notification preferences anytime in your CampusHinge profile settings.
      </p>
    </div>
  `;

  await sendViaAvailableProviders(env, {
    to,
    subject,
    html: htmlBody,
    text: textBody,
    logName: 'SUPER LIKE EMAIL',
  });
}
