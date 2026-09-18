const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/report
 * Report another user with a reason.
 */
async function reportUser(req, res, next) {
  try {
    const reporterId = req.user.id;
    const { reported_id, reason } = req.body;

    if (reporterId === reported_id) {
      throw new AppError('You cannot report yourself.', 400);
    }

    // Check reported user exists
    const { rows: targetUser } = await db.query(
      `SELECT id FROM users WHERE id = $1`,
      [reported_id]
    );

    if (targetUser.length === 0) {
      throw new AppError('User not found.', 404);
    }

    await db.query(
      `INSERT INTO reports (reporter_id, reported_id, reason) VALUES ($1, $2, $3)`,
      [reporterId, reported_id, reason]
    );

    res.status(201).json({
      success: true,
      message: 'Report submitted. Our team will review it.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { reportUser };
