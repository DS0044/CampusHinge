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
import {
  areCoursesCompatible,
  CAREER_INTERESTS,
  type IntentType,
} from '../constants/intent.constants.js';
import type {
  CompatibilityResult,
  InterestPopularityRow,
  SuperLikeGate,
  SwipePreferenceRow,
} from '../types.js';

// ── Shared profile shape used by scoring functions ──

interface ScoringProfile {
  interests?: unknown;
  activity_tags?: unknown;
  branch?: string | null;
  year?: number | string | null;
  user_id?: string;
  id?: string;
  compatibility_score?: number;
}

// ═══════════════════════════════════════════════
// SIGNAL 1: INTEREST OVERLAP (45%)
// ═══════════════════════════════════════════════

async function getTagPopularity(db: D1Database): Promise<Record<string, number>> {
  try {
    const { rows } = await query<InterestPopularityRow>(
      db,
      'SELECT tag, user_count FROM interest_popularity',
      []
    );
    const map: Record<string, number> = {};
    for (const row of rows) map[row.tag] = row.user_count;
    return map;
  } catch {
    return {};
  }
}

export async function computeInterestScore(
  db: D1Database,
  myInterests: string[],
  theirInterests: string[]
): Promise<number> {
  if (!Array.isArray(myInterests) || !Array.isArray(theirInterests)) return 0;
  if (myInterests.length === 0 || theirInterests.length === 0) return 0;

  const popularity = await getTagPopularity(db);

  let rawScore = 0;
  let maxPossible = 0;

  for (const tag of myInterests) {
    const pop = popularity[tag] ?? 1;
    maxPossible += 1 / Math.log2(pop + 2);
  }

  const sharedTags = myInterests.filter((t) => theirInterests.includes(t));
  for (const tag of sharedTags) {
    const pop = popularity[tag] ?? 1;
    rawScore += 1 / Math.log2(pop + 2);
  }

  // Small bonus for rare unique tags
  const uniqueRare = theirInterests.filter((t) => !myInterests.includes(t));
  for (const tag of uniqueRare) {
    const pop = popularity[tag] ?? 1;
    if (pop <= 3) rawScore += 0.1 / Math.log2(pop + 2);
  }

  if (maxPossible === 0) return 0;
  return Math.min(100, Math.round((rawScore / maxPossible) * 100));
}

// ═══════════════════════════════════════════════
// SIGNAL 2: BEHAVIORAL LEARNING (30%)
// ═══════════════════════════════════════════════

