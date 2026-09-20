const db = require('../config/db');

/**
 * Scoring Service — Multi-Signal Compatibility Engine for CampusHinge
 *
 * Computes a 0–100 compatibility score using 3 weighted signals:
 *
 *   SCORE = (0.45 × Interest Score)
 *         + (0.30 × Behavioral Score)
 *         + (0.25 × Freshness & Fairness)
 *
 * - Interest Score:   Rarity-weighted overlap (rare shared tags > common ones)
 * - Behavioral Score: Learned from swipe patterns (what you actually like)
 * - Freshness:        Recency + anti-popularity + new-user boost
 *
 * All scoring runs in-process with SQLite — no ML dependencies.
 */

// ── Interest popularity cache (refreshed every 10 min) ──
let popularityCache = null;
let popularityCacheAt = 0;
const POPULARITY_TTL = 10 * 60 * 1000;

/**
 * Get tag popularity map: tag → number of users who have that tag.
 * Used to weight rare interests higher.
 */
async function getTagPopularity() {
  if (popularityCache && Date.now() - popularityCacheAt < POPULARITY_TTL) {
    return popularityCache;
  }

  try {
    const { rows } = await db.query(
      `SELECT tag, user_count FROM interest_popularity`, []
    );
    popularityCache = {};
    for (const row of rows) {
      popularityCache[row.tag] = row.user_count;
    }
    popularityCacheAt = Date.now();
  } catch {
    popularityCache = {};
    popularityCacheAt = Date.now();
  }
  return popularityCache;
}

/**
 * Refresh the interest_popularity table from current profile data.
 * Call this periodically or after profile updates.
 */
