const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const {
  computeCompatibilityScore,
  refreshTagPopularity,
} = require('../services/scoring.service');

/**
 * GET /api/discover
 * Returns a deck of profiles ranked by compatibility score.
 *
 * The scoring engine uses 3 signals:
 * 1. Interest overlap (rarity-weighted) — 45%
 * 2. Behavioral learning (swipe pattern affinity) — 30%
 * 3. Freshness & fairness (recency, anti-popularity, new-user boost) — 25%
 *
 * Hard filters (must pass before scoring):
 * - Gender/interested_in compatibility (bidirectional)
 * - Exclude self, already-swiped, blocked, banned
 *
 * Query params: ?limit=10 (default 10, max 50)
 */
async function getDiscoverDeck(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    // Update last_active for the current user
    db.query(
      `UPDATE users SET last_active = datetime('now') WHERE id = $1`,
      [userId]
    ).catch(() => {});

    // 1. Get current user's profile
    const { rows: myProfile } = await db.query(
      `SELECT gender, interested_in, interests FROM profiles WHERE user_id = $1`,
      [userId]
    );

    if (myProfile.length === 0) {
      throw new AppError('Please create a profile before discovering others.', 400);
    }

    const { gender: myGender, interested_in: myInterestedIn } = myProfile[0];
    let myInterests = [];
    try {
      myInterests = typeof myProfile[0].interests === 'string'
        ? JSON.parse(myProfile[0].interests)
        : myProfile[0].interests || [];
    } catch {
      myInterests = [];
    }

    // 2. Build gender filter — bidirectional compatibility
    //    "I'm interested in X" AND "They're interested in my gender"
    let genderFilter = '';
    const params = [userId];
    let paramIndex = 2;

    if (myInterestedIn !== 'everyone') {
      genderFilter += ` AND p.gender = $${paramIndex}`;
      params.push(myInterestedIn);
      paramIndex++;
    }

    genderFilter += ` AND (p.interested_in = $${paramIndex} OR p.interested_in = 'everyone')`;
    params.push(myGender);
    paramIndex++;

    // 3. Fetch candidate pool (wider pool, then score & sort in JS)
    //    Fetch up to 5x the limit to have enough candidates for scoring
    const poolSize = Math.min(limit * 5, 100);
    const poolParamIdx = paramIndex;
    params.push(poolSize);

    const { rows: candidates } = await db.query(
      `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender,
              p.interested_in, p.interests, p.branch
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1
         AND u.is_banned = 0
         AND u.email_verified = 1
         -- Exclude already swiped
         AND p.user_id NOT IN (
           SELECT swiped_id FROM swipes WHERE swiper_id = $1
         )
         -- Exclude blocked (in either direction)
         AND p.user_id NOT IN (
           SELECT blocked_id FROM blocks WHERE blocker_id = $1
           UNION
           SELECT blocker_id FROM blocks WHERE blocked_id = $1
         )
         ${genderFilter}
       ORDER BY RANDOM()
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

        // Parse JSON fields
        let photos = [];
        let interests = [];
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
          compatibility_score: score,
          compatibility_breakdown: breakdown,
        };
      })
    );

    // 5. Sort by compatibility score (highest first) and take top `limit`
    scoredProfiles.sort((a, b) => b.compatibility_score - a.compatibility_score);
    const topProfiles = scoredProfiles.slice(0, limit);

    // 6. Refresh tag popularity in background (non-blocking)
    refreshTagPopularity().catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        profiles: topProfiles,
        count: topProfiles.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDiscoverDeck };
