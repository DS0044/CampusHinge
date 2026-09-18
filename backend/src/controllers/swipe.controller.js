const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { updateSwipePreferences } = require('../services/scoring.service');

/**
 * POST /api/swipe
 * Record a like or pass. If mutual like exists, create a match.
 */
async function recordSwipe(req, res, next) {
  try {
    const swiperId = req.user.id;
    const { swiped_id, action } = req.body;

    // Can't swipe on yourself
    if (swiperId === swiped_id) {
      throw new AppError('You cannot swipe on yourself.', 400);
    }

    // Check that the swiped user exists and isn't banned
    const { rows: targetUser } = await db.query(
      `SELECT id, is_banned FROM users WHERE id = $1`,
      [swiped_id]
    );

    if (targetUser.length === 0) {
      throw new AppError('User not found.', 404);
    }

    if (targetUser[0].is_banned) {
      throw new AppError('This user is no longer available.', 400);
    }

    let sharedInterests = [];
    let isSuperLike = action === 'super_like';

    if (isSuperLike) {
      // 1. Fetch both users' profiles to compute shared interests
      const { rows: swiperProf } = await db.query(
        `SELECT interests FROM profiles WHERE user_id = $1`, [swiperId]
      );
      const { rows: swipedProf } = await db.query(
        `SELECT interests FROM profiles WHERE user_id = $1`, [swiped_id]
      );

      let swiperInterests = [];
      let swipedInterests = [];
      try {
        swiperInterests = typeof swiperProf[0]?.interests === 'string'
          ? JSON.parse(swiperProf[0].interests)
          : swiperProf[0]?.interests || [];
      } catch { swiperInterests = []; }

      try {
        swipedInterests = typeof swipedProf[0]?.interests === 'string'
          ? JSON.parse(swipedProf[0].interests)
          : swipedProf[0]?.interests || [];
      } catch { swipedInterests = []; }

      sharedInterests = Array.isArray(swiperInterests) && Array.isArray(swipedInterests)
        ? swiperInterests.filter((i) => swipedInterests.includes(i))
        : [];

      if (sharedInterests.length < 4) {
        throw new AppError('Super Like is only unlocked when you share 4 or more interests.', 400);
      }

      // 2. Enforce 1 Super Like per 24-hour rolling limit
      const { rows: swiperUser } = await db.query(
        `SELECT last_super_like_at FROM users WHERE id = $1`, [swiperId]
      );
      const lastSuperLikeAt = swiperUser[0]?.last_super_like_at;

      if (lastSuperLikeAt) {
        let lastTimeStr = String(lastSuperLikeAt);
        if (!lastTimeStr.endsWith('Z') && !lastTimeStr.includes('+')) {
          lastTimeStr = lastTimeStr.replace(' ', 'T') + 'Z';
        }
        const lastMs = new Date(lastTimeStr).getTime();
        const elapsedMs = Date.now() - lastMs;
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        if (!isNaN(lastMs) && elapsedMs < ONE_DAY_MS) {
          const remainingMs = ONE_DAY_MS - elapsedMs;
          const hours = Math.floor(remainingMs / 3600000);
          const mins = Math.ceil((remainingMs % 3600000) / 60000);
          const err = new AppError(`Next Super Like available in ${hours}h ${mins}m.`, 429);
          err.retryAfter = Math.ceil(remainingMs / 1000);
          throw err;
        }
      }
    }

    // Check existing swipe (allow re-swipe / update without 409 conflict)
    const { rows: existingSwipe } = await db.query(
      `SELECT id, action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`,
      [swiperId, swiped_id]
    );

    let isActionChange = false;
    let isNewSwipe = false;

    if (existingSwipe.length > 0) {
      if (existingSwipe[0].action !== action) {
        isActionChange = true;
        await db.query(
          `UPDATE swipes
           SET action = $1, is_super_like = $2, shared_interests = $3, shared_interests_count = $4, created_at = datetime('now')
           WHERE id = $5`,
          [action, isSuperLike ? 1 : 0, JSON.stringify(sharedInterests), sharedInterests.length, existingSwipe[0].id]
        );
      }
    } else {
      isNewSwipe = true;
      const crypto = require('crypto');
      const swipeId = crypto.randomUUID();
      await db.query(
        `INSERT INTO swipes (id, swiper_id, swiped_id, action, is_super_like, shared_interests, shared_interests_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, datetime('now'))
         ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET
           action = excluded.action,
           is_super_like = excluded.is_super_like,
           shared_interests = excluded.shared_interests,
           shared_interests_count = excluded.shared_interests_count,
           created_at = datetime('now')`,
        [swipeId, swiperId, swiped_id, action, isSuperLike ? 1 : 0, JSON.stringify(sharedInterests), sharedInterests.length]
      );
    }

    // Update last_active and if super like, update last_super_like_at
    if (isSuperLike) {
      db.query(`UPDATE users SET last_active = datetime('now'), last_super_like_at = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});
    } else {
      db.query(`UPDATE users SET last_active = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});
    }

    // ── BEHAVIORAL LEARNING: Feed the scoring engine ──
    if (isNewSwipe || isActionChange) {
      try {
        const { rows: swipedProfile } = await db.query(
          `SELECT interests FROM profiles WHERE user_id = $1`, [swiped_id]
        );
        if (swipedProfile.length > 0) {
          let interests = [];
          try {
            interests = typeof swipedProfile[0].interests === 'string'
              ? JSON.parse(swipedProfile[0].interests)
              : swipedProfile[0].interests || [];
          } catch { interests = []; }
          updateSwipePreferences(swiperId, interests, isSuperLike ? 'like' : action).catch(() => {});
        }
      } catch { /* non-critical */ }
    }

    let matched = false;
    let matchId = null;

    if (action === 'like' || action === 'super_like') {
      // Check if match already exists
      const [user1, user2] = swiperId < swiped_id
        ? [swiperId, swiped_id]
        : [swiped_id, swiperId];

      const { rows: existingMatch } = await db.query(
        `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`,
        [user1, user2]
      );

      if (existingMatch.length > 0) {
        matched = true;
        matchId = existingMatch[0].id;
      } else {
        const { rows: mutualLike } = await db.query(
          `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action IN ('like', 'super_like')`,
          [swiped_id, swiperId]
        );

        if (mutualLike.length > 0) {
          const crypto = require('crypto');
          const newMatchId = crypto.randomUUID();
          const { rows: matchRows } = await db.query(
            `INSERT INTO matches (id, user1_id, user2_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (user1_id, user2_id) DO NOTHING
             RETURNING id`,
            [newMatchId, user1, user2]
          );

          if (matchRows.length > 0) {
            matched = true;
            matchId = matchRows[0].id;
          } else {
            const { rows: em } = await db.query(
              `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`,
              [user1, user2]
            );
            if (em.length > 0) {
              matched = true;
              matchId = em[0].id;
            }
          }
        }
      }

      if (isSuperLike) {
        const { createSuperLikeNotification } = require('../services/notification.service');
        createSuperLikeNotification(swiperId, swiped_id, sharedInterests).catch((err) =>
          console.error('Super Like notification error:', err.message)
        );
      } else {
        // Anti-spam notification: only create notification if one does not already exist
        const { rows: existingNotif } = await db.query(
          `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2 AND type IN ('like', 'super_like')`,
          [swiped_id, swiperId]
        );

        if (existingNotif.length === 0) {
          const { createLikeNotification } = require('../services/notification.service');
          createLikeNotification(swiperId, swiped_id).catch((err) =>
            console.error('Notification error:', err.message)
          );
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        action,
        matched,
        match_id: matchId,
        super_like_available: isSuperLike ? false : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordSwipe };
