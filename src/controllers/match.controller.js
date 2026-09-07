const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/matches
 * List all matches for the authenticated user, with the other user's profile info.
 */
async function getMatches(req, res, next) {
  try {
    const userId = req.user.id;

    const { rows: matches } = await db.query(
      `SELECT
         m.id AS match_id,
         m.is_unlocked,
         m.created_at AS matched_at,
         p.user_id,
         p.name,
         p.photos,
         p.bio,
         -- Get the last message preview
         (
           SELECT content FROM messages
           WHERE match_id = m.id
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_message,
         (
           SELECT created_at FROM messages
           WHERE match_id = m.id
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_message_at
       FROM matches m
       JOIN profiles p ON p.user_id = CASE
         WHEN m.user1_id = $1 THEN m.user2_id
         ELSE m.user1_id
       END
       JOIN users u ON u.id = p.user_id
       WHERE (m.user1_id = $1 OR m.user2_id = $1)
         AND u.is_banned = 0
       ORDER BY last_message_at DESC NULLS LAST, m.created_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: { matches },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMatches };
