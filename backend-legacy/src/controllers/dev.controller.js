const db = require('../config/db');

/**
 * POST /api/dev/reset-swipes
 * Clears swipe history for the logged-in user (or optional userId param)
 * so previously seen profiles reappear in Discover.
 */
async function resetSwipes(req, res, next) {
  try {
    const targetUserId = req.params.userId || req.user?.id;

    if (targetUserId) {
      // Clear swipes made by or targeting this user
      await db.query(`DELETE FROM swipes WHERE swiper_id = $1 OR swiped_id = $1`, [targetUserId]);
      // Also clear related matches and notifications for a clean reset
      await db.query(`DELETE FROM matches WHERE user1_id = $1 OR user2_id = $1`, [targetUserId]);
      await db.query(`DELETE FROM notifications WHERE from_user_id = $1 OR to_user_id = $1`, [targetUserId]);
    } else {
      // If no user specified, reset all swipes
      await db.query(`DELETE FROM swipes`);
      await db.query(`DELETE FROM matches`);
      await db.query(`DELETE FROM notifications`);
    }

    res.status(200).json({
      success: true,
      message: `Swipe history successfully reset for testing. Discover feed will show profiles again.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dev/reset-all-swipes
 * Clears ALL swipe, match, and notification records across all users.
 */
async function resetAllSwipes(req, res, next) {
  try {
    await db.query(`DELETE FROM swipes`);
    await db.query(`DELETE FROM matches`);
    await db.query(`DELETE FROM notifications`);

    res.status(200).json({
      success: true,
      message: `All swipe, match, and notification history cleared across all users.`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { resetSwipes, resetAllSwipes };
