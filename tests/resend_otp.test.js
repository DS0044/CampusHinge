const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const {
  createOTP,
  verifyOTP,
  checkOTPCooldown,
  checkResendRateLimit,
  invalidatePreviousOTPs,
} = require('../src/services/otp.service');
const { app } = require('../src/index');

describe('Resend OTP & Cooldown Feature Tests', () => {
  const testEmail = 'cooldown.test@vitbhopal.ac.in';
  let server;
  let baseUrl;

  before(async () => {
    // Clean up any test records
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [testEmail]);
    await db.query(`DELETE FROM users WHERE email = $1`, [testEmail]);

    // Start server on ephemeral port for integration testing
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Clean up test data and close server
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [testEmail]);
    await db.query(`DELETE FROM users WHERE email = $1`, [testEmail]);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. Generates and stores initial OTP with timestamp', async () => {
    const code1 = await createOTP(testEmail);
    assert.match(code1, /^\d{6}$/, 'OTP should be 6 digits');

    const { rows } = await db.query(
      `SELECT code, used, created_at FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [testEmail]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].code, code1);
    assert.equal(Boolean(rows[0].used), false);
  });

  it('2. Enforces 30-second cooldown server-side when requested immediately', async () => {
    // Calling checkOTPCooldown immediately after createOTP should throw 429 with retryAfter
    await assert.rejects(
      async () => {
        await checkOTPCooldown(testEmail);
      },
      (err) => {
        assert.equal(err.statusCode, 429);
        assert.ok(err.details?.retryAfter > 0 && err.details?.retryAfter <= 30);
        assert.match(err.message, /Please wait \d+ seconds? before requesting another OTP\./);
        return true;
      }
    );
  });

  it('3. POST /api/auth/resend-otp rejects with 429 when cooldown is active', async () => {
    const res = await fetch(`${baseUrl}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    assert.equal(res.status, 429);
    assert.ok(res.headers.get('retry-after') != null);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error?.retryAfter > 0);
    assert.match(body.error?.message, /Please wait \d+ seconds? before requesting another OTP\./);
  });

  it('4. Allows resend once cooldown has passed, invalidates previous OTP, and issues new one', async () => {
    // Simulate cooldown elapsed by setting created_at 35 seconds in the past
    await db.query(
      `UPDATE otp_codes SET created_at = datetime('now', '-35 seconds') WHERE email = $1`,
      [testEmail]
    );

    // Now checkOTPCooldown should pass without throwing
    await assert.doesNotReject(async () => {
      await checkOTPCooldown(testEmail);
    });

    // Fetch initial OTP code
    const { rows: initialRows } = await db.query(
      `SELECT code FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [testEmail]
    );
    const initialCode = initialRows[0].code;

    // Call POST /api/auth/resend-otp
    const res = await fetch(`${baseUrl}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.message, /verification code has been sent/i);

    // Check DB: previous OTP should now be marked used/invalidated
    const { rows: allOtps } = await db.query(
      `SELECT code, used, created_at FROM otp_codes WHERE email = $1 ORDER BY created_at DESC`,
      [testEmail]
    );
    assert.equal(allOtps.length, 2);

    const latestOtp = allOtps[0];
    const olderOtp = allOtps[1];

    assert.equal(olderOtp.code, initialCode);
    assert.equal(Boolean(olderOtp.used), true, 'Older OTP must be invalidated');
    assert.notEqual(latestOtp.code, initialCode, 'New OTP must differ or be the latest active');
    assert.equal(Boolean(latestOtp.used), false, 'New OTP must be unused');
  });

  it('5. Entering old/invalidated OTP returns "This code has expired, please use the latest one sent."', async () => {
    const { rows: allOtps } = await db.query(
      `SELECT code, used FROM otp_codes WHERE email = $1 ORDER BY created_at DESC`,
      [testEmail]
    );
    const oldCode = allOtps[1].code; // Older code

    // Direct service verification test
    await assert.rejects(
      async () => {
        await verifyOTP(testEmail, oldCode);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'This code has expired, please use the latest one sent.');
        return true;
      }
    );

    // API endpoint test
    const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: oldCode }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error?.message, 'This code has expired, please use the latest one sent.');
  });

  it('6. Entering random incorrect code returns "Invalid OTP. Please check and try again."', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error?.message, 'Invalid OTP. Please check and try again.');
  });

  it('7. Entering the latest new OTP successfully verifies and creates/logs in user', async () => {
    const { rows: latestRows } = await db.query(
      `SELECT code FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [testEmail]
    );
    const latestCode = latestRows[0].code;

    const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: latestCode }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data?.token, 'Response must include JWT token');
  });

  it('8. Enforces abuse protection / hourly rate limit (max 5 OTPs per hour)', async () => {
    const spamEmail = 'spam.test@vitbhopal.ac.in';
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [spamEmail]);

    // Insert 5 OTPs in the last hour
    for (let i = 0; i < 5; i++) {
      const id = require('crypto').randomUUID();
      await db.query(
        `INSERT INTO otp_codes (id, email, code, expires_at, created_at)
         VALUES ($1, $2, $3, datetime('now', '+10 minutes'), datetime('now', '-10 minutes'))`,
        [id, spamEmail, `12345${i}`]
      );
    }

    // Should be rejected by checkResendRateLimit
    await assert.rejects(
      async () => {
        await checkResendRateLimit(spamEmail);
      },
      (err) => {
        assert.equal(err.statusCode, 429);
        assert.match(err.message, /Too many OTP resend attempts\./);
        return true;
      }
    );

    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [spamEmail]);
  });
});
