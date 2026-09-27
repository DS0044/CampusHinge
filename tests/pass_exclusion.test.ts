import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import db from '../src/config/db.js';
import { app } from '../src/index.js';
import jwt from 'jsonwebtoken';
import env from '../src/config/env.js';
import type { Server } from 'http';

describe('Discover Feed Looping & Profile Cycling Tests', () => {
  const user1Id = '11111111-1111-4111-8111-111111111111';
  const user2Id = '22222222-2222-4222-8222-222222222222';
  const user3Id = '33333333-3333-4333-8333-333333333333';
  const user1Email = 'loop.user1@vitbhopal.ac.in';
  const user2Email = 'loop.user2@vitbhopal.ac.in';
  const user3Email = 'loop.user3@vitbhopal.ac.in';
  let user1Token: string;
  let server: Server;
  let baseUrl: string;

  before(async () => {
    // Clean up previous test records
    await db.query(
      `DELETE FROM matches WHERE user1_id IN ($1, $2, $3) OR user2_id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );
    await db.query(
      `DELETE FROM swipes WHERE swiper_id IN ($1, $2, $3) OR swiped_id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );
    await db.query(
      `DELETE FROM profiles WHERE user_id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );
    await db.query(
      `DELETE FROM users WHERE id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );

    // Create User 1 (swiper)
    await db.query(
      `INSERT INTO users (id, email, email_verified, is_banned) VALUES ($1, $2, 1, 0)`,
      [user1Id, user1Email]
    );
    await db.query(
      `INSERT INTO profiles (id, user_id, name, gender, interested_in, interests)
       VALUES ($1, $2, 'User One', 'male', 'everyone', '["Music", "Gaming"]')`,
      [`p1-${user1Id}`, user1Id]
    );

    // Create User 2 (candidate to be passed then liked)
    await db.query(
      `INSERT INTO users (id, email, email_verified, is_banned) VALUES ($1, $2, 1, 0)`,
      [user2Id, user2Email]
    );
    await db.query(
      `INSERT INTO profiles (id, user_id, name, gender, interested_in, interests)
       VALUES ($1, $2, 'User Two', 'female', 'everyone', '["Music", "Travel"]')`,
      [`p2-${user2Id}`, user2Id]
    );

    // Create User 3 (matched user)
    await db.query(
      `INSERT INTO users (id, email, email_verified, is_banned) VALUES ($1, $2, 1, 0)`,
      [user3Id, user3Email]
    );
    await db.query(
      `INSERT INTO profiles (id, user_id, name, gender, interested_in, interests)
       VALUES ($1, $2, 'User Three', 'female', 'everyone', '["Gaming", "Coding"]')`,
      [`p3-${user3Id}`, user3Id]
    );

    user1Token = jwt.sign({ id: user1Id, email: user1Email, role: 'user' }, env.JWT_SECRET, {
      expiresIn: '1h',
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await db.query(
      `DELETE FROM matches WHERE user1_id IN ($1, $2, $3) OR user2_id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );
    await db.query(
      `DELETE FROM swipes WHERE swiper_id IN ($1, $2, $3) OR swiped_id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );
    await db.query(
      `DELETE FROM profiles WHERE user_id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );
    await db.query(
      `DELETE FROM users WHERE id IN ($1, $2, $3)`,
      [user1Id, user2Id, user3Id]
    );
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. Discover deck initially includes eligible candidates', async () => {
    const res = await fetch(`${baseUrl}/api/discover`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json() as { success: boolean; data: { profiles: Array<{ user_id: string }> } };
    assert.equal(data.success, true);
    const candidate2 = data.data.profiles.find((p) => p.user_id === user2Id);
    assert.ok(candidate2, 'Candidate User 2 should be in initial discover deck');
  });

  it('2. Swiping "pass" records the rejection in database', async () => {
    const res = await fetch(`${baseUrl}/api/swipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ swiped_id: user2Id, action: 'pass' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json() as { success: boolean };
    assert.equal(data.success, true);

    const { rows } = await db.query<{ swiper_id: string; swiped_id: string; action: string }>(
      `SELECT swiper_id, swiped_id, action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`,
      [user1Id, user2Id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, 'pass');
  });

  it('3. Passed candidate loops back into the deck when queue cycles', async () => {
    await fetch(`${baseUrl}/api/swipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ swiped_id: user3Id, action: 'pass' }),
    });

    const res = await fetch(`${baseUrl}/api/discover`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json() as {
      success: boolean;
      data: { profiles: Array<{ user_id: string; is_looped: number }> };
    };
    assert.equal(data.success, true);
    const candidate2 = data.data.profiles.find((p) => p.user_id === user2Id);
    assert.ok(candidate2, 'Passed candidate User 2 should loop back');
    assert.equal(candidate2.is_looped, 1, 'Candidate should be flagged as looped');
  });

  it('4. Swiping "like" permanently excludes the profile', async () => {
    const swipeRes = await fetch(`${baseUrl}/api/swipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ swiped_id: user2Id, action: 'like' }),
    });
    assert.equal(swipeRes.status, 200);

    const res = await fetch(`${baseUrl}/api/discover`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const data = await res.json() as {
      success: boolean;
      data: { profiles: Array<{ user_id: string }> };
    };
    assert.equal(data.success, true);
    const candidate2 = data.data.profiles.find((p) => p.user_id === user2Id);
    assert.equal(candidate2, undefined, 'Liked candidate MUST NEVER appear again');
  });

  it('5. Matched profiles never appear in the Discover queue', async () => {
    const matchId = `m13-${Date.now()}`;
    await db.query(
      `INSERT INTO matches (id, user1_id, user2_id, created_at) VALUES ($1, $2, $3, datetime('now'))`,
      [matchId, user1Id, user3Id]
    );

    const res = await fetch(`${baseUrl}/api/discover`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const data = await res.json() as {
      success: boolean;
      data: { profiles: Array<{ user_id: string }> };
    };
    assert.equal(data.success, true);
    const candidate3 = data.data.profiles.find((p) => p.user_id === user3Id);
    assert.equal(candidate3, undefined, 'Matched profile MUST NEVER appear in Discover queue');
  });
});
