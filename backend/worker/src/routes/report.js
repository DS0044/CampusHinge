import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const report = new Hono();
report.use('/*', authenticate());

report.post('/', async (c) => {
  const reporterId = c.get('user').id;
  const { reported_id, reason } = await c.req.json();
  const db = c.env.DB;

  if (reporterId === reported_id) return c.json({ success: false, error: { message: 'You cannot report yourself.' } }, 400);
  const { rows } = await query(db, `SELECT id FROM users WHERE id = $1`, [reported_id]);
  if (rows.length === 0) return c.json({ success: false, error: { message: 'User not found.' } }, 404);

  const id = crypto.randomUUID();
  await query(db, `INSERT INTO reports (id, reporter_id, reported_id, reason) VALUES ($1, $2, $3, $4)`, [id, reporterId, reported_id, reason]);
  return c.json({ success: true, message: 'Report submitted. Our team will review it.' }, 201);
});

export default report;
