const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

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

    // Check for existing swipe (prevent duplicates)
    const { rows: existingSwipe } = await db.query(
      `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`,
      [swiperId, swiped_id]
    );

    if (existingSwipe.length > 0) {
      throw new AppError('You have already swiped on this user.', 409);
    }

    const crypto = require('crypto');
    const swipeId = crypto.randomUUID();

    // Record the swipe
    await db.query(
      `INSERT INTO swipes (id, swiper_id, swiped_id, action) VALUES ($1, $2, $3, $4)`,
      [swipeId, swiperId, swiped_id, action]
    );

    let matched = false;
    let matchId = null;

    // If it's a like, check for mutual like and create notification
    if (action === 'like') {
      const { createLikeNotification } = require('../services/notification.service');
      createLikeNotification(swiperId, swiped_id).catch((err) =>
        console.error('Notification error:', err.message)
      );

      const { rows: mutualLike } = await db.query(
        `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'`,
        [swiped_id, swiperId]
      );

      if (mutualLike.length > 0) {
        // Create a match — enforce canonical ordering (user1_id < user2_id)
        const [user1, user2] = swiperId < swiped_id
          ? [swiperId, swiped_id]
          : [swiped_id, swiperId];

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
        }
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
