/**
 * Auth Routes — signup, login, verify-otp
 */
import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { query } from '../db.js';
import { sendOTPEmail } from '../services/email.js';

const auth = new Hono();

const DEFAULT_ALLOWLIST = [
  { type: 'exact_domain', value: 'vitbhopal.ac.in' },
  { type: 'exact_email', value: 'international@lnctu.ac.in' },
  { type: 'exact_domain', value: 'lpu.co.in' },
  { type: 'wildcard_subdomain', value: 'bits-pilani.ac.in' },
  { type: 'exact_domain', value: 'galgotiasuniversity.ac.in' },
  { type: 'exact_domain', value: 'galgotias.org' },
];

function isAllowedEmail(email, allowedDomains) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  const atIndex = cleanEmail.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== cleanEmail.indexOf('@') || atIndex === cleanEmail.length - 1) {
    return false;
  }

  const domain = cleanEmail.slice(atIndex + 1);

  for (const rule of DEFAULT_ALLOWLIST) {
    if (rule.type === 'exact_email' && cleanEmail === rule.value) return true;
    if (rule.type === 'exact_domain' && domain === rule.value) return true;
    if (rule.type === 'wildcard_subdomain' && (domain === rule.value || domain.endsWith('.' + rule.value))) return true;
  }

  const domains = (allowedDomains || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  return domains.includes(domain);
}

function generateOTP() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

// POST /api/auth/signup
auth.post('/signup', async (c) => {
  const { email } = await c.req.json();
  const cleanEmail = (email || '').trim().toLowerCase();
  const db = c.env.DB;

  if (!isAllowedEmail(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS)) {
    return c.json({ success: false, error: { message: "This email isn't eligible for verification" } }, 403);
  }

  // Rate limit: max 5 OTPs in 5 min
  const { rows: rateRows } = await query(db,
    `SELECT COUNT(*) AS count FROM otp_codes WHERE email = $1 AND created_at > datetime('now', '-5 minutes')`,
    [cleanEmail]
  );
  if (parseInt(rateRows[0]?.count || 0) >= 5) {
    return c.json({ success: false, error: { message: 'Too many OTP requests. Please try again after 5 minutes.' } }, 429);
  }

  // Check if banned
  const { rows } = await query(db, `SELECT id, is_banned FROM users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);
  if (rows.length > 0 && rows[0].is_banned) {
    return c.json({ success: false, error: { message: 'This account has been suspended.' } }, 403);
  }

  // Create user if not exists
  if (rows.length === 0) {
    const userId = crypto.randomUUID();
    await query(db, `INSERT INTO users (id, email) VALUES ($1, $2)`, [userId, cleanEmail]);
  }

  // Generate & store OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const otpId = crypto.randomUUID();
  await query(db, `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, datetime('now'))`, [otpId, cleanEmail, otp, expiresAt]);

  // Send email
  await sendOTPEmail(c.env, cleanEmail, otp);

  return c.json({ success: true, message: 'OTP sent to your email. It expires in 10 minutes.' });
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { email } = await c.req.json();
  const cleanEmail = (email || '').trim().toLowerCase();
  const db = c.env.DB;

  if (!isAllowedEmail(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS)) {
    return c.json({ success: false, error: { message: "This email isn't eligible for verification" } }, 403);
  }

  const { rows: rateRows } = await query(db,
    `SELECT COUNT(*) AS count FROM otp_codes WHERE email = $1 AND created_at > datetime('now', '-5 minutes')`,
    [cleanEmail]
  );
  if (parseInt(rateRows[0]?.count || 0) >= 5) {
    return c.json({ success: false, error: { message: 'Too many OTP requests. Please try again after 5 minutes.' } }, 429);
  }

  const { rows } = await query(db, `SELECT id, is_banned FROM users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);
  if (rows.length === 0) {
    return c.json({ success: false, error: { message: 'No account found for this campus email. Please create an account first.' } }, 404);
  }
  if (rows[0].is_banned) {
    return c.json({ success: false, error: { message: 'This account has been suspended.' } }, 403);
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const otpId = crypto.randomUUID();
  await query(db, `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, datetime('now'))`, [otpId, cleanEmail, otp, expiresAt]);

  await sendOTPEmail(c.env, cleanEmail, otp);

  return c.json({ success: true, message: 'Verification code sent to your email. It expires in 10 minutes.' });
});

