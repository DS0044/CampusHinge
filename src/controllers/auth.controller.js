const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { isAllowedDomain } = require('../config/allowedDomains');
const { createOTP, verifyOTP, checkOTPRateLimit } = require('../services/otp.service');
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
      console.warn(`🔐  [AUTH LOGIN] ✗ User not found: ${cleanEmail}`);
      throw new AppError('No account found for this campus email. Please create an account first.', 404);
    }

    if (rows[0].is_banned) {
      console.warn(`🔐  [AUTH LOGIN] ✗ User is banned: ${cleanEmail}`);
      throw new AppError('This account has been suspended.', 403);
    }

    console.log(`🔐  [AUTH LOGIN] ✓ Existing user found (id=${rows[0].id})`);

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

module.exports = { signup, login, verifyOtp };
