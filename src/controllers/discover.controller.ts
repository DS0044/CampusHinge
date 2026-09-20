import { Request, Response, NextFunction } from 'express';
import db from '../config/db';
import { AppError } from '../middleware/errorHandler';
import {
  computeCompatibilityScore,
  scoreCandidateForIntent,
  canSuperLike,
  parseJsonArray,
  refreshTagPopularity,
} from '../services/scoring.service';
import { areCoursesCompatible, IntentType, INTENTS } from '../constants/intent.constants';

const MIN_FALLBACK_COUNT = 5;

/**
 * GET /api/discover
 * Returns a deck of profiles ranked by intent-specific compatibility.
 */
export async function getDiscoverDeck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);

    // Update last_active for current user
    db.query(`UPDATE users SET last_active = datetime('now') WHERE id = $1`, [userId]).catch(() => {});

    // 1. Get current user's profile and active intent
    const { rows: userRows } = await db.query<{ active_intent?: string }>(
      `SELECT active_intent FROM users WHERE id = $1`,
      [userId]
    );

    const queryIntent = req.query.intent as string | undefined;
    const userIntent = userRows[0]?.active_intent || 'dating';
    const activeIntent: IntentType = (
      queryIntent && INTENTS.includes(queryIntent as IntentType)
        ? queryIntent
        : (INTENTS.includes(userIntent as IntentType) ? userIntent : 'dating')
    ) as IntentType;

    const { rows: myProfileRows } = await db.query<{
      gender: string;
      interested_in: string;
      interests: string | string[];
      activity_tags?: string | string[];
      branch?: string | null;
      year?: number | null;
    }>(
      `SELECT gender, interested_in, interests, activity_tags, branch, year FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (myProfileRows.length === 0) {
      throw new AppError('Please create a profile before discovering others.', 400);
    }

    const myProfile = myProfileRows[0];
    const myGender = myProfile.gender;
    const myInterestedIn = myProfile.interested_in;
    const myInterests = parseJsonArray(myProfile.interests);
    const myActivityTags = parseJsonArray(myProfile.activity_tags);
    const myBranch = myProfile.branch || '';
    const myYear = myProfile.year || null;

    // 2. Build intent-aware filters
    let intentSqlFilter = '';
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (activeIntent === 'dating') {
      intentSqlFilter += ` AND (u.active_intent = 'dating' OR u.active_intent IS NULL)`;
      if (myInterestedIn !== 'everyone') {
        intentSqlFilter += ` AND p.gender = $${paramIndex}`;
        params.push(myInterestedIn);
        paramIndex++;
      }
      intentSqlFilter += ` AND (p.interested_in = $${paramIndex} OR p.interested_in = 'everyone')`;
      params.push(myGender);
      paramIndex++;
    } else {
      // Friendship, Study, Activity, Networking
      intentSqlFilter += ` AND u.active_intent = $${paramIndex}`;
      params.push(activeIntent);
      paramIndex++;
    }

    // 3. Fetch candidate pool matching primary criteria
    const poolSize = Math.min(limit * 5, 100);
    const poolParamIdx = paramIndex;
    params.push(poolSize);

    const baseExclusions = `
      p.user_id != $1
      AND u.is_banned = 0
      AND u.email_verified = 1
      -- Exclude already liked
      AND p.user_id NOT IN (
        SELECT swiped_id FROM swipes WHERE swiper_id = $1 AND action IN ('like', 'super_like')
      )
      -- Exclude matched profiles
      AND p.user_id NOT IN (
        SELECT user2_id FROM matches WHERE user1_id = $1
        UNION
        SELECT user1_id FROM matches WHERE user2_id = $1
      )
      -- Exclude blocked
      AND p.user_id NOT IN (
        SELECT blocked_id FROM blocks WHERE blocker_id = $1
        UNION
        SELECT blocker_id FROM blocks WHERE blocked_id = $1
      )
    `;

    const { rows: initialCandidates } = await db.query<{
      user_id: string;
      name: string;
      bio?: string | null;
      photos: string | string[];
      year?: number | null;
      gender: string;
      interested_in: string;
      interests: string | string[];
      activity_tags?: string | string[];
      branch?: string | null;
      active_intent?: string;
      is_looped?: number;
    }>(
      `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender,
              p.interested_in, p.interests, p.activity_tags, p.branch,
              u.active_intent,
              CASE
                WHEN p.user_id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1) THEN 0
                ELSE 1
              END AS is_looped
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE ${baseExclusions}
         ${intentSqlFilter}
       ORDER BY is_looped ASC, RANDOM()
       LIMIT $${poolParamIdx}`,
      params
    );

    // 4. Intent-specific post-filtering (Study course compatibility & Activity tag overlap)
    let primaryCandidates = initialCandidates;
    if (activeIntent === 'study') {
      // Hard filter: same course or compatible course
      primaryCandidates = initialCandidates.filter((c) =>
        areCoursesCompatible(myBranch, c.branch)
      );
    } else if (activeIntent === 'activity') {
      // Hard filter: at least 1 shared activity tag
      primaryCandidates = initialCandidates.filter((c) => {
        const cActivity = parseJsonArray(c.activity_tags);
        return myActivityTags.some((tag) => cActivity.includes(tag));
      });
    }

    // 5. Fallback rule for all non-dating intents:
    // If hard-filtered results are fewer than MIN_FALLBACK_COUNT, soft-include same-intent-adjacent profiles ranked lower
    const finalCandidatesMap = new Map<string, typeof initialCandidates[0] & { is_fallback?: boolean }>();
    for (const c of primaryCandidates) {
      finalCandidatesMap.set(c.user_id, { ...c, is_fallback: false });
    }

    if (activeIntent !== 'dating' && finalCandidatesMap.size < MIN_FALLBACK_COUNT) {
      // First soft-fallback: include candidate pool from same intent that didn't pass strict filter
      for (const c of initialCandidates) {
        if (!finalCandidatesMap.has(c.user_id)) {
          finalCandidatesMap.set(c.user_id, { ...c, is_fallback: true });
          if (finalCandidatesMap.size >= MIN_FALLBACK_COUNT) break;
        }
      }

      // Second soft-fallback: if still fewer than MIN_FALLBACK_COUNT, include other active campus students
      if (finalCandidatesMap.size < MIN_FALLBACK_COUNT) {
        const existingIds = Array.from(finalCandidatesMap.keys()).concat([userId]);
        const { rows: fallbackUsers } = await db.query<typeof initialCandidates[0]>(
          `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender,
                  p.interested_in, p.interests, p.activity_tags, p.branch,
                  u.active_intent,
                  CASE
                    WHEN p.user_id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1) THEN 0
                    ELSE 1
                  END AS is_looped
           FROM profiles p
           JOIN users u ON u.id = p.user_id
           WHERE ${baseExclusions}
             AND p.user_id NOT IN (${existingIds.map((_, i) => `$${i + 2}`).join(',')})
           ORDER BY is_looped ASC, RANDOM()
           LIMIT $${existingIds.length + 2}`,
          [userId, ...existingIds, MIN_FALLBACK_COUNT - finalCandidatesMap.size]
        );

        for (const fb of fallbackUsers) {
          finalCandidatesMap.set(fb.user_id, { ...fb, is_fallback: true });
          if (finalCandidatesMap.size >= MIN_FALLBACK_COUNT) break;
        }
      }
    }

    const candidateList = Array.from(finalCandidatesMap.values());

    // 6. Score each candidate using unified scoring engine
    const scoredProfiles = await Promise.all(
      candidateList.map(async (candidate) => {
        const photos = parseJsonArray(candidate.photos);
        const interests = parseJsonArray(candidate.interests);
        const activityTags = parseJsonArray(candidate.activity_tags);

        const sharedInterests = myInterests.filter((tag) => interests.includes(tag));
        const sharedActivity = myActivityTags.filter((tag) => activityTags.includes(tag));

        // Base 3-signal compatibility score (interest overlap, behavioral learning, freshness)
        const { score: baseCompatScore, breakdown } = await computeCompatibilityScore(
          userId,
          myInterests,
          candidate
        );

        // Intent-specific score calculation
        let intentScore = scoreCandidateForIntent(
          activeIntent,
          { interests: myInterests, activity_tags: myActivityTags, branch: myBranch, year: myYear },
          {
            interests,
            activity_tags: activityTags,
            branch: candidate.branch,
            year: candidate.year,
            compatibility_score: baseCompatScore,
          }
        );

        // Fallback penalty so hard-filtered candidates always outrank soft-included candidates
        if (candidate.is_fallback) {
          intentScore = Math.max(1, intentScore - 40);
        }

        // Check intent-specific Super Like eligibility
        const superLikeGate = canSuperLike(
          activeIntent,
          { interests: myInterests, activity_tags: myActivityTags, branch: myBranch, year: myYear },
          {
            interests,
            activity_tags: activityTags,
            branch: candidate.branch,
            year: candidate.year,
          }
        );

        return {
          id: candidate.user_id,
          user_id: candidate.user_id,
          name: candidate.name,
          bio: candidate.bio,
          year: candidate.year,
          gender: candidate.gender,
          branch: candidate.branch,
          photos,
          interests,
          activity_tags: activityTags,
          active_intent: candidate.active_intent || 'dating',
          shared_interests: sharedInterests,
          shared_count: sharedInterests.length,
          shared_interests_count: sharedInterests.length,
          shared_activity_tags: sharedActivity,
          shared_activity_count: sharedActivity.length,
          compatibility_score: activeIntent === 'dating' ? baseCompatScore : intentScore,
          compatibility_breakdown: breakdown,
          intent_score: intentScore,
          is_fallback: Boolean(candidate.is_fallback),
          can_super_like: superLikeGate.allowed,
          super_like_reason: superLikeGate.reason,
          is_looped: candidate.is_looped || 0,
        };
      })
    );

    // 7. Sort: unswiped candidates first, non-fallback candidates first, then by score descending
    scoredProfiles.sort((a, b) => {
      if (a.is_looped !== b.is_looped) {
        return (a.is_looped || 0) - (b.is_looped || 0);
      }
      if (a.is_fallback !== b.is_fallback) {
        return a.is_fallback ? 1 : -1;
      }
      return b.compatibility_score - a.compatibility_score;
    });

    const topProfiles = scoredProfiles.slice(0, limit);

    // 8. Refresh tag popularity in background
    refreshTagPopularity().catch(() => {});

    // 9. Check viewer's super like 24-hour limit status
    const { rows: viewerUser } = await db.query<{ last_super_like_at: string | null }>(
      `SELECT last_super_like_at FROM users WHERE id = $1`,
      [userId]
    );
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

    res.status(200).json({
      success: true,
      data: {
        active_intent: activeIntent,
        profiles: topProfiles,
        count: topProfiles.length,
        super_like: {
          available: superLikeAvailable,
          next_available_in_seconds: nextSuperLikeInSeconds,
          last_super_like_at: lastSuperLikeAt || null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export default { getDiscoverDeck };
module.exports = { getDiscoverDeck };
