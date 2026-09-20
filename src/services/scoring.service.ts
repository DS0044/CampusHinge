import db from '../config/db';

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
let popularityCache: Record<string, number> | null = null;
let popularityCacheAt = 0;
const POPULARITY_TTL = 10 * 60 * 1000;

/**
 * Get tag popularity map: tag → number of users who have that tag.
 * Used to weight rare interests higher.
 */
export async function getTagPopularity(): Promise<Record<string, number>> {
  if (popularityCache && Date.now() - popularityCacheAt < POPULARITY_TTL) {
    return popularityCache;
  }

  try {
    const { rows } = await db.query<{ tag: string; user_count: number }>(
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
export async function refreshTagPopularity(): Promise<void> {
  try {
    const { rows } = await db.query<{ interests: string | string[] }>(`SELECT interests FROM profiles`, []);
    const tagCounts: Record<string, number> = {};

    for (const row of rows) {
      let interests: string[] = [];
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
  } catch (err: any) {
    console.error('❌  refreshTagPopularity error:', err.message);
  }
}

// ═══════════════════════════════════════════════
// ██  SIGNAL 1: INTEREST OVERLAP (45% weight)  ██
// ═══════════════════════════════════════════════

export async function computeInterestScore(
  myInterests: string[],
  theirInterests: string[]
): Promise<number> {
  if (!Array.isArray(myInterests) || !Array.isArray(theirInterests)) return 0;
  if (myInterests.length === 0 || theirInterests.length === 0) return 0;

  const popularity = await getTagPopularity();

  let rawScore = 0;
  let maxPossible = 0;

  // What's the max score if ALL of my interests were shared?
  for (const tag of myInterests) {
    const pop = popularity[tag] || 1;
    const weight = 1 / Math.log2(pop + 2);
    maxPossible += weight;
  }

  // Actual score for shared interests
  const sharedTags = myInterests.filter((t) => theirInterests.includes(t));
  for (const tag of sharedTags) {
    const pop = popularity[tag] || 1;
    const weight = 1 / Math.log2(pop + 2);
    rawScore += weight;
  }

  // Bonus: if they have interests I don't have but are rare, slight bonus
  const uniqueRareTags = theirInterests.filter((t) => !myInterests.includes(t));
  for (const tag of uniqueRareTags) {
    const pop = popularity[tag] || 1;
    if (pop <= 3) {
      rawScore += 0.1 / Math.log2(pop + 2);
    }
  }

  if (maxPossible === 0) return 0;

  // Normalize to 0–100
  const ratio = rawScore / maxPossible;
  return Math.min(100, Math.round(ratio * 100));
}

// ═══════════════════════════════════════════════
// ██  SIGNAL 2: BEHAVIORAL LEARNING (30% wt)   ██
// ═══════════════════════════════════════════════

export async function computeBehavioralScore(
  userId: string,
  candidateInterests: string[]
): Promise<number> {
  if (!Array.isArray(candidateInterests) || candidateInterests.length === 0) return 50; // neutral

  try {
    const { rows: prefs } = await db.query<{ tag: string; likes: number; total: number }>(
      `SELECT tag, likes, total FROM swipe_preferences WHERE user_id = $1`,
      [userId]
    );

    if (prefs.length === 0) return 50; // No history yet — neutral score

    // Build affinity map: tag → like_ratio (0.0 to 1.0)
    const affinity: Record<string, number> = {};
    for (const row of prefs) {
      if (row.total > 0) {
        affinity[row.tag] = row.likes / row.total;
      }
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const tag of candidateInterests) {
      if (affinity[tag] !== undefined) {
        const pref = prefs.find((p) => p.tag === tag);
        const confidence = Math.min((pref?.total || 1) / 10, 1);
        const weight = confidence;
        weightedSum += affinity[tag] * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 50;

    const avgAffinity = weightedSum / totalWeight;
    return Math.round(avgAffinity * 100);
  } catch (err: any) {
    console.error('❌  computeBehavioralScore error:', err.message);
    return 50;
  }
}

export async function updateSwipePreferences(
  userId: string,
  candidateInterests: string[],
  action: string
): Promise<void> {
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
    } catch (err: any) {
      console.error('❌  updateSwipePreferences error:', err.message);
    }
  }
}

// ═══════════════════════════════════════════════
// ██  SIGNAL 3: FRESHNESS & FAIRNESS (25% wt)  ██
// ═══════════════════════════════════════════════

export async function computeFreshnessScore(candidateUserId: string): Promise<number> {
  try {
    const { rows } = await db.query<{
      created_at: string;
      last_active: string | null;
      likes_received: number;
      total_swipes_received: number;
    }>(
      `SELECT u.created_at, u.last_active,
              (SELECT COUNT(*) FROM swipes WHERE swiped_id = $1 AND action = 'like') AS likes_received,
              (SELECT COUNT(*) FROM swipes WHERE swiped_id = $1) AS total_swipes_received
       FROM users u WHERE u.id = $1`,
      [candidateUserId]
    );

    if (rows.length === 0) return 50;

    const user = rows[0];
    const now = Date.now();

    // Recency (0–40 points)
    let recencyScore = 20;
    if (user.last_active) {
      const lastActive = new Date(user.last_active).getTime();
      const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);

      if (hoursSinceActive < 1) recencyScore = 40;
      else if (hoursSinceActive < 24) recencyScore = 35;
      else if (hoursSinceActive < 72) recencyScore = 25;
      else if (hoursSinceActive < 168) recencyScore = 15;
      else recencyScore = 5;
    }

    // Anti-popularity damper (0–30 points)
    let fairnessScore = 30;
    if (user.total_swipes_received > 5) {
      const likeRatio = user.likes_received / user.total_swipes_received;
      if (likeRatio > 0.8) fairnessScore = 10;
      else if (likeRatio > 0.6) fairnessScore = 20;
      else fairnessScore = 30;
    }

    // New user boost (0–30 points)
    let newUserScore = 0;
    if (user.created_at) {
      const createdAt = new Date(user.created_at).getTime();
      const daysSinceCreated = (now - createdAt) / (1000 * 60 * 60 * 24);

      if (daysSinceCreated < 2) newUserScore = 30;
      else if (daysSinceCreated < 7) newUserScore = 20;
      else if (daysSinceCreated < 14) newUserScore = 10;
      else newUserScore = 0;
    }

    return Math.min(100, recencyScore + fairnessScore + newUserScore);
  } catch (err: any) {
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

export interface ScoreBreakdown {
  interest: number;
  behavioral: number;
  freshness: number;
}

export interface CompatibilityResult {
  score: number;
  breakdown: ScoreBreakdown;
}

export async function computeCompatibilityScore(
  userId: string,
  myInterests: string[],
  candidateProfile: { interests?: string | string[]; user_id?: string; id?: string; [key: string]: any }
): Promise<CompatibilityResult> {
  let candidateInterests: string[] = [];
  try {
    candidateInterests = typeof candidateProfile.interests === 'string'
      ? JSON.parse(candidateProfile.interests)
      : candidateProfile.interests || [];
  } catch {
    candidateInterests = [];
  }

  const candidateUserId = (candidateProfile.user_id || candidateProfile.id) as string;

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

export default {
  computeCompatibilityScore,
  computeInterestScore,
  computeBehavioralScore,
  computeFreshnessScore,
  updateSwipePreferences,
  refreshTagPopularity,
};
module.exports = {
  computeCompatibilityScore,
  computeInterestScore,
  computeBehavioralScore,
  computeFreshnessScore,
  updateSwipePreferences,
  refreshTagPopularity,
};
