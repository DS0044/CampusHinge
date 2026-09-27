/**
 * Auth Routes — signup, login, verify-otp, resend-otp, google sign-in
 */
import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { query } from '../db.js';
import { sendOTPEmail } from '../services/email.js';
import type { Env, HonoVariables } from '../types.js';

type AppType = { Bindings: Env; Variables: HonoVariables };

const auth = new Hono<AppType>();

// ── Email allowlist ──

interface AllowRule {
  type: 'exact_email' | 'exact_domain' | 'wildcard_subdomain';
  value: string;
}

const DEFAULT_ALLOWLIST: AllowRule[] = [
  { type: 'exact_domain', value: 'vitbhopal.ac.in' },
  { type: 'exact_email', value: 'international@lnctu.ac.in' },
  { type: 'exact_domain', value: 'lpu.co.in' },
  { type: 'wildcard_subdomain', value: 'bits-pilani.ac.in' },
  { type: 'exact_domain', value: 'galgotiasuniversity.ac.in' },
  { type: 'exact_domain', value: 'galgotias.org' },
];

function isAllowedEmail(
  email: string,
  allowedDomains?: string,
  allowedExtraEmails?: string
): boolean {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();

  // Manually approved extra emails (e.g., for personal testing)
  const extraEmails = (allowedExtraEmails ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (extraEmails.includes(cleanEmail)) return true;

  const atIndex = cleanEmail.lastIndexOf('@');
  if (
    atIndex <= 0 ||
    atIndex !== cleanEmail.indexOf('@') ||
    atIndex === cleanEmail.length - 1
  ) {
    return false;
  }

  const domain = cleanEmail.slice(atIndex + 1);

  for (const rule of DEFAULT_ALLOWLIST) {
    if (rule.type === 'exact_email' && cleanEmail === rule.value) return true;
    if (rule.type === 'exact_domain' && domain === rule.value) return true;
    if (
      rule.type === 'wildcard_subdomain' &&
      (domain === rule.value || domain.endsWith('.' + rule.value))
    )
      return true;
  }

  const domains = (allowedDomains ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return domains.includes(domain);
}

function generateOTP(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + ((arr[0] ?? 0) % 900000));
}

// ── DB row shapes ──

interface UserBasicRow {
  id: string;
  email: string;
  role: string;
  subscription_status: string;
  subscription_expiry: string | null;
  is_banned: number;
  profile_completed: number;
}

interface OtpRow {
  id: string;
  code: string;
  expires_at: string;
  used: number;
  created_at: string;
}

// ── POST /api/auth/signup ──

auth.post('/signup', async (c) => {
  const body = await c.req.json<{ email?: string; accepted_terms?: boolean | string }>();
  const { email, accepted_terms } = body;
  const cleanEmail = (email ?? '').trim().toLowerCase();
  const db = c.env.DB;

  if (accepted_terms !== true && accepted_terms !== 'true') {
    return c.json(
      { success: false, error: { message: 'You must accept the Terms & Conditions to create an account.' } },
      400
    );
  }

  if (!isAllowedEmail(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS, c.env.ALLOWED_EXTRA_EMAILS)) {
    return c.json(
      { success: false, error: { message: "This email isn't eligible for verification" } },
      403
    );
  }

  // Rate limit: max 5 OTPs in 5 min
  const { rows: rateRows } = await query<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count FROM otp_codes WHERE email = $1 AND created_at > datetime('now', '-5 minutes')`,
    [cleanEmail]
  );
  if ((rateRows[0]?.count ?? 0) >= 5) {
    return c.json(
      { success: false, error: { message: 'Too many OTP requests. Please try again after 5 minutes.' } },
      429
    );
  }

  // Check if banned
  const { rows } = await query<{ id: string; is_banned: number }>(
    db,
    `SELECT id, is_banned FROM users WHERE LOWER(email) = LOWER($1)`,
    [cleanEmail]
  );
  if (rows.length > 0 && rows[0].is_banned) {
    return c.json(
      { success: false, error: { message: 'This account has been suspended.' } },
      403
    );
  }

  const CURRENT_TERMS_VERSION = '1.0';
  const acceptedTermsAt = new Date().toISOString();

  if (rows.length === 0) {
    const userId = crypto.randomUUID();
    await query(db, `INSERT INTO users (id, email, accepted_terms_at, terms_version) VALUES ($1, $2, $3, $4)`, [
      userId,
      cleanEmail,
      acceptedTermsAt,
      CURRENT_TERMS_VERSION,
    ]);
  } else {
    await query(db, `UPDATE users SET accepted_terms_at = $1, terms_version = $2, updated_at = datetime('now') WHERE id = $3`, [
      acceptedTermsAt,
      CURRENT_TERMS_VERSION,
      rows[0].id,
    ]);
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const otpId = crypto.randomUUID();
  await query(
    db,
    `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, datetime('now'))`,
    [otpId, cleanEmail, otp, expiresAt]
  );

  try {
    await sendOTPEmail(c.env, cleanEmail, otp);
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error(`❌ [SIGNUP] Email send failed for ${cleanEmail}:`, msg);
    return c.json(
      { success: false, error: { message: 'Failed to send verification email. Please try again in a moment.' } },
      500
    );
  }

  return c.json({ success: true, message: 'OTP sent to your email. It expires in 10 minutes.' });
});

// ── POST /api/auth/login ──

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const cleanEmail = (body.email ?? '').trim().toLowerCase();
  const db = c.env.DB;

  if (!isAllowedEmail(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS, c.env.ALLOWED_EXTRA_EMAILS)) {
    return c.json(
      { success: false, error: { message: "This email isn't eligible for verification" } },
      403
    );
  }

  const { rows: rateRows } = await query<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count FROM otp_codes WHERE email = $1 AND created_at > datetime('now', '-5 minutes')`,
    [cleanEmail]
  );
  if ((rateRows[0]?.count ?? 0) >= 5) {
    return c.json(
      { success: false, error: { message: 'Too many OTP requests. Please try again after 5 minutes.' } },
      429
    );
  }

  const { rows } = await query<{ id: string; is_banned: number }>(
    db,
    `SELECT id, is_banned FROM users WHERE LOWER(email) = LOWER($1)`,
    [cleanEmail]
  );
  if (rows.length === 0) {
    return c.json(
      { success: false, error: { message: 'No account found for this campus email. Please create an account first.' } },
      404
    );
  }
  if (rows[0].is_banned) {
    return c.json({ success: false, error: { message: 'This account has been suspended.' } }, 403);
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const otpId = crypto.randomUUID();
  await query(
    db,
    `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, datetime('now'))`,
    [otpId, cleanEmail, otp, expiresAt]
  );

  try {
    await sendOTPEmail(c.env, cleanEmail, otp);
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error(`❌ [LOGIN] Email send failed for ${cleanEmail}:`, msg);
    return c.json(
      { success: false, error: { message: 'Failed to send verification email. Please try again in a moment.' } },
      500
    );
  }

  return c.json({
    success: true,
    message: 'Verification code sent to your email. It expires in 10 minutes.',
  });
});

