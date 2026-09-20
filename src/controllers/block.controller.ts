import { Request, Response, NextFunction } from 'express';
import db from '../config/db';
import { AppError } from '../middleware/errorHandler';

/**
 * POST /api/block
 * Block another user. Blocked users are excluded from discover and can't message each other.
 */
export async function blockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const blockerId = req.user!.id;
    const { blocked_id } = req.body;

    if (blockerId === blocked_id) {
      throw new AppError('You cannot block yourself.', 400);
    }

    // Check blocked user exists
    const { rows: targetUser } = await db.query(
      `SELECT id FROM users WHERE id = $1`,
      [blocked_id]
    );

    if (targetUser.length === 0) {
      throw new AppError('User not found.', 404);
    }

    // Insert block (ignore if already blocked)
    await db.query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blocked_id]
    );

    res.status(200).json({
      success: true,
      message: 'User blocked successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/block/:userId
 * Unblock a user.
 */
export async function unblockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const blockerId = req.user!.id;
    const { userId } = req.params;

    await db.query(
      `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, userId]
    );

    res.status(200).json({
      success: true,
      message: 'User unblocked.',
    });
  } catch (err) {
    next(err);
  }
}

export default { blockUser, unblockUser };
module.exports = { blockUser, unblockUser };
