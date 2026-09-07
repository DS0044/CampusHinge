/**
 * Auth Routes — signup, login, verify-otp
 */
import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { query } from '../db.js';
import { sendOTPEmail } from '../services/email.js';

const auth = new Hono();

function isAllowedDomain(email, allowedDomains) {
  if (!email || typeof email !== 'string') return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
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

  if (!isAllowedDomain(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS)) {
    return c.json({ success: false, error: { message: 'Email domain not allowed. Please use your campus email.' } }, 403);
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
  await query(db, `INSERT INTO otp_codes (id, email, code, expires_at) VALUES ($1, $2, $3, $4)`, [otpId, cleanEmail, otp, expiresAt]);

  // Send email
  await sendOTPEmail(c.env, cleanEmail, otp);

  return c.json({ success: true, message: 'OTP sent to your email. It expires in 10 minutes.' });
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { email } = await c.req.json();
  const cleanEmail = (email || '').trim().toLowerCase();
  const db = c.env.DB;

  if (!isAllowedDomain(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS)) {
    return c.json({ success: false, error: { message: 'Email domain not allowed. Please use your campus email.' } }, 403);
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
  await query(db, `INSERT INTO otp_codes (id, email, code, expires_at) VALUES ($1, $2, $3, $4)`, [otpId, cleanEmail, otp, expiresAt]);

  await sendOTPEmail(c.env, cleanEmail, otp);

  return c.json({ success: true, message: 'Verification code sent to your email. It expires in 10 minutes.' });
});

// POST /api/auth/verify-otp
auth.post('/verify-otp', async (c) => {
  const { email, code } = await c.req.json();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim();
  const db = c.env.DB;

  // Find latest OTP
  const { rows: otpRows } = await query(db,
    `SELECT id, code, expires_at, used FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail]
  );

  if (otpRows.length === 0) {
    return c.json({ success: false, error: { message: 'No OTP found for this email. Please request a new one.' } }, 400);
  }

  const otp = otpRows[0];
  if (otp.used) return c.json({ success: false, error: { message: 'This OTP has already been used.' } }, 400);
  if (new Date() > new Date(otp.expires_at)) return c.json({ success: false, error: { message: 'OTP has expired. Please request a new one.' } }, 400);
  if (String(otp.code).trim() !== cleanCode) return c.json({ success: false, error: { message: 'Invalid OTP. Please check and try again.' } }, 400);

  // Mark as used
  await query(db, `UPDATE otp_codes SET used = 1 WHERE id = $1`, [otp.id]);

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
