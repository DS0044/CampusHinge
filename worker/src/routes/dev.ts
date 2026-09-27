/**
 * Dev Routes — development/testing utilities (reset swipes, etc.)
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { Env, HonoVariables } from '../types.js';

type AppType = { Bindings: Env; Variables: HonoVariables };

const dev = new Hono<AppType>();
dev.use('/*', authenticate());

// POST /api/dev/reset-swipes — Reset swipes for the current user
dev.post('/reset-swipes', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;
  await query(db, `DELETE FROM swipes WHERE swiper_id = $1 OR swiped_id = $1`, [userId]);
  await query(db, `DELETE FROM matches WHERE user1_id = $1 OR user2_id = $1`, [userId]);
  await query(db, `DELETE FROM notifications WHERE from_user_id = $1 OR to_user_id = $1`, [userId]);
  return c.json({
    success: true,
    message: 'Swipe history reset. Discover feed will show profiles again.',
  });
});

// POST /api/dev/reset-all-swipes — Wipe ALL swipes/matches/notifications (super admin)
dev.post('/reset-all-swipes', async (c) => {
  const db = c.env.DB;
  await query(db, `DELETE FROM swipes`, []);
  await query(db, `DELETE FROM matches`, []);
  await query(db, `DELETE FROM notifications`, []);
  return c.json({
    success: true,
    message: 'All swipe, match, and notification history cleared.',
  });
});

export default dev;
