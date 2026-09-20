const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/admin/reports
 * List all reports, optionally filtered by status.
 * Query params: ?status=pending&limit=50&offset=0
 */
async function getReports(req, res, next) {
  try {
    const status = req.query.status;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let query = `
      SELECT r.*,
        reporter.email AS reporter_email,
        reported.email AS reported_email
      FROM reports r
      JOIN users reporter ON reporter.id = r.reporter_id
      JOIN users reported ON reported.id = r.reported_id
    `;
    const params = [];

    if (status) {
      query += ` WHERE r.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM reports`;
    const countParams = [];
    if (status) {
      countQuery += ` WHERE status = $1`;
      countParams.push(status);
    }
    const { rows: countRows } = await db.query(countQuery, countParams);

    res.status(200).json({
      success: true,
      data: {
        reports: rows,
        total: parseInt(countRows[0].count, 10),
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
async function reviewReport(req, res, next) {
  try {
    const { reportId } = req.params;
    const { status } = req.body; // 'reviewed' or 'dismissed'

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
async function banUser(req, res, next) {
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
async function unbanUser(req, res, next) {
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

/**
 * GET /api/admin/stats
 * Return overall application KPI metrics.
 */
async function getStats(_req, res, next) {
  try {
    const totalUsers = db.db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
    const verifiedUsers = db.db.prepare('SELECT COUNT(*) as count FROM users WHERE email_verified = 1').get()?.count || 0;
    const bannedUsers = db.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 1').get()?.count || 0;
    const totalReports = db.db.prepare('SELECT COUNT(*) as count FROM reports').get()?.count || 0;
    const pendingReports = db.db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'").get()?.count || 0;
    const totalMatches = db.db.prepare('SELECT COUNT(*) as count FROM matches').get()?.count || 0;
    const totalMessages = db.db.prepare('SELECT COUNT(*) as count FROM messages').get()?.count || 0;

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        bannedUsers,
        totalReports,
        pendingReports,
        totalMatches,
        totalMessages,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/users
 * Search and list users with their profile details.
 */
async function getUsers(req, res, next) {
  try {
    const { search = '', role = '', status = '', limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT u.id, u.email, u.role, u.email_verified, u.is_banned, u.subscription_status,
             u.profile_completed, u.last_active, u.created_at,
             p.name, p.bio, p.photos, p.branch, p.year, p.gender, p.interested_in, p.interests
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (u.email LIKE $${params.length + 1} OR p.name LIKE $${params.length + 2} OR p.branch LIKE $${params.length + 3})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ` AND u.role = $${params.length + 1}`;
      params.push(role);
    }

    if (status === 'banned') {
      query += ` AND u.is_banned = 1`;
    } else if (status === 'active') {
      query += ` AND (u.is_banned = 0 OR u.is_banned IS NULL)`;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const { rows } = await db.query(query, params);

    const formattedUsers = rows.map((u) => {
      let photos = [];
      try {
        photos = typeof u.photos === 'string' ? JSON.parse(u.photos) : (u.photos || []);
      } catch {
        photos = [];
      }
      let interests = [];
      try {
        interests = typeof u.interests === 'string' ? JSON.parse(u.interests) : (u.interests || []);
      } catch {
        interests = [];
      }
      return {
        ...u,
        photos,
        interests,
      };
    });

    const totalRow = db.db.prepare('SELECT COUNT(*) as count FROM users').get();

    res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        total: totalRow?.count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReports, reviewReport, banUser, unbanUser, getStats, getUsers };
