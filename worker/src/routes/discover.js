/**
 * Discover Routes — Scored deck with 3-signal matching
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { computeCompatibilityScore, refreshTagPopularity } from '../services/scoring.js';

const discover = new Hono();
discover.use('/*', authenticate());

// GET /api/discover
discover.get('/', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);

  // Update last_active
  query(db, `UPDATE users SET last_active = datetime('now') WHERE id = $1`, [userId]).catch(() => {});

  // 1. Get my profile
  const { rows: myProfile } = await query(db,
    `SELECT gender, interested_in, interests FROM profiles WHERE user_id = $1`, [userId]
  );
  if (myProfile.length === 0) {
    return c.json({ success: false, error: { message: 'Please create a profile before discovering others.' } }, 400);
  }

  const { gender: myGender, interested_in: myInterestedIn } = myProfile[0];
  let myInterests = [];
  try { myInterests = typeof myProfile[0].interests === 'string' ? JSON.parse(myProfile[0].interests) : myProfile[0].interests || []; } catch { myInterests = []; }

  // 2. Build gender filter
  let genderFilter = '';
  const params = [userId];
  let pi = 2;

  if (myInterestedIn !== 'everyone') {
    genderFilter += ` AND p.gender = $${pi}`;
    params.push(myInterestedIn);
    pi++;
  }
  genderFilter += ` AND (p.interested_in = $${pi} OR p.interested_in = 'everyone')`;
  params.push(myGender);
  pi++;

  const poolSize = Math.min(limit * 5, 100);
  params.push(poolSize);

  // 3. Fetch candidate pool (unswiped first)
  let { rows: candidates } = await query(db,
    `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interested_in, p.interests, p.branch
     FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.user_id != $1 AND u.is_banned = 0 AND u.email_verified = 1
       AND p.user_id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1)
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
       )
       ${genderFilter}
     ORDER BY RANDOM() LIMIT $${pi}`,
    params
  );

  // 4. Score each candidate
  const scoredProfiles = await Promise.all(
    candidates.map(async (candidate) => {
      const { score, breakdown } = await computeCompatibilityScore(db, userId, myInterests, candidate);
      let photos = [], interests = [];
      try { photos = typeof candidate.photos === 'string' ? JSON.parse(candidate.photos) : candidate.photos || []; } catch { photos = []; }
      try { interests = typeof candidate.interests === 'string' ? JSON.parse(candidate.interests) : candidate.interests || []; } catch { interests = []; }

      const sharedInterests = Array.isArray(interests) && Array.isArray(myInterests)
        ? interests.filter(tag => myInterests.includes(tag)) : [];

      return {
        id: candidate.user_id, user_id: candidate.user_id,
        name: candidate.name, bio: candidate.bio, year: candidate.year,
        gender: candidate.gender, branch: candidate.branch,
        photos, interests, shared_interests: sharedInterests,
        shared_count: sharedInterests.length,
        shared_interests_count: sharedInterests.length,
        compatibility_score: score, compatibility_breakdown: breakdown,
      };
    })
  );

  scoredProfiles.sort((a, b) => b.compatibility_score - a.compatibility_score);
  const topProfiles = scoredProfiles.slice(0, limit);

  // Background: refresh tag popularity
  c.executionCtx.waitUntil(refreshTagPopularity(db));

  // 5. Check viewer's super like 24-hour limit status
  const { rows: viewerUser } = await query(db, `SELECT last_super_like_at FROM users WHERE id = $1`, [userId]);
  const lastSuperLikeAt = viewerUser[0]?.last_super_like_at;
  let superLikeAvailable = true;
  let nextSuperLikeInSeconds = 0;

  if (lastSuperLikeAt) {
    let lastTimeStr = String(lastSuperLikeAt);
    if (!lastTimeStr.endsWith('Z') && !lastTimeStr.includes('+')) {
      lastTimeStr = lastTimeStr.replace(' ', 'T') + 'Z';
    }
    const lastMs = new Date(lastTimeStr).getTime();
    const elapsedMs = Date.now() - lastMs;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (!isNaN(lastMs) && elapsedMs < ONE_DAY_MS) {
      superLikeAvailable = false;
      nextSuperLikeInSeconds = Math.ceil((ONE_DAY_MS - elapsedMs) / 1000);
    }
  }

  return c.json({
    success: true,
    data: {
      profiles: topProfiles,
      count: topProfiles.length,
      super_like: {
        available: superLikeAvailable,
        next_available_in_seconds: nextSuperLikeInSeconds,
        last_super_like_at: lastSuperLikeAt || null,
      },
    },
  });
});

export default discover;