export async function computeBehavioralScore(
  db: D1Database,
  userId: string,
  candidateInterests: string[]
): Promise<number> {
  if (!Array.isArray(candidateInterests) || candidateInterests.length === 0) return 50;

  try {
    const { rows: prefs } = await query<SwipePreferenceRow>(
      db,
      'SELECT tag, likes, total FROM swipe_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefs.length === 0) return 50; // No history — neutral

    const affinity: Record<string, number> = {};
    for (const row of prefs) {
      if (row.total > 0) affinity[row.tag] = row.likes / row.total;
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const tag of candidateInterests) {
      if (affinity[tag] !== undefined) {
        const pref = prefs.find((p) => p.tag === tag);
        const confidence = Math.min((pref?.total ?? 1) / 10, 1);
        weightedSum += (affinity[tag] ?? 0) * confidence;
        totalWeight += confidence;
      }
    }

    if (totalWeight === 0) return 50;
    return Math.round((weightedSum / totalWeight) * 100);
  } catch {
    return 50;
  }
}

export async function updateSwipePreferences(
  db: D1Database,
  userId: string,
  candidateInterests: string[],
  action: string
): Promise<void> {
  if (!Array.isArray(candidateInterests) || candidateInterests.length === 0) return;
  const isLike = action === 'like' ? 1 : 0;

  for (const tag of candidateInterests) {
    try {
      await query(
        db,
        `INSERT INTO swipe_preferences (user_id, tag, likes, total)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, tag) DO UPDATE SET
           likes = swipe_preferences.likes + $3,
           total = swipe_preferences.total + 1`,
        [userId, tag, isLike]
      );
    } catch {
      /* non-critical */
    }
  }
}

// ═══════════════════════════════════════════════
// SIGNAL 3: FRESHNESS & FAIRNESS (25%)
// ═══════════════════════════════════════════════

interface FreshnessRow {
  created_at: string | null;
  last_active: string | null;
  likes_received: number;
  total_swipes_received: number;
}

export async function computeFreshnessScore(
  db: D1Database,
  candidateUserId: string
): Promise<number> {
  try {
    const { rows } = await query<FreshnessRow>(
      db,
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
      const h = (now - new Date(user.last_active).getTime()) / 3_600_000;
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
      const days = (now - new Date(user.created_at).getTime()) / 86_400_000;
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

export async function computeCompatibilityScore(
  db: D1Database,
  userId: string,
  myInterests: string[],
  candidateProfile: ScoringProfile
): Promise<CompatibilityResult> {
  let candidateInterests: string[] = [];
  try {
    candidateInterests =
      typeof candidateProfile.interests === 'string'
        ? (JSON.parse(candidateProfile.interests) as string[])
        : Array.isArray(candidateProfile.interests)
        ? candidateProfile.interests
        : [];
  } catch {
    candidateInterests = [];
  }

  const candidateUserId = (candidateProfile.user_id ?? candidateProfile.id) as string;

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

export async function refreshTagPopularity(db: D1Database): Promise<void> {
  try {
    const { rows } = await query<{ interests: string | string[] | null }>(
      db,
      'SELECT interests FROM profiles',
      []
    );
    const tagCounts: Record<string, number> = {};

    for (const row of rows) {
      let interests: string[] = [];
      try {
        interests =
          typeof row.interests === 'string'
            ? (JSON.parse(row.interests) as string[])
            : Array.isArray(row.interests)
            ? row.interests
            : [];
      } catch {
        continue;
      }
      if (!Array.isArray(interests)) continue;
      for (const tag of interests) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }

    for (const [tag, count] of Object.entries(tagCounts)) {
      await query(
        db,
        `INSERT INTO interest_popularity (tag, user_count, updated_at)
         VALUES ($1, $2, datetime('now'))
         ON CONFLICT (tag) DO UPDATE SET user_count = $2, updated_at = datetime('now')`,
        [tag, count]
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('refreshTagPopularity error:', msg);
  }
}

// ─────────────────────────────────────────────

export function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Validates whether a user can send a Super Like under the active intent.
 */
export function canSuperLike(
  intent: string,
  swiperProfile: ScoringProfile,
  swipedProfile: ScoringProfile
): SuperLikeGate {
  const swiperInterests = parseJsonArray(swiperProfile.interests);
  const swipedInterests = parseJsonArray(swipedProfile.interests);
  const sharedInterests = swiperInterests.filter((t) => swipedInterests.includes(t));

  const swiperActivity = parseJsonArray(swiperProfile.activity_tags);
  const swipedActivity = parseJsonArray(swipedProfile.activity_tags);
  const sharedActivity = swiperActivity.filter((t) => swipedActivity.includes(t));

  switch (intent as IntentType) {
    case 'friendship':
    case 'dating': {
      const allowed = sharedInterests.length >= 4;
      return {
        allowed,
        sharedCount: sharedInterests.length,
        reason: allowed
          ? undefined
          : 'Super Like is only unlocked when you share 4 or more interests.',
      };
    }

    case 'study': {
      const branchA = (swiperProfile.branch ?? '').trim();
      const branchB = (swipedProfile.branch ?? '').trim();
      const compatibleCourse = areCoursesCompatible(branchA, branchB);

      const yearA = swiperProfile.year ? Number(swiperProfile.year) : null;
      const yearB = swipedProfile.year ? Number(swipedProfile.year) : null;
      const adjacentYear = yearA && yearB ? Math.abs(yearA - yearB) <= 1 : true;

      const allowed = compatibleCourse && adjacentYear;
      return {
        allowed,
        reason: allowed
          ? undefined
          : 'Study Partner Super Like is only unlocked for students with the same/compatible course and same or adjacent graduation year.',
      };
    }

    case 'activity': {
      const allowed = sharedActivity.length >= 2;
      return {
        allowed,
        sharedCount: sharedActivity.length,
        reason: allowed
          ? undefined
          : 'Activity Super Like is only unlocked when you share 2 or more activity tags.',
      };
    }

    case 'networking': {
      const branchA = (swiperProfile.branch ?? '').trim();
      const branchB = (swipedProfile.branch ?? '').trim();
      const isDifferentBranch = Boolean(
        branchA && branchB && branchA.toLowerCase() !== branchB.toLowerCase()
      );

      const sharedCareer = sharedInterests.filter((t) =>
        CAREER_INTERESTS.some((c) => c.toLowerCase() === t.toLowerCase())
      );

      const allowed = isDifferentBranch || sharedCareer.length >= 1;
      return {
        allowed,
        sharedCount: sharedCareer.length,
        reason: allowed
          ? undefined
          : 'Networking Super Like is unlocked for cross-branch connections or shared career-oriented interests.',
      };
    }

    default: {
      const allowed = sharedInterests.length >= 4;
      return {
        allowed,
        sharedCount: sharedInterests.length,
        reason: allowed
          ? undefined
          : 'Super Like is only unlocked when you share 4 or more interests.',
      };
    }
  }
}

/**
 * Intent-aware ranking score computation.
 * Friendship and Networking also consider shared activity_tags (synced with Node.js backend).
 */
export function scoreCandidateForIntent(
  intent: string,
  myProfile: ScoringProfile,
  candidate: ScoringProfile
): number {
  const myInterests = parseJsonArray(myProfile.interests);
  const theirInterests = parseJsonArray(candidate.interests);
  const sharedInterests = myInterests.filter((t) => theirInterests.includes(t));

  const myYear = myProfile.year ? Number(myProfile.year) : null;
  const theirYear = candidate.year ? Number(candidate.year) : null;
  const yearDiff = myYear && theirYear ? Math.abs(myYear - theirYear) : 4;
  const yearProximityScore = Math.max(0, 10 - yearDiff) * 10; // 0–100

  const myBranch = (myProfile.branch ?? '').trim();
  const theirBranch = (candidate.branch ?? '').trim();

  switch (intent as IntentType) {
    case 'friendship': {
      // Shared interests (primary) + shared activity tags (secondary) + year proximity
      const myActivity = parseJsonArray(myProfile.activity_tags);
      const theirActivity = parseJsonArray(candidate.activity_tags);
      const sharedActivity = myActivity.filter((t) => theirActivity.includes(t));
      const interestPts = sharedInterests.length * 20;
      const activityPts = sharedActivity.length * 15;
      const yearPts = Math.round(yearProximityScore * 0.4);
      return interestPts + activityPts + yearPts;
    }

    case 'study': {
      const courseBonus = areCoursesCompatible(myBranch, theirBranch) ? 40 : 0;
      const yearPts = Math.round(yearProximityScore * 0.5);
      const interestPts = sharedInterests.length * 5;
      return courseBonus + yearPts + interestPts;
    }

    case 'activity': {
      const myActivity = parseJsonArray(myProfile.activity_tags);
      const theirActivity = parseJsonArray(candidate.activity_tags);
      const sharedActivity = myActivity.filter((t) => theirActivity.includes(t));
      const activityPts = sharedActivity.length * 30;
      const interestPts = sharedInterests.length * 3;
      return activityPts + interestPts;
    }

    case 'networking': {
      let diversityPts = 20;
      if (myBranch && theirBranch) {
        diversityPts = myBranch.toLowerCase() !== theirBranch.toLowerCase() ? 50 : 15;
      }
      const sharedCareer = sharedInterests.filter((t) =>
        CAREER_INTERESTS.some((c) => c.toLowerCase() === t.toLowerCase())
      );
      const myNetActivity = parseJsonArray(myProfile.activity_tags);
      const theirNetActivity = parseJsonArray(candidate.activity_tags);
      const sharedNetActivity = myNetActivity.filter((t) => theirNetActivity.includes(t));
      const careerPts = sharedCareer.length * 25;
      const generalInterestPts = sharedInterests.length * 2;
      const activityBonus = sharedNetActivity.length * 10;
      return diversityPts + careerPts + generalInterestPts + activityBonus;
    }

    case 'dating':
    default: {
      return candidate.compatibility_score ?? sharedInterests.length * 10;
    }
  }
}
