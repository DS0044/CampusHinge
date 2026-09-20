/**
 * Discover Routes — Unified Multi-Intent Discover Deck
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import {
  computeCompatibilityScore,
  refreshTagPopularity,
  scoreCandidateForIntent,
  canSuperLike,
  parseJsonArray,
} from '../services/scoring.js';
import { INTENTS } from '../constants/intent.constants.js';

const discover = new Hono();
discover.use('/*', authenticate());

// GET /api/discover
discover.get('/', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
  const requestedIntent = c.req.query('intent');

  // Update last_active
  query(db, `UPDATE users SET last_active = datetime('now') WHERE id = $1`, [userId]).catch(() => {});

  // 1. Get my profile and user intent
  const { rows: myUserRows } = await query(db,
    `SELECT u.active_intent, u.last_super_like_at, p.gender, p.interested_in, p.interests, p.activity_tags, p.branch, p.year
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (myUserRows.length === 0 || !myUserRows[0].gender) {
    return c.json({ success: false, error: { message: 'Please create a profile before discovering others.' } }, 400);
  }

  const viewer = myUserRows[0];
  const userIntent = viewer.active_intent || 'dating';
  const activeIntent = requestedIntent && INTENTS.includes(requestedIntent) ? requestedIntent : userIntent;

  const myInterests = parseJsonArray(viewer.interests);
  const myActivityTags = parseJsonArray(viewer.activity_tags);

  // 2. Fetch candidate pool
  let candidates = [];
  const poolSize = Math.min(limit * 5, 100);

  if (activeIntent === 'dating') {
    let genderFilter = '';
    const params = [userId];
    let pi = 2;

    if (viewer.interested_in !== 'everyone') {
      genderFilter += ` AND p.gender = $${pi}`;
      params.push(viewer.interested_in);
      pi++;
    }
    genderFilter += ` AND (p.interested_in = $${pi} OR p.interested_in = 'everyone')`;
    params.push(viewer.gender);
    pi++;
    params.push(poolSize);

    const { rows } = await query(db,
      `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interested_in, p.interests, p.activity_tags, p.branch,
              COALESCE(u.active_intent, 'dating') AS active_intent,
              CASE
                WHEN p.user_id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1) THEN 0
                ELSE 1
              END AS is_looped
       FROM profiles p JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1 AND u.is_banned = 0 AND u.email_verified = 1
         AND p.user_id NOT IN (
           SELECT swiped_id FROM swipes WHERE swiper_id = $1 AND action IN ('like', 'super_like')
         )
         AND p.user_id NOT IN (
           SELECT user2_id FROM matches WHERE user1_id = $1
           UNION
           SELECT user1_id FROM matches WHERE user2_id = $1
         )
         AND p.user_id NOT IN (
           SELECT blocked_id FROM blocks WHERE blocker_id = $1
           UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
         )
         ${genderFilter}
       ORDER BY is_looped ASC, RANDOM() LIMIT $${pi}`,
      params
    );
    candidates = rows;
  } else {
    // Non-dating intent: Intent-first filtering
    const { rows: intentCandidates } = await query(db,
      `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interested_in, p.interests, p.activity_tags, p.branch,
              COALESCE(u.active_intent, 'dating') AS active_intent,
              CASE
                WHEN p.user_id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1) THEN 0
                ELSE 1
              END AS is_looped
       FROM profiles p JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1 AND u.is_banned = 0 AND u.email_verified = 1
         AND u.active_intent = $2
         AND p.user_id NOT IN (
           SELECT swiped_id FROM swipes WHERE swiper_id = $1 AND action IN ('like', 'super_like')
         )
         AND p.user_id NOT IN (
           SELECT user2_id FROM matches WHERE user1_id = $1
           UNION
           SELECT user1_id FROM matches WHERE user2_id = $1
         )
         AND p.user_id NOT IN (
           SELECT blocked_id FROM blocks WHERE blocker_id = $1
           UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
         )
       ORDER BY is_looped ASC, RANDOM() LIMIT $3`,
      [userId, activeIntent, poolSize]
    );

    candidates = intentCandidates;

    // Soft fallback if pool is sparse (< 5)
    if (candidates.length < 5) {
      const excludeIds = [userId, ...candidates.map((c) => c.user_id)];
      const placeholders = excludeIds.map((_, i) => `$${i + 1}`).join(',');
      const fallbackNeeded = poolSize - candidates.length;

      const { rows: fallbackCandidates } = await query(db,
        `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interested_in, p.interests, p.activity_tags, p.branch,
                COALESCE(u.active_intent, 'dating') AS active_intent,
                1 AS is_fallback,
                CASE
                  WHEN p.user_id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1) THEN 0
                  ELSE 1
                END AS is_looped
         FROM profiles p JOIN users u ON u.id = p.user_id
         WHERE p.user_id NOT IN (${placeholders})
           AND u.is_banned = 0 AND u.email_verified = 1
           AND p.user_id NOT IN (
             SELECT swiped_id FROM swipes WHERE swiper_id = $1 AND action IN ('like', 'super_like')
           )
           AND p.user_id NOT IN (
             SELECT user2_id FROM matches WHERE user1_id = $1
             UNION
             SELECT user1_id FROM matches WHERE user2_id = $1
           )
           AND p.user_id NOT IN (
             SELECT blocked_id FROM blocks WHERE blocker_id = $1
             UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
           )
         ORDER BY is_looped ASC, RANDOM() LIMIT ${fallbackNeeded}`,
        excludeIds
      );

      candidates = [...candidates, ...fallbackCandidates];
    }
  }

  // 3. Score each candidate
  const scoredProfiles = await Promise.all(
    candidates.map(async (candidate) => {
      const { score: baseCompatScore, breakdown } = await computeCompatibilityScore(db, userId, myInterests, candidate);
      const candInterests = parseJsonArray(candidate.interests);
      const candActivityTags = parseJsonArray(candidate.activity_tags);
      const sharedInterests = candInterests.filter((t) => myInterests.includes(t));
      const sharedActivityTags = candActivityTags.filter((t) => myActivityTags.includes(t));

      const candWithScore = { ...candidate, compatibility_score: baseCompatScore };
      let intentScore = scoreCandidateForIntent(activeIntent, viewer, candWithScore);
      if (candidate.is_fallback) {
        intentScore -= 40;
      }

      const superLikeCheck = canSuperLike(activeIntent, viewer, candidate);

      let photos = [];
      try {
        photos = typeof candidate.photos === 'string' ? JSON.parse(candidate.photos) : candidate.photos || [];
      } catch { photos = []; }

      return {
        id: candidate.user_id,
        user_id: candidate.user_id,
        name: candidate.name,
        bio: candidate.bio,
        year: candidate.year,
        gender: candidate.gender,
        branch: candidate.branch,
        photos,
        interests: candInterests,
        activity_tags: candActivityTags,
        active_intent: candidate.active_intent || 'dating',
        shared_interests: sharedInterests,
        shared_count: sharedInterests.length,
        shared_interests_count: sharedInterests.length,
        shared_activity_tags: sharedActivityTags,
        shared_activity_count: sharedActivityTags.length,
        compatibility_score: baseCompatScore,
        intent_score: intentScore,
        compatibility_breakdown: breakdown,
        is_looped: candidate.is_looped || 0,
        can_super_like: superLikeCheck.allowed,
        super_like_reason: superLikeCheck.reason,
      };
    })
  );

  // Sort unswiped first, then by intent score descending
  scoredProfiles.sort((a, b) => {
    if (a.is_looped !== b.is_looped) {
      return a.is_looped - b.is_looped;
    }
    return (b.intent_score || 0) - (a.intent_score || 0);
  });

  const topProfiles = scoredProfiles.slice(0, limit);

  // Background: refresh tag popularity
  c.executionCtx.waitUntil(refreshTagPopularity(db));

  // 4. Viewer super like status
  const lastSuperLikeAt = viewer.last_super_like_at;
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
      active_intent: activeIntent,
      super_like: {
        available: superLikeAvailable,
        next_available_in_seconds: nextSuperLikeInSeconds,
        last_super_like_at: lastSuperLikeAt || null,
      },
    },
  });
});

export default discover;
