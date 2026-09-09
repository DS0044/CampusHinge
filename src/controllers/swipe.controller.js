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
          `UPDATE swipes SET action = $1, created_at = datetime('now') WHERE id = $2`,
          [action, existingSwipe[0].id]
        );
      }
    } else {
      isNewSwipe = true;
      const crypto = require('crypto');
      const swipeId = crypto.randomUUID();
      await db.query(
        `INSERT INTO swipes (id, swiper_id, swiped_id, action, created_at)
         VALUES ($1, $2, $3, $4, datetime('now'))
         ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET action = excluded.action, created_at = datetime('now')`,
        [swipeId, swiperId, swiped_id, action]
      );
    }

    // Update last_active for the swiper
    db.query(`UPDATE users SET last_active = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});

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
          updateSwipePreferences(swiperId, interests, action).catch(() => {});
        }
      } catch { /* non-critical */ }
    }

    let matched = false;
    let matchId = null;

    if (action === 'like') {
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
          `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'`,
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

      // Anti-spam notification: only create notification if one does not already exist
      const { rows: existingNotif } = await db.query(
        `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2 AND type = 'like'`,
        [swiped_id, swiperId]
      );

      if (existingNotif.length === 0) {
        const { createLikeNotification } = require('../services/notification.service');
        createLikeNotification(swiperId, swiped_id).catch((err) =>
          console.error('Notification error:', err.message)
        );
      }
    }

    res.status(200).json({
      success: true,
      data: {
        action,
        matched,
        match_id: matchId,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordSwipe };
