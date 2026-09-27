/**
 * Report Routes
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { Env, HonoVariables } from '../types.js';

type AppType = { Bindings: Env; Variables: HonoVariables };

const report = new Hono<AppType>();
report.use('/*', authenticate());

// POST /api/report
report.post('/', async (c) => {
  const reporterId = c.get('user').id;
  const { reported_id, reason } = await c.req.json<{ reported_id?: string; reason?: string }>();
  const db = c.env.DB;

  if (!reported_id) {
    return c.json({ success: false, error: { message: 'reported_id is required.' } }, 400);
  }
  if (reporterId === reported_id) {
    return c.json({ success: false, error: { message: 'You cannot report yourself.' } }, 400);
  }

  const { rows } = await query<{ id: string }>(
    db,
    `SELECT id FROM users WHERE id = $1`,
    [reported_id]
  );
  if (rows.length === 0) {
    return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  }

  const id = crypto.randomUUID();
  await query(
    db,
    `INSERT INTO reports (id, reporter_id, reported_id, reason) VALUES ($1, $2, $3, $4)`,
    [id, reporterId, reported_id, reason ?? null]
  );

  return c.json(
    { success: true, message: 'Report submitted. Our team will review it.' },
    201
  );
});

export default report;
