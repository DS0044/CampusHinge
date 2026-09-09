const crypto = require('crypto');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * Generate a 6-digit numeric OTP.
 */
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

const COOLDOWN_SECONDS = 30;

/**
 * Create and store a new OTP for the given email.
 * OTP expires after 10 minutes.
 */
async function createOTP(email) {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const now = new Date();

  console.log(`🔑  [OTP] Generated code for ${email}: ${code} (expires ${expiresAt.toISOString()})`);

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, email.toLowerCase(), code, expiresAt.toISOString(), now.toISOString()]
  );

  console.log(`🔑  [OTP] Stored in database successfully for ${email}`);
  return code;
}

/**
 * Invalidate all previous unused OTP codes for this user.
 */
async function invalidatePreviousOTPs(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  await db.query(
    `UPDATE otp_codes SET used = true WHERE email = $1 AND used = false`,
    [cleanEmail]
  );
  console.log(`🧹  [OTP] Invalidated previous active OTPs for ${cleanEmail}`);
}

/**
 * Check if the 30-second cooldown has elapsed since the last OTP was sent to this email.
 * Rejects with 429 Too Many Requests and retryAfter seconds remaining.
 */
async function checkOTPCooldown(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const { rows } = await db.query(
    `SELECT created_at FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail]
  );

  if (rows.length === 0) return;

  const rawCreatedAt = rows[0].created_at;
  const lastSentTime = new Date(
    rawCreatedAt.includes('T') ? rawCreatedAt : rawCreatedAt.replace(' ', 'T') + 'Z'
  ).getTime();
  const elapsedSeconds = Math.floor((Date.now() - lastSentTime) / 1000);

  if (elapsedSeconds < COOLDOWN_SECONDS) {
    const retryAfter = COOLDOWN_SECONDS - Math.max(0, elapsedSeconds);
    console.warn(`⏳  [OTP COOLDOWN] Cooldown active for ${cleanEmail}: ${retryAfter}s remaining`);
    throw new AppError(
      `Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before requesting another OTP.`,
      429,
      { retryAfter }
    );
  }
}

/**
 * Check rate limit for resending OTP: max 5 resend requests per email per hour.
 */
async function checkResendRateLimit(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const { rows } = await db.query(
    `SELECT COUNT(*) AS count
     FROM otp_codes
     WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [cleanEmail]
  );

  const count = parseInt(rows[0].count, 10);
  console.log(`🚦  [OTP RESEND RATE] ${cleanEmail} has ${count}/5 OTP requests in last hour`);

  if (count >= 5) {
    console.warn(`🚦  [OTP RESEND RATE] Blocked — too many OTP requests for ${cleanEmail}`);
    throw new AppError('Too many OTP resend attempts. Please try again after 1 hour.', 429, { retryAfter: 3600 });
  }
}

/**
 * Verify an OTP for the given email.
 * Returns true if valid, throws AppError if invalid/expired/already used.
 */
async function verifyOTP(email, code) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim();

  console.log(`🔍  [OTP VERIFY] Checking code for ${cleanEmail} (code="${cleanCode}")…`);

  const { rows } = await db.query(
    `SELECT id, code, expires_at, used, created_at
     FROM otp_codes
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [cleanEmail]
  // Accept any valid unexpired unused OTP code for this email
  const { rows: validRows } = await db.query(
    `SELECT id, code, expires_at, used FROM otp_codes 
     WHERE email = $1 AND code = $2 AND used = false AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, cleanCode]
  );

  if (validRows.length > 0) {
    // Invalidate all OTPs for this user once verified
    await db.query(`UPDATE otp_codes SET used = true WHERE email = $1`, [cleanEmail]);
    console.log(`✅  [OTP VERIFY] Code verified successfully for ${email}`);
    return true;
  }

  // Check if code was already used
  const { rows: usedRows } = await db.query(
    `SELECT id FROM otp_codes WHERE email = $1 AND code = $2 AND used = true ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, cleanCode]
  );
  if (usedRows.length > 0) {
    console.warn(`🔍  [OTP VERIFY] OTP already used for ${cleanEmail}`);
    throw new AppError('This OTP has already been used. Please request a new one.', 400);
  }

  // Check if code expired
  const { rows: expiredRows } = await db.query(
    `SELECT id FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at <= datetime('now') ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, cleanCode]
  );
  if (expiredRows.length > 0) {
    console.warn(`🔍  [OTP VERIFY] OTP expired for ${cleanEmail}`);
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  console.warn(`🔍  [OTP VERIFY] Invalid OTP entered for ${cleanEmail}: got "${cleanCode}"`);
  throw new AppError('Invalid OTP. Please check and try again.', 400);
}

/**
 * Check rate limit: max 5 OTPs per email in the last 5 minutes.
 * This is an additional DB-level check on top of the express-rate-limit middleware.
 */
async function checkOTPRateLimit(email) {
  const { rows } = await db.query(
    `SELECT COUNT(*) AS count
     FROM otp_codes
     WHERE email = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
    [email.toLowerCase()]
  );

  const count = parseInt(rows[0].count, 10);
  console.log(`🚦  [OTP RATE] ${email} has ${count}/5 OTP requests in last 5 minutes`);

  if (count >= 5) {
    console.warn(`🚦  [OTP RATE] Blocked — too many OTP requests for ${email}`);
    throw new AppError('Too many OTP requests. Please try again after 5 minutes.', 429);
  }
}

module.exports = {
  COOLDOWN_SECONDS,
  createOTP,
  verifyOTP,
  checkOTPRateLimit,
  checkOTPCooldown,
  checkResendRateLimit,
  invalidatePreviousOTPs,
};
