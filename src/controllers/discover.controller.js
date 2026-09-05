const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/discover
 * Returns a deck of profiles for the authenticated user to swipe on.
 *
 * Filters:
 * - Exclude self
 * - Exclude already-swiped users
 * - Exclude blocked users (in either direction)
 * - Exclude banned users
 * - Filter by gender/interested_in compatibility
 * - Only users with a profile
 *
 * Query params: ?limit=10 (default 10, max 50)
 */
async function getDiscoverDeck(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    // 1. Get current user's profile to know their preferences & interests
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
    } catch (e) {
      myInterests = [];
    }

    // 2. Build gender filter conditions
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

    // 3. Build interest overlap SQL expression dynamically
    let overlapExpr = '0';
    if (Array.isArray(myInterests) && myInterests.length > 0) {
      const cases = myInterests.map((interest) => {
        const idx = paramIndex;
        paramIndex++;
        params.push(`"${interest}"`);
        return `(CASE WHEN instr(p.interests, $${idx}) > 0 THEN 1 ELSE 0 END)`;
      });
      overlapExpr = cases.join(' + ');
    }

    const limitParamIdx = paramIndex;
    params.push(limit);

    const { rows: profiles } = await db.query(
      `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interests,
              (${overlapExpr}) AS shared_interest_count
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id != $1
         AND u.is_banned = false
         AND u.email_verified = true
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
       ORDER BY shared_interest_count DESC, RANDOM()
       LIMIT $${limitParamIdx}`,
      params
    );

    const formattedProfiles = profiles.map((p) => {
      let photos = [];
      let interests = [];
      try { photos = typeof p.photos === 'string' ? JSON.parse(p.photos) : p.photos || []; } catch { photos = []; }
      try { interests = typeof p.interests === 'string' ? JSON.parse(p.interests) : p.interests || []; } catch { interests = []; }

      const sharedInterests = Array.isArray(interests) && Array.isArray(myInterests)
        ? interests.filter((tag) => myInterests.includes(tag))
        : [];

      return {
        ...p,
        id: p.user_id,
        photos,
        interests,
        shared_interests: sharedInterests,
        shared_count: sharedInterests.length,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        profiles: formattedProfiles,
        count: formattedProfiles.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDiscoverDeck };
