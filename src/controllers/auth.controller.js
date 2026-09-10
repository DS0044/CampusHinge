const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { isAllowedDomain } = require('../config/allowedDomains');
const {
  createOTP,
  verifyOTP,
  checkOTPRateLimit,
  checkOTPCooldown,
  checkResendRateLimit,
  invalidatePreviousOTPs,
} = require('../services/otp.service');
const { sendOTPEmail } = require('../services/email.service');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/auth/signup
 * Accepts email, validates domain, sends OTP.
 */
async function signup(req, res, next) {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    console.log(`\n🔐  [AUTH SIGNUP] ── Request received for: ${cleanEmail}`);

    // 1. Validate domain against allowlist
    console.log(`🔐  [AUTH SIGNUP] Step 1: Checking domain allowlist…`);
    if (!isAllowedDomain(cleanEmail)) {
      console.warn(`🔐  [AUTH SIGNUP] ✗ Domain rejected for: ${cleanEmail}`);
      throw new AppError("This email isn't eligible for verification", 403);
    }
    console.log(`🔐  [AUTH SIGNUP] ✓ Domain allowed`);

    // 2. Check DB-level rate limit
    console.log(`🔐  [AUTH SIGNUP] Step 2: Checking OTP rate limit…`);
    await checkOTPRateLimit(cleanEmail);
    console.log(`🔐  [AUTH SIGNUP] ✓ Rate limit OK`);

    // 3. Create or find user
    console.log(`🔐  [AUTH SIGNUP] Step 3: Looking up user in DB…`);
    let { rows } = await db.query(`SELECT id, is_banned FROM users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);

    if (rows.length > 0 && rows[0].is_banned) {
      console.warn(`🔐  [AUTH SIGNUP] ✗ User is banned: ${cleanEmail}`);
      throw new AppError('This account has been suspended.', 403);
    }

    if (rows.length === 0) {
      const crypto = require('crypto');
      const userId = crypto.randomUUID();
      await db.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [userId, cleanEmail]);
      console.log(`🔐  [AUTH SIGNUP] ✓ New user created`);
    } else {
      console.log(`🔐  [AUTH SIGNUP] ✓ Existing user found (id=${rows[0].id})`);
    }

    // 4. Generate OTP
    console.log(`🔐  [AUTH SIGNUP] Step 4: Generating OTP…`);
    const otp = await createOTP(cleanEmail);
    console.log(`🔐  [AUTH SIGNUP] ✓ OTP generated`);

    // 5. Send email
    console.log(`🔐  [AUTH SIGNUP] Step 5: Sending OTP email…`);
    await sendOTPEmail(cleanEmail, otp);
    console.log(`🔐  [AUTH SIGNUP] ✓ Email send step completed`);

    console.log(`🔐  [AUTH SIGNUP] ── Signup flow complete for ${cleanEmail}\n`);
    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. It expires in 10 minutes.',
    });
  } catch (err) {
    console.error(`🔐  [AUTH SIGNUP] ✗ Error: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Validates email domain, verifies user exists, sends OTP.
 */
async function login(req, res, next) {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    console.log(`\n🔐  [AUTH LOGIN] ── Request received for: ${cleanEmail}`);

    // 1. Validate domain against allowlist
    console.log(`🔐  [AUTH LOGIN] Step 1: Checking domain allowlist…`);
    if (!isAllowedDomain(cleanEmail)) {
      console.warn(`🔐  [AUTH LOGIN] ✗ Domain rejected for: ${cleanEmail}`);
      throw new AppError("This email isn't eligible for verification", 403);
    }
    console.log(`🔐  [AUTH LOGIN] ✓ Domain allowed`);

    // 2. Check DB-level rate limit
    console.log(`🔐  [AUTH LOGIN] Step 2: Checking OTP rate limit…`);
    await checkOTPRateLimit(cleanEmail);
    console.log(`🔐  [AUTH LOGIN] ✓ Rate limit OK`);

    // 3. Find user in DB
    console.log(`🔐  [AUTH LOGIN] Step 3: Looking up user in DB…`);
    let { rows } = await db.query(`SELECT id, is_banned FROM users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);

    if (rows.length === 0) {
      const crypto = require('crypto');
      const userId = crypto.randomUUID();
      await db.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [userId, cleanEmail]);
      console.log(`🔐  [AUTH LOGIN] ✓ New user created (id=${userId})`);
    } else if (rows[0].is_banned) {
      console.warn(`🔐  [AUTH LOGIN] ✗ User is banned: ${cleanEmail}`);
      throw new AppError('This account has been suspended.', 403);
    } else {
      console.log(`🔐  [AUTH LOGIN] ✓ Existing user found (id=${rows[0].id})`);
    }

    // 4. Generate OTP
    console.log(`🔐  [AUTH LOGIN] Step 4: Generating OTP…`);
    const otp = await createOTP(cleanEmail);
    console.log(`🔐  [AUTH LOGIN] ✓ OTP generated`);

    // 5. Send email
    console.log(`🔐  [AUTH LOGIN] Step 5: Sending OTP email…`);
    await sendOTPEmail(cleanEmail, otp);
    console.log(`🔐  [AUTH LOGIN] ✓ Email send step completed`);

    console.log(`🔐  [AUTH LOGIN] ── Login flow complete for ${cleanEmail}\n`);
    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. It expires in 10 minutes.',
    });
  } catch (err) {
    console.error(`🔐  [AUTH LOGIN] ✗ Error: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/auth/verify-otp
 * Verifies OTP, marks email as verified, issues JWT.
 */
async function verifyOtp(req, res, next) {
  try {
    const { email, code } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    console.log(`\n🔐  [AUTH VERIFY] ── Request received for: ${cleanEmail} (code=${code})`);

    // 1. Verify the OTP
    console.log(`🔐  [AUTH VERIFY] Step 1: Verifying OTP…`);
    await verifyOTP(cleanEmail, code);
    console.log(`🔐  [AUTH VERIFY] ✓ OTP valid`);

    // 2. Upsert user / Mark as verified
    console.log(`🔐  [AUTH VERIFY] Step 2: Marking email as verified…`);

    let { rows: userRows } = await db.query(
      `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [cleanEmail]
    );

    let user;
    if (userRows.length === 0) {
      console.log(`🔐  [AUTH VERIFY] User not in DB — creating user account automatically for: ${cleanEmail}`);
      const crypto = require('crypto');
      const userId = crypto.randomUUID();
      await db.query(
        `INSERT INTO users (id, email, email_verified, profile_completed) VALUES ($1, $2, true, 0)`,
        [userId, cleanEmail]
      );
      
      const { rows: newRows } = await db.query(
        `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE id = $1`,
        [userId]
      );
      user = newRows[0];
    } else {
      user = userRows[0];
      await db.query(
        `UPDATE users SET email_verified = true, updated_at = datetime('now') WHERE id = $1`,
        [user.id]
      );
    }

    console.log(`🔐  [AUTH VERIFY] ✓ User verified (id=${user.id})`);

    if (user.is_banned) {
      console.warn(`🔐  [AUTH VERIFY] ✗ User is banned: ${cleanEmail}`);
      throw new AppError('This account has been suspended.', 403);
    }

    // 3. Check if subscription has expired
    if (
      user.subscription_status === 'active' &&
      user.subscription_expiry &&
      new Date() > new Date(user.subscription_expiry)
    ) {
      console.log(`🔐  [AUTH VERIFY] Subscription expired — updating status`);
      await db.query(
        `UPDATE users SET subscription_status = 'expired', updated_at = datetime('now') WHERE id = $1`,
        [user.id]
      );
      user.subscription_status = 'expired';
    }

    // 4. Check if profile exists and has required fields + min 2 photos
    const { rows: profileRows } = await db.query(
      `SELECT id, photos FROM profiles WHERE user_id = $1`,
      [user.id]
    );

    let isProfileCompleted = Boolean(user.profile_completed);
    if (!isProfileCompleted && profileRows.length > 0) {
      try {
        const photos = typeof profileRows[0].photos === 'string' ? JSON.parse(profileRows[0].photos) : profileRows[0].photos;
        if (Array.isArray(photos) && photos.length >= 2) {
          isProfileCompleted = true;
          await db.query(`UPDATE users SET profile_completed = 1 WHERE id = $1`, [user.id]);
        }
      } catch (e) {}
    }

    console.log(`🔐  [AUTH VERIFY] Profile completed: ${isProfileCompleted}`);

    // 5. Issue JWT
    console.log(`🔐  [AUTH VERIFY] Step 3: Issuing JWT…`);
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_status: user.subscription_status,
        profile_completed: isProfileCompleted,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    console.log(`🔐  [AUTH VERIFY] ── Login complete for ${cleanEmail} (userId=${user.id})\n`);
    res.status(200).json({
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
  } catch (err) {
    console.error(`🔐  [AUTH VERIFY] ✗ Error: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/auth/resend-otp
 * Enforces 30s cooldown and hourly abuse limits, invalidates prior OTPs, and issues a new OTP.
 */
async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    console.log(`\n🔄  [AUTH RESEND] ── Request received for: ${cleanEmail}`);

    // 1. Validate domain against allowlist
    console.log(`🔄  [AUTH RESEND] Step 1: Checking domain allowlist…`);
    if (!isAllowedDomain(cleanEmail)) {
      console.warn(`🔄  [AUTH RESEND] ✗ Domain rejected for: ${cleanEmail}`);
      throw new AppError("This email isn't eligible for verification", 403);
    }
    console.log(`🔄  [AUTH RESEND] ✓ Domain allowed`);

    // 2. Check DB-level hourly rate limit & 30-second cooldown
    console.log(`🔄  [AUTH RESEND] Step 2: Checking rate limit & cooldown…`);
    await checkResendRateLimit(cleanEmail);
    await checkOTPCooldown(cleanEmail);
    console.log(`🔄  [AUTH RESEND] ✓ Rate limit & cooldown OK`);

    // 3. Invalidate previous OTPs for that user
    console.log(`🔄  [AUTH RESEND] Step 3: Invalidating previous OTPs…`);
    await invalidatePreviousOTPs(cleanEmail);
    console.log(`🔄  [AUTH RESEND] ✓ Previous OTPs invalidated`);

    // 4. Generate new OTP
    console.log(`🔄  [AUTH RESEND] Step 4: Generating new OTP…`);
    const otp = await createOTP(cleanEmail);
    console.log(`🔄  [AUTH RESEND] ✓ New OTP generated`);

    // 5. Send email
    console.log(`🔄  [AUTH RESEND] Step 5: Sending OTP email…`);
    await sendOTPEmail(cleanEmail, otp);
    console.log(`🔄  [AUTH RESEND] ✓ Email send step completed`);

    console.log(`🔄  [AUTH RESEND] ── Resend flow complete for ${cleanEmail}\n`);
    res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your email.',
      data: {
        cooldownSeconds: 30,
      },
    });
  } catch (err) {
    console.error(`🔄  [AUTH RESEND] ✗ Error: ${err.message}`);
    if (err.details?.retryAfter) {
      res.set('Retry-After', String(err.details.retryAfter));
    }
    next(err);
  }
}

/**
 * POST /api/auth/google
 * Google Sign-In verification and JWT issue
 */
async function googleAuth(req, res, next) {
  try {
    const { credential } = req.body;
    if (!credential) {
      throw new AppError('Missing Google credential token.', 400);
    }

    // 1. Verify with Google's tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!verifyRes.ok) {
      throw new AppError('Invalid Google sign-in token. Please try again.', 401);
    }
    const verified = await verifyRes.json();

    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && verified.aud !== expectedClientId) {
      throw new AppError('Token audience mismatch', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    if (verified.exp && parseInt(verified.exp, 10) < now) {
      throw new AppError('Token has expired', 401);
    }

    const cleanEmail = (verified.email || '').trim().toLowerCase();
    const emailVerified = verified.email_verified === 'true' || verified.email_verified === true;

    if (!emailVerified) {
      throw new AppError('Your Google email is not verified.', 403);
    }

    // 2. Validate domain / allowlist (includes ALLOWED_EXTRA_EMAILS)
    if (!isAllowedDomain(cleanEmail)) {
      throw new AppError(
        'Only verified campus email addresses are allowed. Please sign in with your college email (e.g. @vitbhopal.ac.in).',
        403
      );
    }

    // 3. Find or create user
    let { rows } = await db.query(
      `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE LOWER(email) = LOWER($1)`,
      [cleanEmail]
    );

    if (rows.length > 0 && rows[0].is_banned) {
      throw new AppError('This account has been suspended.', 403);
    }

    let user;
    if (rows.length === 0) {
      const crypto = require('crypto');
      const userId = crypto.randomUUID();
      await db.query(
        `INSERT INTO users (id, email, email_verified, profile_completed) VALUES ($1, $2, 1, 0)`,
        [userId, cleanEmail]
      );
      const { rows: newRows } = await db.query(
        `SELECT id, email, role, subscription_status, subscription_expiry, is_banned, profile_completed FROM users WHERE id = $1`,
        [userId]
      );
      user = newRows[0];
      console.log(`✅ [GOOGLE AUTH] New user created: ${cleanEmail}`);
    } else {
      user = rows[0];
      await db.query(`UPDATE users SET email_verified = 1 WHERE id = $1`, [user.id]);
      console.log(`✅ [GOOGLE AUTH] Existing user signed in: ${cleanEmail}`);
    }

    // Check profile completion
    let isProfileCompleted = Boolean(user.profile_completed);
    if (!isProfileCompleted) {
      const { rows: profileRows } = await db.query(
        `SELECT id, photos FROM profiles WHERE user_id = $1`,
        [user.id]
      );
      if (profileRows.length > 0) {
        try {
          const photos = typeof profileRows[0].photos === 'string'
            ? JSON.parse(profileRows[0].photos)
            : profileRows[0].photos;
          if (Array.isArray(photos) && photos.length >= 2) {
            isProfileCompleted = true;
            await db.query(`UPDATE users SET profile_completed = 1 WHERE id = $1`, [user.id]);
          }
        } catch {}
      }
    }

    // 4. Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'student' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role || 'student',
          profile_completed: isProfileCompleted,
          has_profile: isProfileCompleted,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, verifyOtp, resendOtp, googleAuth };
