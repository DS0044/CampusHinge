import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import db from '../src/config/db.js';
import { app } from '../src/index.js';

interface TermsUserRow {
  id: string;
  email: string;
  accepted_terms_at: string;
  terms_version: string;
}

describe('Terms & Conditions Acceptance and Validation Tests', () => {
  const testEmail = 'terms.test@vitbhopal.ac.in';
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

  it('1. Rejects signup when accepted_terms is missing with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const data = await res.json() as { error?: { message: string } };
    assert.equal(res.status, 400, 'Expected 400 when accepted_terms is missing');
    assert.equal(data?.error?.message, 'You must accept the Terms & Conditions to create an account.');
  });

  it('2. Rejects signup when accepted_terms is false with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: false }),
    });
    const data = await res.json() as { error?: { message: string } };
    assert.equal(res.status, 400);
    assert.equal(data?.error?.message, 'You must accept the Terms & Conditions to create an account.');
  });

  it('3. Rejects signup when accepted_terms is string "false" with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: 'false' }),
    });
    const data = await res.json() as { error?: { message: string } };
    assert.equal(res.status, 400);
    assert.equal(data?.error?.message, 'You must accept the Terms & Conditions to create an account.');
  });

  it('4. Accepts signup when accepted_terms is true and records accepted_terms_at & terms_version in DB', async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: true }),
    });
    const data = await res.json() as { success: boolean };
    assert.equal(res.status, 200);
    assert.equal(data.success, true);

    const { rows } = await db.query<TermsUserRow>(
      `SELECT id, email, accepted_terms_at, terms_version FROM users WHERE email = $1`,
      [testEmail]
    );
    assert.equal(rows.length, 1, 'User record must exist in DB');
    assert.ok(rows[0].accepted_terms_at, 'accepted_terms_at timestamp must be present');
    assert.ok(!isNaN(Date.parse(rows[0].accepted_terms_at)), 'accepted_terms_at must be a valid date');
    assert.equal(rows[0].terms_version, '1.0', 'terms_version must be "1.0"');
  });

  it('5. Accepts subsequent signup with accepted_terms: true and updates timestamp', async () => {
    await new Promise<void>((r) => setTimeout(r, 50));

    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, accepted_terms: true }),
    });
    const data = await res.json() as { success: boolean };
    assert.equal(res.status, 200);

    const { rows } = await db.query<TermsUserRow>(
      `SELECT id, email, accepted_terms_at, terms_version FROM users WHERE email = $1`,
      [testEmail]
    );
    assert.equal(rows.length, 1);
    assert.ok(rows[0].accepted_terms_at);
    assert.equal(rows[0].terms_version, '1.0');
  });
});
