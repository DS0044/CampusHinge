import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const admin = new Hono();
admin.use('/*', authenticate());
admin.use('/*', adminOnly());

admin.get('/reports', async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  let sql = `SELECT r.*, reporter.email AS reporter_email, reported.email AS reported_email
    FROM reports r JOIN users reporter ON reporter.id = r.reporter_id JOIN users reported ON reported.id = r.reported_id`;
  const params = [];

  if (status) { sql += ` WHERE r.status = $1`; params.push(status); }
  sql += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await query(db, sql, params);

  let countSql = `SELECT COUNT(*) AS count FROM reports`;
  const countParams = [];
  if (status) { countSql += ` WHERE status = $1`; countParams.push(status); }
  const { rows: countRows } = await query(db, countSql, countParams);

  return c.json({ success: true, data: { reports: rows, total: parseInt(countRows[0]?.count || 0), limit, offset } });
});

admin.post('/reports/:reportId/review', async (c) => {
  const reportId = c.req.param('reportId');
  const { status } = await c.req.json();
  if (!['reviewed', 'dismissed'].includes(status)) return c.json({ success: false, error: { message: 'Status must be "reviewed" or "dismissed".' } }, 400);

  const { rows } = await query(c.env.DB, `UPDATE reports SET status = $1 WHERE id = $2 RETURNING *`, [status, reportId]);
  if (rows.length === 0) return c.json({ success: false, error: { message: 'Report not found.' } }, 404);
  return c.json({ success: true, data: { report: rows[0] } });
});

admin.post('/ban/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { rows } = await query(c.env.DB, `UPDATE users SET is_banned = 1, updated_at = datetime('now') WHERE id = $1 RETURNING id, email, is_banned`, [userId]);
  if (rows.length === 0) return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  return c.json({ success: true, message: 'User banned.', data: { user: rows[0] } });
});

admin.post('/unban/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { rows } = await query(c.env.DB, `UPDATE users SET is_banned = 0, updated_at = datetime('now') WHERE id = $1 RETURNING id, email, is_banned`, [userId]);
  if (rows.length === 0) return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  return c.json({ success: true, message: 'User unbanned.', data: { user: rows[0] } });
});

export default admin;