// POST /api/auth/resend-otp
auth.post('/resend-otp', async (c) => {
  const { email } = await c.req.json();
  const cleanEmail = (email || '').trim().toLowerCase();
  const db = c.env.DB;

  if (!isAllowedEmail(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS)) {
    return c.json({ success: false, error: { message: "This email isn't eligible for verification" } }, 403);
  }

  // Rate limit: max 5 resends in 1 hour
  const { rows: hourRows } = await query(db,
    `SELECT COUNT(*) AS count FROM otp_codes WHERE email = $1 AND created_at > datetime('now', '-1 hour')`,
    [cleanEmail]
  );
  if (parseInt(hourRows[0]?.count || 0) >= 5) {
    return c.json({ success: false, error: { message: 'Too many OTP resend requests. Please try again after 1 hour.', retryAfter: 3600 } }, 429);
  }

  // 30-second cooldown check
  const { rows: latestRows } = await query(db,
    `SELECT created_at FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail]
  );
  if (latestRows.length > 0) {
    const rawCreatedAt = latestRows[0].created_at;
    const lastSentTime = new Date(rawCreatedAt.includes('T') ? rawCreatedAt : rawCreatedAt.replace(' ', 'T') + 'Z').getTime();
    const elapsedSeconds = Math.floor((Date.now() - lastSentTime) / 1000);
    if (elapsedSeconds < 30) {
      const retryAfter = 30 - Math.max(0, elapsedSeconds);
      c.header('Retry-After', String(retryAfter));
      return c.json({
        success: false,
        error: {
          message: `Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before requesting another OTP.`,
          retryAfter,
        },
      }, 429);
    }
  }

  // Invalidate previous OTPs
  await query(db, `UPDATE otp_codes SET used = 1 WHERE email = $1 AND used = 0`, [cleanEmail]);

  // Generate & store OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const otpId = crypto.randomUUID();
  await query(db, `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, datetime('now'))`, [otpId, cleanEmail, otp, expiresAt]);

  // Send email
  await sendOTPEmail(c.env, cleanEmail, otp);

  return c.json({ success: true, message: 'A new verification code has been sent to your email.', data: { cooldownSeconds: 30 } });
});

// POST /api/auth/verify-otp
auth.post('/verify-otp', async (c) => {
  const { email, code } = await c.req.json();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim();
  const db = c.env.DB;

  // 1. Accept any valid unexpired unused OTP for this email
  const { rows: validRows } = await query(db,
    `SELECT id, code, expires_at, used FROM otp_codes 
     WHERE email = $1 AND code = $2 AND used = 0 AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, cleanCode]
  );

  let otp;
  if (validRows.length > 0) {
    otp = validRows[0];
  } else {
    // Check if code was already used
    const { rows: usedRows } = await query(db,
      `SELECT id FROM otp_codes WHERE email = $1 AND code = $2 AND used = 1 ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode]
    );
    if (usedRows.length > 0) {
      return c.json({ success: false, error: { message: 'This OTP has already been used. Please request a new one.' } }, 400);
    }

    // Check if code expired
    const { rows: expiredRows } = await query(db,
      `SELECT id FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at <= datetime('now') ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode]
    );
    if (expiredRows.length > 0) {
      return c.json({ success: false, error: { message: 'OTP has expired. Please request a new one.' } }, 400);
    }

    return c.json({ success: false, error: { message: 'Invalid OTP. Please check and try again.' } }, 400);
  }

  // Mark all OTPs for this email as used
  await query(db, `UPDATE otp_codes SET used = 1 WHERE email = $1`, [cleanEmail]);

  // Upsert user
  let { rows: userRows } = await query(db,
    `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE LOWER(email) = LOWER($1)`,
    [cleanEmail]
  );

  let user;
  if (userRows.length === 0) {
    const userId = crypto.randomUUID();
    await query(db, `INSERT INTO users (id, email, email_verified, profile_completed) VALUES ($1, $2, 1, 0)`, [userId, cleanEmail]);
    const { rows: newRows } = await query(db,
      `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE id = $1`,
      [userId]
    );
    user = newRows[0];
  } else {
    user = userRows[0];
    await query(db, `UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = $1`, [user.id]);
  }

  if (user.is_banned) return c.json({ success: false, error: { message: 'This account has been suspended.' } }, 403);

  // Check subscription expiry
  if (user.subscription_status === 'active' && user.subscription_expiry && new Date() > new Date(user.subscription_expiry)) {
    await query(db, `UPDATE users SET subscription_status = 'expired', updated_at = datetime('now') WHERE id = $1`, [user.id]);
    user.subscription_status = 'expired';
  }

  // Check profile completion
  let isProfileCompleted = Boolean(user.profile_completed);
  if (!isProfileCompleted) {
    const { rows: profileRows } = await query(db, `SELECT id, photos FROM profiles WHERE user_id = $1`, [user.id]);
    if (profileRows.length > 0) {
      try {
        const photos = typeof profileRows[0].photos === 'string' ? JSON.parse(profileRows[0].photos) : profileRows[0].photos;
        if (Array.isArray(photos) && photos.length >= 2) {
          isProfileCompleted = true;
          await query(db, `UPDATE users SET profile_completed = 1 WHERE id = $1`, [user.id]);
        }
      } catch {}
    }
  }

  // Issue JWT via jose
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    subscription_status: user.subscription_status,
    profile_completed: isProfileCompleted,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(c.env.JWT_EXPIRES_IN || '7d')
    .sign(secret);

  return c.json({
    success: true,
    message: 'Email verified successfully.',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_status: user.subscription_status,
        profile_completed: isProfileCompleted,
        has_profile: isProfileCompleted,
      },
    },
  });
});

export default auth;