async function refreshTagPopularity() {
  try {
    const { rows } = await db.query(`SELECT interests FROM profiles`, []);
    const tagCounts = {};

    for (const row of rows) {
      let interests = [];
      try {
        interests = typeof row.interests === 'string'
          ? JSON.parse(row.interests)
          : row.interests || [];
      } catch { continue; }

      if (!Array.isArray(interests)) continue;
      for (const tag of interests) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    // Upsert all tags
    for (const [tag, count] of Object.entries(tagCounts)) {
      await db.query(
        `INSERT INTO interest_popularity (tag, user_count, updated_at)
         VALUES ($1, $2, datetime('now'))
         ON CONFLICT (tag) DO UPDATE SET user_count = $2, updated_at = datetime('now')`,
        [tag, count]
      );
    }

    // Clear cache so next call picks up fresh data
    popularityCache = null;
  } catch (err) {
    console.error('❌  refreshTagPopularity error:', err.message);
  }
}


// ═══════════════════════════════════════════════
// ██  SIGNAL 1: INTEREST OVERLAP (45% weight)  ██
// ═══════════════════════════════════════════════

/**
 * Compute rarity-weighted interest overlap score (0–100).
 *
 * Rare shared interests count more than common ones.
 * Formula: score = Σ(1 / log2(popularity + 2)) for each shared tag, normalized.
 */
async function computeInterestScore(myInterests, theirInterests) {
  if (!Array.isArray(myInterests) || !Array.isArray(theirInterests)) return 0;
  if (myInterests.length === 0 || theirInterests.length === 0) return 0;

  const popularity = await getTagPopularity();
  const totalUsers = Object.values(popularity).reduce((a, b) => Math.max(a, b), 1);

  let rawScore = 0;
  let maxPossible = 0;

  // What's the max score if ALL of my interests were shared?
  for (const tag of myInterests) {
    const pop = popularity[tag] || 1;
    const weight = 1 / Math.log2(pop + 2);
    maxPossible += weight;
  }

  // Actual score for shared interests
  const sharedTags = myInterests.filter(t => theirInterests.includes(t));
  for (const tag of sharedTags) {
    const pop = popularity[tag] || 1;
    const weight = 1 / Math.log2(pop + 2);
    rawScore += weight;
  }

  // Bonus: if they have interests I don't have but are rare, slight bonus
  // (shows they're a unique/interesting person)
  const uniqueRareTags = theirInterests.filter(t => !myInterests.includes(t));
  for (const tag of uniqueRareTags) {
    const pop = popularity[tag] || 1;
    if (pop <= 3) { // Very rare tag (≤3 users have it)
      rawScore += 0.1 / Math.log2(pop + 2);
    }
  }

  if (maxPossible === 0) return 0;

  // Normalize to 0–100, with diminishing returns above 4 shared interests
  const ratio = rawScore / maxPossible;
  return Math.min(100, Math.round(ratio * 100));
}


// ═══════════════════════════════════════════════
// ██  SIGNAL 2: BEHAVIORAL LEARNING (30% wt)   ██
// ═══════════════════════════════════════════════

/**
 * Compute behavioral score (0–100) based on the user's past swipe patterns.
 *
 * Tracks which interest tags the user tends to like/pass on,
 * then checks how well the candidate matches those preferences.
 */
async function computeBehavioralScore(userId, candidateInterests) {
  if (!Array.isArray(candidateInterests) || candidateInterests.length === 0) return 50; // neutral

  try {
    const { rows: prefs } = await db.query(
      `SELECT tag, likes, total FROM swipe_preferences WHERE user_id = $1`,
      [userId]
    );

    if (prefs.length === 0) return 50; // No history yet — neutral score

    // Build affinity map: tag → like_ratio (0.0 to 1.0)
    const affinity = {};
    for (const row of prefs) {
      if (row.total > 0) {
        affinity[row.tag] = row.likes / row.total;
      }
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const tag of candidateInterests) {
      if (affinity[tag] !== undefined) {
        // Weight by confidence (more swipes = more weight)
        const pref = prefs.find(p => p.tag === tag);
        const confidence = Math.min(pref.total / 10, 1); // Max confidence at 10 swipes
        const weight = confidence;
        weightedSum += affinity[tag] * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 50; // No relevant data

    const avgAffinity = weightedSum / totalWeight;
    return Math.round(avgAffinity * 100);
  } catch (err) {
    console.error('❌  computeBehavioralScore error:', err.message);
    return 50;
  }
}

/**
 * Update swipe preferences after a user swipes.
 * Tracks tag-level like/pass ratios for behavioral learning.
 */
async function updateSwipePreferences(userId, candidateInterests, action) {
  if (!Array.isArray(candidateInterests) || candidateInterests.length === 0) return;

  const isLike = action === 'like' ? 1 : 0;

  for (const tag of candidateInterests) {
    try {
      await db.query(
        `INSERT INTO swipe_preferences (user_id, tag, likes, total)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, tag) DO UPDATE SET
           likes = swipe_preferences.likes + $3,
           total = swipe_preferences.total + 1`,
        [userId, tag, isLike]
      );
    } catch (err) {
      // Non-critical — don't break the swipe flow
      console.error('❌  updateSwipePreferences error:', err.message);
    }
  }
}


// ═══════════════════════════════════════════════
// ██  SIGNAL 3: FRESHNESS & FAIRNESS (25% wt)  ██
// ═══════════════════════════════════════════════

/**
 * Compute freshness/fairness score (0–100).
 *
 * Components:
 * - Recency:         Active users score higher
 * - Anti-popularity: Overly popular profiles get dampened
 * - New user boost:  New accounts get temporary visibility boost
 */
async function computeFreshnessScore(candidateUserId) {
  try {
    // Get user data
    const { rows } = await db.query(
      `SELECT u.created_at, u.last_active,
              (SELECT COUNT(*) FROM swipes WHERE swiped_id = $1 AND action = 'like') AS likes_received,
              (SELECT COUNT(*) FROM swipes WHERE swiped_id = $1) AS total_swipes_received
       FROM users u WHERE u.id = $1`,
      [candidateUserId]
    );

    if (rows.length === 0) return 50;

    const user = rows[0];
    const now = Date.now();

    // ── Recency (0–40 points) ──
    let recencyScore = 20; // default
    if (user.last_active) {
      const lastActive = new Date(user.last_active).getTime();
      const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);

      if (hoursSinceActive < 1) recencyScore = 40;        // Online now
      else if (hoursSinceActive < 24) recencyScore = 35;   // Active today
      else if (hoursSinceActive < 72) recencyScore = 25;   // Active this week
      else if (hoursSinceActive < 168) recencyScore = 15;  // Within a week
      else recencyScore = 5;                                // Inactive
    }

    // ── Anti-popularity damper (0–30 points) ──
    // If everyone already likes this person, they don't need algorithmic help
    let fairnessScore = 30; // default (fair)
    if (user.total_swipes_received > 5) {
      const likeRatio = user.likes_received / user.total_swipes_received;
      if (likeRatio > 0.8) fairnessScore = 10;       // Very popular → less boost
      else if (likeRatio > 0.6) fairnessScore = 20;  // Popular → moderate
      else fairnessScore = 30;                        // Normal → full boost
    }

    // ── New user boost (0–30 points) ──
    let newUserScore = 0;
    if (user.created_at) {
      const createdAt = new Date(user.created_at).getTime();
      const daysSinceCreated = (now - createdAt) / (1000 * 60 * 60 * 24);

      if (daysSinceCreated < 2) newUserScore = 30;       // Brand new
      else if (daysSinceCreated < 7) newUserScore = 20;  // First week
      else if (daysSinceCreated < 14) newUserScore = 10; // Second week
      else newUserScore = 0;                              // Established
    }

    return Math.min(100, recencyScore + fairnessScore + newUserScore);
  } catch (err) {
    console.error('❌  computeFreshnessScore error:', err.message);
    return 50;
  }
}


// ═══════════════════════════════════════════════
// ██  COMBINED SCORE                            ██
// ═══════════════════════════════════════════════

const WEIGHT_INTEREST = 0.45;
const WEIGHT_BEHAVIORAL = 0.30;
const WEIGHT_FRESHNESS = 0.25;

/**
 * Compute the full compatibility score (0–100) between the current user
 * and a candidate profile.
 *
 * @returns {{ score: number, breakdown: { interest, behavioral, freshness } }}
 */
async function computeCompatibilityScore(userId, myInterests, candidateProfile) {
  let candidateInterests = [];
  try {
    candidateInterests = typeof candidateProfile.interests === 'string'
      ? JSON.parse(candidateProfile.interests)
      : candidateProfile.interests || [];
  } catch {
    candidateInterests = [];
  }

  const candidateUserId = candidateProfile.user_id || candidateProfile.id;

  // Compute all 3 signals in parallel
  const [interestScore, behavioralScore, freshnessScore] = await Promise.all([
    computeInterestScore(myInterests, candidateInterests),
    computeBehavioralScore(userId, candidateInterests),
    computeFreshnessScore(candidateUserId),
  ]);

  const totalScore = Math.round(
    WEIGHT_INTEREST * interestScore +
    WEIGHT_BEHAVIORAL * behavioralScore +
    WEIGHT_FRESHNESS * freshnessScore
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown: {
      interest: interestScore,
      behavioral: behavioralScore,
      freshness: freshnessScore,
    },
  };
}

module.exports = {
  computeCompatibilityScore,
  computeInterestScore,
  computeBehavioralScore,
  computeFreshnessScore,
  updateSwipePreferences,
  refreshTagPopularity,
};
