import { Request, Response, NextFunction } from 'express';
import db from '../config/db';
import { AppError } from '../middleware/errorHandler';
import {
  computeCompatibilityScore,
  refreshTagPopularity,
} from '../services/scoring.service';

/**
 * GET /api/discover
 * Returns a deck of profiles ranked by compatibility score.
 */
export async function getDiscoverDeck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);

    // Update last_active for the current user
    db.query(
      `UPDATE users SET last_active = datetime('now') WHERE id = $1`,
      [userId]
    ).catch(() => {});

    // 1. Get current user's profile
    const { rows: myProfile } = await db.query<{ gender: string; interested_in: string; interests: string | string[] }>(
      `SELECT gender, interested_in, interests FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (myProfile.length === 0) {
      throw new AppError('Please create a profile before discovering others.', 400);
    }

    const { gender: myGender, interested_in: myInterestedIn } = myProfile[0];
    let myInterests: string[] = [];
    try {
      myInterests = typeof myProfile[0].interests === 'string'
        ? JSON.parse(myProfile[0].interests)
        : myProfile[0].interests || [];
    } catch {
      myInterests = [];
    }

    // 2. Build gender filter — bidirectional compatibility
    let genderFilter = '';
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (myInterestedIn !== 'everyone') {
      genderFilter += ` AND p.gender = $${paramIndex}`;
      params.push(myInterestedIn);
      paramIndex++;
    }

    genderFilter += ` AND (p.interested_in = $${paramIndex} OR p.interested_in = 'everyone')`;
    params.push(myGender);
    paramIndex++;

    // 3. Fetch candidate pool
    const poolSize = Math.min(limit * 5, 100);
    const poolParamIdx = paramIndex;
    params.push(poolSize);

    const { rows: candidates } = await db.query<{
      user_id: string;
      name: string;
      bio?: string | null;
      photos: string | string[];
      year?: number | null;
      gender: string;
      interested_in: string;
      interests: string | string[];
      branch?: string | null;
      is_looped?: number;
    }>(
      `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender,
              p.interested_in, p.interests, p.branch,
              CASE
                WHEN p.user_id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1) THEN 0
                ELSE 1
              END AS is_looped
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1
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
         ${genderFilter}
       ORDER BY is_looped ASC, RANDOM()
       LIMIT $${poolParamIdx}`,
      params
    );

    // 4. Score each candidate using the 3-signal engine
    const scoredProfiles = await Promise.all(
      candidates.map(async (candidate) => {
        const { score, breakdown } = await computeCompatibilityScore(
          userId,
          myInterests,
          candidate
        );

        let photos: string[] = [];
        let interests: string[] = [];
        try { photos = typeof candidate.photos === 'string' ? JSON.parse(candidate.photos) : candidate.photos || []; } catch { photos = []; }
        try { interests = typeof candidate.interests === 'string' ? JSON.parse(candidate.interests) : candidate.interests || []; } catch { interests = []; }

        const sharedInterests = Array.isArray(interests) && Array.isArray(myInterests)
          ? interests.filter((tag) => myInterests.includes(tag))
          : [];

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
          shared_interests: sharedInterests,
          shared_count: sharedInterests.length,
          shared_interests_count: sharedInterests.length,
          compatibility_score: score,
          compatibility_breakdown: breakdown,
          is_looped: candidate.is_looped || 0,
        };
      })
    );

    // 5. Sort unswiped candidates first, then by compatibility score
    scoredProfiles.sort((a, b) => {
      if (a.is_looped !== b.is_looped) {
        return (a.is_looped || 0) - (b.is_looped || 0);
      }
      return b.compatibility_score - a.compatibility_score;
    });
    const topProfiles = scoredProfiles.slice(0, limit);

    // 6. Refresh tag popularity in background
    refreshTagPopularity().catch(() => {});

    // 7. Check viewer's super like 24-hour limit status
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
