/**
 * Scoring Service — Multi-Signal Compatibility Engine for Cloudflare Workers.
 *
 * Same algorithm as the Node.js version, adapted for D1:
 * - db is passed as parameter (from c.env.DB) instead of require()
 * - No module-level caches (Workers are stateless per request)
 *   Instead, we compute everything per-request (fine for ~500 users)
 *
 * SCORE = (0.45 × Interest Score) + (0.30 × Behavioral Score) + (0.25 × Freshness)
 */

import { query } from '../db.js';

// ═══════════════════════════════════════════════
// SIGNAL 1: INTEREST OVERLAP (45%)
// ═══════════════════════════════════════════════

async function getTagPopularity(db) {
  try {
    const { rows } = await query(db, 'SELECT tag, user_count FROM interest_popularity', []);
    const map = {};
    for (const row of rows) map[row.tag] = row.user_count;
    return map;
  } catch {
    return {};
  }
}

export async function computeInterestScore(db, myInterests, theirInterests) {
  if (!Array.isArray(myInterests) || !Array.isArray(theirInterests)) return 0;
  if (myInterests.length === 0 || theirInterests.length === 0) return 0;

  const popularity = await getTagPopularity(db);

  let rawScore = 0;
  let maxPossible = 0;

  for (const tag of myInterests) {
    const pop = popularity[tag] || 1;
    maxPossible += 1 / Math.log2(pop + 2);
  }

  const sharedTags = myInterests.filter(t => theirInterests.includes(t));
  for (const tag of sharedTags) {
    const pop = popularity[tag] || 1;
    rawScore += 1 / Math.log2(pop + 2);
  }

  // Small bonus for rare unique tags
  const uniqueRare = theirInterests.filter(t => !myInterests.includes(t));
  for (const tag of uniqueRare) {
    const pop = popularity[tag] || 1;
    if (pop <= 3) rawScore += 0.1 / Math.log2(pop + 2);
  }

  if (maxPossible === 0) return 0;
  return Math.min(100, Math.round((rawScore / maxPossible) * 100));
}

// ═══════════════════════════════════════════════
// SIGNAL 2: BEHAVIORAL LEARNING (30%)
// ═══════════════════════════════════════════════

export async function computeBehavioralScore(db, userId, candidateInterests) {
  if (!Array.isArray(candidateInterests) || candidateInterests.length === 0) return 50;

  try {
    const { rows: prefs } = await query(db,
      'SELECT tag, likes, total FROM swipe_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefs.length === 0) return 50; // No history — neutral

    const affinity = {};
    for (const row of prefs) {
      if (row.total > 0) affinity[row.tag] = row.likes / row.total;
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const tag of candidateInterests) {
      if (affinity[tag] !== undefined) {
        const pref = prefs.find(p => p.tag === tag);
        const confidence = Math.min(pref.total / 10, 1);
        weightedSum += affinity[tag] * confidence;
        totalWeight += confidence;
      }
    }

    if (totalWeight === 0) return 50;
    return Math.round((weightedSum / totalWeight) * 100);
  } catch {
    return 50;
  }
}

export async function updateSwipePreferences(db, userId, candidateInterests, action) {
  if (!Array.isArray(candidateInterests) || candidateInterests.length === 0) return;
  const isLike = action === 'like' ? 1 : 0;

  for (const tag of candidateInterests) {
    try {
      await query(db,
        `INSERT INTO swipe_preferences (user_id, tag, likes, total)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, tag) DO UPDATE SET
           likes = swipe_preferences.likes + $3,
           total = swipe_preferences.total + 1`,
        [userId, tag, isLike]
      );
    } catch { /* non-critical */ }
  }
}

// ═══════════════════════════════════════════════
// SIGNAL 3: FRESHNESS & FAIRNESS (25%)
// ═══════════════════════════════════════════════

export async function computeFreshnessScore(db, candidateUserId) {
  try {
    const { rows } = await query(db,
      `SELECT u.created_at, u.last_active,
              (SELECT COUNT(*) FROM swipes WHERE swiped_id = $1 AND action = 'like') AS likes_received,
              (SELECT COUNT(*) FROM swipes WHERE swiped_id = $1) AS total_swipes_received
       FROM users u WHERE u.id = $1`,
      [candidateUserId]
    );

    if (rows.length === 0) return 50;
    const user = rows[0];
    const now = Date.now();

    // Recency (0–40)
    let recencyScore = 20;
    if (user.last_active) {
      const h = (now - new Date(user.last_active).getTime()) / 3600000;
      recencyScore = h < 1 ? 40 : h < 24 ? 35 : h < 72 ? 25 : h < 168 ? 15 : 5;
    }

    // Anti-popularity (0–30)
    let fairnessScore = 30;
    if (user.total_swipes_received > 5) {
      const ratio = user.likes_received / user.total_swipes_received;
      fairnessScore = ratio > 0.8 ? 10 : ratio > 0.6 ? 20 : 30;
    }

    // New user boost (0–30)
    let newUserScore = 0;
    if (user.created_at) {
      const days = (now - new Date(user.created_at).getTime()) / 86400000;
      newUserScore = days < 2 ? 30 : days < 7 ? 20 : days < 14 ? 10 : 0;
    }

    return Math.min(100, recencyScore + fairnessScore + newUserScore);
  } catch {
    return 50;
  }
}

// ═══════════════════════════════════════════════
// COMBINED SCORE
// ═══════════════════════════════════════════════

const W_INTEREST = 0.45;
const W_BEHAVIORAL = 0.30;
const W_FRESHNESS = 0.25;

export async function computeCompatibilityScore(db, userId, myInterests, candidateProfile) {
  let candidateInterests = [];
  try {
    candidateInterests = typeof candidateProfile.interests === 'string'
      ? JSON.parse(candidateProfile.interests)
      : candidateProfile.interests || [];
  } catch { candidateInterests = []; }

  const candidateUserId = candidateProfile.user_id || candidateProfile.id;

  const [interestScore, behavioralScore, freshnessScore] = await Promise.all([
    computeInterestScore(db, myInterests, candidateInterests),
    computeBehavioralScore(db, userId, candidateInterests),
    computeFreshnessScore(db, candidateUserId),
  ]);

  const totalScore = Math.round(
    W_INTEREST * interestScore + W_BEHAVIORAL * behavioralScore + W_FRESHNESS * freshnessScore
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown: { interest: interestScore, behavioral: behavioralScore, freshness: freshnessScore },
  };
}

export async function refreshTagPopularity(db) {
  try {
    const { rows } = await query(db, 'SELECT interests FROM profiles', []);
    const tagCounts = {};

    for (const row of rows) {
      let interests = [];
      try { interests = typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests || []; } catch { continue; }
      if (!Array.isArray(interests)) continue;
      for (const tag of interests) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    for (const [tag, count] of Object.entries(tagCounts)) {
      await query(db,
        `INSERT INTO interest_popularity (tag, user_count, updated_at)
         VALUES ($1, $2, datetime('now'))
         ON CONFLICT (tag) DO UPDATE SET user_count = $2, updated_at = datetime('now')`,
        [tag, count]
      );
    }
  } catch (err) {
    console.error('refreshTagPopularity error:', err.message);
  }
}