// ── POST /api/auth/resend-otp ──

auth.post('/resend-otp', async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const cleanEmail = (body.email ?? '').trim().toLowerCase();
  const db = c.env.DB;

  if (!isAllowedEmail(cleanEmail, c.env.ALLOWED_EMAIL_DOMAINS, c.env.ALLOWED_EXTRA_EMAILS)) {
    return c.json(
      { success: false, error: { message: "This email isn't eligible for verification" } },
      403
    );
  }

  const { rows: hourRows } = await query<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count FROM otp_codes WHERE email = $1 AND created_at > datetime('now', '-1 hour')`,
    [cleanEmail]
  );
  if ((hourRows[0]?.count ?? 0) >= 5) {
    return c.json(
      { success: false, error: { message: 'Too many OTP resend requests. Please try again after 1 hour.', retryAfter: 3600 } },
      429
    );
  }

  const { rows: latestRows } = await query<{ created_at: string }>(
    db,
    `SELECT created_at FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail]
  );
  if (latestRows.length > 0) {
    const rawCreatedAt = latestRows[0].created_at;
    const lastSentTime = new Date(
      rawCreatedAt.includes('T') ? rawCreatedAt : rawCreatedAt.replace(' ', 'T') + 'Z'
    ).getTime();
    const elapsedSeconds = Math.floor((Date.now() - lastSentTime) / 1000);
    if (elapsedSeconds < 30) {
      const retryAfter = 30 - Math.max(0, elapsedSeconds);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          success: false,
          error: {
            message: `Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before requesting another OTP.`,
            retryAfter,
          },
        },
        429
      );
    }
  }

  await query(db, `UPDATE otp_codes SET used = 1 WHERE email = $1 AND used = 0`, [cleanEmail]);

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const otpId = crypto.randomUUID();
  await query(
    db,
    `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, datetime('now'))`,
    [otpId, cleanEmail, otp, expiresAt]
  );

  try {
    await sendOTPEmail(c.env, cleanEmail, otp);
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error(`❌ [RESEND] Email send failed for ${cleanEmail}:`, msg);
    return c.json(
      { success: false, error: { message: 'Failed to send verification email. Please try again in a moment.' } },
      500
    );
  }

  return c.json({
    success: true,
    message: 'A new verification code has been sent to your email.',
    data: { cooldownSeconds: 30 },
  });
});

