/**
 * Admin Routes — protected by authenticate() + adminOnly()
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import type { Env, HonoVariables } from '../types.js';

type AppType = { Bindings: Env; Variables: HonoVariables };

const admin = new Hono<AppType>();
admin.use('/*', authenticate());
admin.use('/*', adminOnly());

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  reporter_email: string;
  reported_email: string;
}

// GET /api/admin/reports
admin.get('/reports', async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');

  let sql = `SELECT r.*, reporter.email AS reporter_email, reported.email AS reported_email
    FROM reports r JOIN users reporter ON reporter.id = r.reporter_id JOIN users reported ON reported.id = r.reported_id`;
  const params: unknown[] = [];

  if (status) {
    sql += ` WHERE r.status = $1`;
    params.push(status);
  }
  sql += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await query<ReportRow>(db, sql, params);

  let countSql = `SELECT COUNT(*) AS count FROM reports`;
  const countParams: unknown[] = [];
  if (status) {
    countSql += ` WHERE status = $1`;
    countParams.push(status);
  }
  const { rows: countRows } = await query<{ count: number }>(db, countSql, countParams);

  return c.json({
    success: true,
    data: {
      reports: rows,
      total: parseInt(String(countRows[0]?.count ?? 0)),
      limit,
      offset,
    },
  });
});

// POST /api/admin/reports/:reportId/review
admin.post('/reports/:reportId/review', async (c) => {
  const reportId = c.req.param('reportId');
  const { status } = await c.req.json<{ status?: string }>();

  if (!status || !['reviewed', 'dismissed'].includes(status)) {
    return c.json(
      { success: false, error: { message: 'Status must be "reviewed" or "dismissed".' } },
      400
    );
  }

  const { rows } = await query<ReportRow>(
    c.env.DB,
    `UPDATE reports SET status = $1 WHERE id = $2 RETURNING *`,
    [status, reportId]
  );
  if (rows.length === 0) {
    return c.json({ success: false, error: { message: 'Report not found.' } }, 404);
  }
  return c.json({ success: true, data: { report: rows[0] } });
});

// POST /api/admin/ban/:userId
admin.post('/ban/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { rows } = await query<{ id: string; email: string; is_banned: number }>(
    c.env.DB,
    `UPDATE users SET is_banned = 1, updated_at = datetime('now') WHERE id = $1 RETURNING id, email, is_banned`,
    [userId]
  );
  if (rows.length === 0) {
    return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  }
  return c.json({ success: true, message: 'User banned.', data: { user: rows[0] } });
});

// POST /api/admin/unban/:userId
admin.post('/unban/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { rows } = await query<{ id: string; email: string; is_banned: number }>(
    c.env.DB,
    `UPDATE users SET is_banned = 0, updated_at = datetime('now') WHERE id = $1 RETURNING id, email, is_banned`,
    [userId]
  );
  if (rows.length === 0) {
    return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  }
  return c.json({ success: true, message: 'User unbanned.', data: { user: rows[0] } });
});

export default admin;
