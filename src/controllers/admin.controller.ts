import { Request, Response, NextFunction } from 'express';
import db from '../config/db';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/admin/reports
 * List all reports, optionally filtered by status.
 * Query params: ?status=pending&limit=50&offset=0
 */
export async function getReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    let queryText = `
      SELECT r.*,
        reporter.email AS reporter_email,
        reported.email AS reported_email
      FROM reports r
      JOIN users reporter ON reporter.id = r.reporter_id
      JOIN users reported ON reported.id = r.reported_id
    `;
    const params: unknown[] = [];

    if (status) {
      queryText += ` WHERE r.status = $1`;
      params.push(status);
    }

    queryText += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await db.query(queryText, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) AS count FROM reports`;
    const countParams: unknown[] = [];
    if (status) {
      countQuery += ` WHERE status = $1`;
      countParams.push(status);
    }
    const { rows: countRows } = await db.query<{ count: string | number }>(countQuery, countParams);

    res.status(200).json({
      success: true,
      data: {
        reports: rows,
        total: parseInt(String(countRows[0].count), 10),
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/reports/:reportId/review
 * Mark a report as reviewed or dismissed.
 */
export async function reviewReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!['reviewed', 'dismissed'].includes(status)) {
      throw new AppError('Status must be "reviewed" or "dismissed".', 400);
    }

    const { rows } = await db.query(
      `UPDATE reports SET status = $1 WHERE id = $2 RETURNING *`,
      [status, reportId]
    );

    if (rows.length === 0) {
      throw new AppError('Report not found.', 404);
    }

    res.status(200).json({
      success: true,
      data: { report: rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/ban/:userId
 * Ban a user — sets is_banned = true.
 */
export async function banUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;

    const { rows } = await db.query(
      `UPDATE users SET is_banned = 1, updated_at = datetime('now') WHERE id = $1 RETURNING id, email, is_banned`,
      [userId]
    );

    if (rows.length === 0) {
      throw new AppError('User not found.', 404);
    }

    res.status(200).json({
      success: true,
      message: 'User banned successfully.',
      data: { user: rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/unban/:userId
 * Unban a user.
 */
export async function unbanUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;

    const { rows } = await db.query(
      `UPDATE users SET is_banned = 0, updated_at = datetime('now') WHERE id = $1 RETURNING id, email, is_banned`,
      [userId]
    );

    if (rows.length === 0) {
      throw new AppError('User not found.', 404);
    }

    res.status(200).json({
      success: true,
      message: 'User unbanned.',
      data: { user: rows[0] },
    });
  } catch (err) {
    next(err);
  }
}

export default { getReports, reviewReport, banUser, unbanUser };
module.exports = { getReports, reviewReport, banUser, unbanUser };
