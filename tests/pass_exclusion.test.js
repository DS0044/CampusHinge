const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { app } = require('../src/index');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

describe('Permanent Pass Exclusion & Deck Discover Tests', () => {
  const user1Id = '11111111-1111-4111-8111-111111111111';
  const user2Id = '22222222-2222-4222-8222-222222222222';
  const user1Email = 'pass.user1@vitbhopal.ac.in';
  const user2Email = 'pass.user2@vitbhopal.ac.in';
  let user1Token;
  let server;
  let baseUrl;

  before(async () => {
    // Clean up test records
    await db.query(`DELETE FROM swipes WHERE swiper_id IN ($1, $2) OR swiped_id IN ($1, $2)`, [user1Id, user2Id]);
    await db.query(`DELETE FROM profiles WHERE user_id IN ($1, $2)`, [user1Id, user2Id]);
    await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [user1Id, user2Id]);

    // Create User 1 (swiper)
    await db.query(
      `INSERT INTO users (id, email, email_verified, is_banned) VALUES ($1, $2, 1, 0)`,
      [user1Id, user1Email]
    );
    await db.query(
      `INSERT INTO profiles (id, user_id, name, gender, interested_in, interests)
       VALUES ($1, $2, 'User One', 'male', 'everyone', '["Music", "Gaming"]')`,
      ['p1-' + user1Id, user1Id]
    );

    // Create User 2 (candidate)
    await db.query(
      `INSERT INTO users (id, email, email_verified, is_banned) VALUES ($1, $2, 1, 0)`,
      [user2Id, user2Email]
    );
    await db.query(
      `INSERT INTO profiles (id, user_id, name, gender, interested_in, interests)
       VALUES ($1, $2, 'User Two', 'female', 'everyone', '["Music", "Travel"]')`,
      ['p2-' + user2Id, user2Id]
    );

    user1Token = jwt.sign({ id: user1Id, email: user1Email, role: 'user' }, env.JWT_SECRET, {
      expiresIn: '1h',
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await db.query(`DELETE FROM swipes WHERE swiper_id IN ($1, $2) OR swiped_id IN ($1, $2)`, [user1Id, user2Id]);
    await db.query(`DELETE FROM profiles WHERE user_id IN ($1, $2)`, [user1Id, user2Id]);
    await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [user1Id, user2Id]);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. Discover deck initially includes eligible candidate', async () => {
    const res = await fetch(`${baseUrl}/api/discover`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    const candidate = data.data.profiles.find((p) => p.user_id === user2Id);
    assert.ok(candidate, 'Candidate User 2 should be in initial discover deck');
  });

  it('2. Swiping "pass" records the rejection in database', async () => {
    const res = await fetch(`${baseUrl}/api/swipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        swiped_id: user2Id,
        action: 'pass',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    const { rows } = await db.query(
      `SELECT swiper_id, swiped_id, action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`,
      [user1Id, user2Id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, 'pass');
  });

  it('3. Passed candidate is permanently excluded from discover deck even when no other candidates exist', async () => {
    const res = await fetch(`${baseUrl}/api/discover`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    const candidate = data.data.profiles.find((p) => p.user_id === user2Id);
    assert.equal(candidate, undefined, 'Passed candidate MUST NOT be in discover deck even when candidates pool is empty');
  });
});
