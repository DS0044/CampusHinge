import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const block = new Hono();
block.use('/*', authenticate());

block.post('/', async (c) => {
  const blockerId = c.get('user').id;
  const { blocked_id } = await c.req.json();
  const db = c.env.DB;

  if (blockerId === blocked_id) return c.json({ success: false, error: { message: 'You cannot block yourself.' } }, 400);
  const { rows } = await query(db, `SELECT id FROM users WHERE id = $1`, [blocked_id]);
  if (rows.length === 0) return c.json({ success: false, error: { message: 'User not found.' } }, 404);

  const id = crypto.randomUUID();
  await query(db, `INSERT INTO blocks (id, blocker_id, blocked_id) VALUES ($1, $2, $3) ON CONFLICT (blocker_id, blocked_id) DO NOTHING`, [id, blockerId, blocked_id]);
  return c.json({ success: true, message: 'User blocked successfully.' });
});

block.delete('/:userId', async (c) => {
  const blockerId = c.get('user').id;
  const userId = c.req.param('userId');
  await query(c.env.DB, `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, userId]);
  return c.json({ success: true, message: 'User unblocked.' });
});

export default block;
