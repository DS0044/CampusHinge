import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import db from '../src/config/db.js';
import { createOTP, verifyOTP, checkOTPCooldown, checkResendRateLimit } from '../src/services/otp.service.js';
import { app } from '../src/index.js';
import { randomUUID } from 'crypto';

interface OtpRow { code: string; used: number; created_at: string }

describe('Resend OTP & Cooldown Feature Tests', () => {
  const testEmail = 'cooldown.test@vitbhopal.ac.in';
  let server: Server;
  let baseUrl: string;

  before(async () => {
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [testEmail]);
    await db.query(`DELETE FROM users WHERE email = $1`, [testEmail]);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [testEmail]);
    await db.query(`DELETE FROM users WHERE email = $1`, [testEmail]);
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. Generates and stores initial OTP with timestamp', async () => {
    const code1 = await createOTP(testEmail);
    assert.match(code1, /^\d{6}$/, 'OTP should be 6 digits');
    const { rows } = await db.query<OtpRow>(
      `SELECT code, used, created_at FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [testEmail]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].code, code1);
    assert.equal(Boolean(rows[0].used), false);
  });

  it('2. Enforces 30-second cooldown server-side when requested immediately', async () => {
    await assert.rejects(
      async () => { await checkOTPCooldown(testEmail); },
      (err: { statusCode: number; details?: { retryAfter: number }; message: string }) => {
        assert.equal(err.statusCode, 429);
        assert.ok((err.details?.retryAfter ?? 0) > 0 && (err.details?.retryAfter ?? 0) <= 30);
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
    const body = await res.json() as { success: boolean; error?: { retryAfter: number; message: string } };
    assert.equal(body.success, false);
    assert.ok((body.error?.retryAfter ?? 0) > 0);
    assert.match(body.error?.message ?? '', /Please wait \d+ seconds? before requesting another OTP\./);
  });

  it('4. Allows resend once cooldown has passed, invalidates previous OTP, issues new one', async () => {
    await db.query(
      `UPDATE otp_codes SET created_at = datetime('now', '-35 seconds') WHERE email = $1`,
      [testEmail]
    );
    await assert.doesNotReject(async () => { await checkOTPCooldown(testEmail); });

    const { rows: initialRows } = await db.query<OtpRow>(
      `SELECT code FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [testEmail]
    );
    const initialCode = initialRows[0].code;

    const res = await fetch(`${baseUrl}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; message: string };
    assert.equal(body.success, true);
    assert.match(body.message, /verification code has been sent/i);

    const { rows: allOtps } = await db.query<OtpRow>(
      `SELECT code, used, created_at FROM otp_codes WHERE email = $1 ORDER BY created_at DESC`,
      [testEmail]
    );
    assert.equal(allOtps.length, 2);
    assert.equal(allOtps[1].code, initialCode);
    assert.equal(Boolean(allOtps[1].used), true, 'Older OTP must be invalidated');
    assert.equal(Boolean(allOtps[0].used), false, 'New OTP must be unused');
  });

  it('5. Entering old/invalidated OTP returns correct error', async () => {
    const { rows: allOtps } = await db.query<OtpRow>(
      `SELECT code, used FROM otp_codes WHERE email = $1 ORDER BY created_at DESC`,
      [testEmail]
    );
    const oldCode = allOtps[1].code;

    await assert.rejects(
      async () => { await verifyOTP(testEmail, oldCode); },
      (err: { statusCode: number; message: string }) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'This code has expired, please use the latest one sent.');
        return true;
      }
    );

    const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: oldCode }),
    });
    assert.equal(res.status, 400);
    const body = await res.json() as { error?: { message: string } };
    assert.equal(body.error?.message, 'This code has expired, please use the latest one sent.');
  });

  it('6. Entering random incorrect code returns "Invalid OTP" error', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json() as { error?: { message: string } };
    assert.equal(body.error?.message, 'Invalid OTP. Please check and try again.');
  });

  it('7. Entering the latest new OTP successfully verifies and logs in user', async () => {
    const { rows: latestRows } = await db.query<OtpRow>(
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
    const body = await res.json() as { success: boolean; data?: { token: string } };
    assert.equal(body.success, true);
    assert.ok(body.data?.token, 'Response must include JWT token');
  });

  it('8. Enforces hourly rate limit (max 5 OTPs per hour)', async () => {
    const spamEmail = 'spam.test@vitbhopal.ac.in';
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [spamEmail]);
    for (let i = 0; i < 5; i++) {
      const id = randomUUID();
      await db.query(
        `INSERT INTO otp_codes (id, email, code, expires_at, created_at)
         VALUES ($1, $2, $3, datetime('now', '+10 minutes'), datetime('now', '-10 minutes'))`,
        [id, spamEmail, `12345${i}`]
      );
    }
    await assert.rejects(
      async () => { await checkResendRateLimit(spamEmail); },
      (err: { statusCode: number; message: string }) => {
        assert.equal(err.statusCode, 429);
        assert.match(err.message, /Too many OTP resend attempts\./);
        return true;
      }
    );
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [spamEmail]);
  });
});
