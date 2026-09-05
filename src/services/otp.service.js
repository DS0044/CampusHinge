const crypto = require('crypto');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * Generate a 6-digit numeric OTP.
 */
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Create and store a new OTP for the given email.
 * OTP expires after 10 minutes.
 */
async function createOTP(email) {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  console.log(`🔑  [OTP] Generated code for ${email}: ${code} (expires ${expiresAt.toISOString()})`);

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO otp_codes (id, email, code, expires_at) VALUES ($1, $2, $3, $4)`,
    [id, email.toLowerCase(), code, expiresAt.toISOString()]
  );

  console.log(`🔑  [OTP] Stored in database successfully for ${email}`);
  return code;
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
    `SELECT id, code, expires_at, used
     FROM otp_codes
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [cleanEmail]
  );

  if (rows.length === 0) {
    console.warn(`🔍  [OTP VERIFY] No OTP found in DB for ${cleanEmail}`);
    throw new AppError('No OTP found for this email. Please request a new one.', 400);
  }

  const otp = rows[0];

  if (otp.used) {
    console.warn(`🔍  [OTP VERIFY] OTP already used for ${cleanEmail} (id=${otp.id})`);
    throw new AppError('This OTP has already been used. Please request a new one.', 400);
  }

  if (new Date() > new Date(otp.expires_at)) {
    console.warn(`🔍  [OTP VERIFY] OTP expired for ${cleanEmail} (expired at ${otp.expires_at})`);
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  if (String(otp.code).trim() !== cleanCode) {
    console.warn(`🔍  [OTP VERIFY] Wrong code for ${cleanEmail}: got "${cleanCode}", expected "${otp.code}"`);
    throw new AppError('Invalid OTP. Please check and try again.', 400);
  }

  // Mark as used
  await db.query(`UPDATE otp_codes SET used = true WHERE id = $1`, [otp.id]);
  console.log(`✅  [OTP VERIFY] Code verified successfully for ${email}`);

  return true;
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

module.exports = { createOTP, verifyOTP, checkOTPRateLimit };