// ── Shared JWT issue helper ──

async function issueJWT(
  env: Env,
  user: UserBasicRow,
  isProfileCompleted: boolean
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    subscription_status: user.subscription_status,
    profile_completed: isProfileCompleted,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(env.JWT_EXPIRES_IN ?? '7d')
    .sign(secret);
}

async function resolveProfileCompletion(
  db: D1Database,
  user: UserBasicRow
): Promise<boolean> {
  if (user.profile_completed) return true;
  const { rows: profileRows } = await query<{ photos: string | string[] }>(
    db,
    `SELECT id, photos FROM profiles WHERE user_id = $1`,
    [user.id]
  );
  if (profileRows.length === 0) return false;
  try {
    const photos =
      typeof profileRows[0].photos === 'string'
        ? (JSON.parse(profileRows[0].photos) as unknown[])
        : profileRows[0].photos;
    if (Array.isArray(photos) && photos.length >= 2) {
      await query(db, `UPDATE users SET profile_completed = 1 WHERE id = $1`, [user.id]);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// ── POST /api/auth/verify-otp ──

auth.post('/verify-otp', async (c) => {
  const body = await c.req.json<{ email?: string; code?: string }>();
  const cleanEmail = (body.email ?? '').trim().toLowerCase();
  const cleanCode = (body.code ?? '').trim();
  const db = c.env.DB;

  const { rows: validRows } = await query<OtpRow>(
    db,
    `SELECT id, code, expires_at, used FROM otp_codes
     WHERE email = $1 AND code = $2 AND used = 0 AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, cleanCode]
  );

  if (validRows.length === 0) {
    const { rows: usedRows } = await query<{ id: string }>(
      db,
      `SELECT id FROM otp_codes WHERE email = $1 AND code = $2 AND used = 1 ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode]
    );
    if (usedRows.length > 0) {
      return c.json(
        { success: false, error: { message: 'This OTP has already been used. Please request a new one.' } },
        400
      );
    }
    const { rows: expiredRows } = await query<{ id: string }>(
      db,
      `SELECT id FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at <= datetime('now') ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode]
    );
    if (expiredRows.length > 0) {
      return c.json(
        { success: false, error: { message: 'OTP has expired. Please request a new one.' } },
        400
      );
    }
    return c.json(
      { success: false, error: { message: 'Invalid OTP. Please check and try again.' } },
      400
    );
  }

  await query(db, `UPDATE otp_codes SET used = 1 WHERE email = $1`, [cleanEmail]);

  let { rows: userRows } = await query<UserBasicRow>(
    db,
    `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE LOWER(email) = LOWER($1)`,
    [cleanEmail]
  );

  let user: UserBasicRow;
  if (userRows.length === 0) {
    const userId = crypto.randomUUID();
    await query(
      db,
      `INSERT INTO users (id, email, email_verified, profile_completed) VALUES ($1, $2, 1, 0)`,
      [userId, cleanEmail]
    );
    const { rows: newRows } = await query<UserBasicRow>(
      db,
      `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE id = $1`,
      [userId]
    );
    user = newRows[0];
  } else {
    user = userRows[0];
    await query(
      db,
      `UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = $1`,
      [user.id]
    );
  }

  if (user.is_banned) {
    return c.json({ success: false, error: { message: 'This account has been suspended.' } }, 403);
  }

  // Expire subscription if needed
  if (
    user.subscription_status === 'active' &&
    user.subscription_expiry &&
    new Date() > new Date(user.subscription_expiry)
  ) {
    await query(
      db,
      `UPDATE users SET subscription_status = 'expired', updated_at = datetime('now') WHERE id = $1`,
      [user.id]
    );
    user = { ...user, subscription_status: 'expired' };
  }

  const isProfileCompleted = await resolveProfileCompletion(db, user);
  const token = await issueJWT(c.env, user, isProfileCompleted);

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

// ── POST /api/auth/google ──

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  sub?: string;
  exp?: string | number;
}

auth.post('/google', async (c) => {
  const body = await c.req.json<{ credential?: string }>();
  const { credential } = body;
  const db = c.env.DB;

  if (!credential) {
    return c.json({ success: false, error: { message: 'Missing Google credential token.' } }, 400);
  }

  let googleUser: {
    email: string;
    email_verified: boolean;
    name: string;
    picture: string;
    sub: string;
  };

  try {
    const parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!verifyRes.ok) throw new Error('Token verification failed');

    const verified = await verifyRes.json<GoogleTokenInfo>();

    const expectedClientId = c.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && verified.aud !== expectedClientId) {
      throw new Error('Token audience mismatch');
    }

    const now = Math.floor(Date.now() / 1000);
    if (verified.exp && parseInt(String(verified.exp)) < now) {
      throw new Error('Token has expired');
    }

    googleUser = {
      email: ((verified.email ?? '') as string).trim().toLowerCase(),
      email_verified:
        verified.email_verified === 'true' || verified.email_verified === true,
      name: (verified.name ?? '') as string,
      picture: (verified.picture ?? '') as string,
      sub: (verified.sub ?? '') as string,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ [GOOGLE AUTH] Token verification failed:', msg);
    return c.json(
      { success: false, error: { message: 'Invalid Google sign-in token. Please try again.' } },
      401
    );
  }

  if (!googleUser.email_verified) {
    return c.json(
      { success: false, error: { message: 'Your Google email is not verified.' } },
      403
    );
  }

  if (!isAllowedEmail(googleUser.email, c.env.ALLOWED_EMAIL_DOMAINS, c.env.ALLOWED_EXTRA_EMAILS)) {
    return c.json(
      {
        success: false,
        error: {
          message:
            'Only verified campus email addresses are allowed. Please sign in with your college email (e.g. @vitbhopal.ac.in).',
        },
      },
      403
    );
  }

  const { rows: existingRows } = await query<UserBasicRow>(
    db,
    `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE LOWER(email) = LOWER($1)`,
    [googleUser.email]
  );

  if (existingRows.length > 0 && existingRows[0].is_banned) {
    return c.json({ success: false, error: { message: 'This account has been suspended.' } }, 403);
  }

  let user: UserBasicRow;
  if (existingRows.length === 0) {
    const userId = crypto.randomUUID();
    await query(
      db,
      `INSERT INTO users (id, email, email_verified, profile_completed) VALUES ($1, $2, 1, 0)`,
      [userId, googleUser.email]
    );
    const { rows: newRows } = await query<UserBasicRow>(
      db,
      `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE id = $1`,
      [userId]
    );
    user = newRows[0];
    console.log(`✅ [GOOGLE AUTH] New user created: ${googleUser.email}`);
  } else {
    user = existingRows[0];
    await query(
      db,
      `UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = $1`,
      [user.id]
    );
    console.log(`✅ [GOOGLE AUTH] Existing user signed in: ${googleUser.email}`);
  }

  if (
    user.subscription_status === 'active' &&
    user.subscription_expiry &&
    new Date() > new Date(user.subscription_expiry)
  ) {
    await query(
      db,
      `UPDATE users SET subscription_status = 'expired', updated_at = datetime('now') WHERE id = $1`,
      [user.id]
    );
    user = { ...user, subscription_status: 'expired' };
  }

  const isProfileCompleted = await resolveProfileCompletion(db, user);
  const token = await issueJWT(c.env, user, isProfileCompleted);

  return c.json({
    success: true,
    message: 'Signed in successfully with Google.',
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
