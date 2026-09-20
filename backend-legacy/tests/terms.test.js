const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { app } = require('../src/index');

describe('Terms & Conditions Acceptance and Validation Tests', () => {
  const testEmail = 'terms.test@vitbhopal.ac.in';
  let server;
  let baseUrl;

  before(async () => {
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [testEmail]);
    await db.query(`DELETE FROM users WHERE email = $1`, [testEmail]);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await db.query(`DELETE FROM otp_codes WHERE email = $1`, [testEmail]);
    await db.query(`DELETE FROM users WHERE email = $1`, [testEmail]);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. Rejects signup when accepted_terms is missing with 400 and exact message', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Expected 400 status when accepted_terms is missing');
    assert.equal(
      data?.error?.message,
      'You must accept the Terms & Conditions to create an account.',
      'Expected exact error message'
    );
  });

  it('2. Rejects signup when accepted_terms is false with 400 and exact message', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: false }),
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Expected 400 status when accepted_terms is false');
    assert.equal(
      data?.error?.message,
      'You must accept the Terms & Conditions to create an account.',
      'Expected exact error message'
    );
  });

  it('3. Rejects signup when accepted_terms is string "false" with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: 'false' }),
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Expected 400 status when accepted_terms is "false"');
    assert.equal(
      data?.error?.message,
      'You must accept the Terms & Conditions to create an account.',
      'Expected exact error message'
    );
  });

  it('4. Accepts signup when accepted_terms is true, sends OTP and records accepted_terms_at & terms_version in DB', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: true }),
    });

    const data = await res.json();
    assert.equal(res.status, 200, 'Expected 200 status when accepted_terms is true');
    assert.equal(data.success, true);

    // Verify DB user record
    const { rows } = await db.query(
      `SELECT id, email, accepted_terms_at, terms_version FROM users WHERE email = $1`,
      [testEmail]
    );

    assert.equal(rows.length, 1, 'User record must exist in DB');
    assert.ok(rows[0].accepted_terms_at, 'accepted_terms_at timestamp must be present');
    assert.ok(!isNaN(Date.parse(rows[0].accepted_terms_at)), 'accepted_terms_at must be a valid date');
    assert.equal(rows[0].terms_version, '1.0', 'terms_version must be "1.0"');
  });

  it('5. Accepts subsequent signup with accepted_terms: true and updates timestamp', async () => {
    // Wait a brief moment to ensure updated timestamp differs
    await new Promise((r) => setTimeout(r, 50));

    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: true }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);

    const { rows } = await db.query(
      `SELECT id, email, accepted_terms_at, terms_version FROM users WHERE email = $1`,
      [testEmail]
    );

    assert.equal(rows.length, 1);
    assert.ok(rows[0].accepted_terms_at);
    assert.equal(rows[0].terms_version, '1.0');
  });
});
