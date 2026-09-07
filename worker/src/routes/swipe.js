/**
 * Swipe Routes — like/pass + behavioral learning
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { updateSwipePreferences } from '../services/scoring.js';

const swipe = new Hono();
swipe.use('/*', authenticate());

// POST /api/swipe
swipe.post('/', async (c) => {
  const swiperId = c.get('user').id;
  const { swiped_id, action } = await c.req.json();
  const db = c.env.DB;

  if (swiperId === swiped_id) return c.json({ success: false, error: { message: 'You cannot swipe on yourself.' } }, 400);

  const { rows: targetUser } = await query(db, `SELECT id, is_banned FROM users WHERE id = $1`, [swiped_id]);
  if (targetUser.length === 0) return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  if (targetUser[0].is_banned) return c.json({ success: false, error: { message: 'This user is no longer available.' } }, 400);

  const { rows: existing } = await query(db, `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`, [swiperId, swiped_id]);
  if (existing.length > 0) return c.json({ success: false, error: { message: 'You have already swiped on this user.' } }, 409);

  const swipeId = crypto.randomUUID();
  await query(db, `INSERT INTO swipes (id, swiper_id, swiped_id, action) VALUES ($1, $2, $3, $4)`, [swipeId, swiperId, swiped_id, action]);

  // Update last_active
  query(db, `UPDATE users SET last_active = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});

  // Behavioral learning
  try {
    const { rows: sp } = await query(db, `SELECT interests FROM profiles WHERE user_id = $1`, [swiped_id]);
    if (sp.length > 0) {
      let interests = [];
      try { interests = typeof sp[0].interests === 'string' ? JSON.parse(sp[0].interests) : sp[0].interests || []; } catch { interests = []; }
      c.executionCtx.waitUntil(updateSwipePreferences(db, swiperId, interests, action));
    }
  } catch { /* non-critical */ }

  let matched = false, matchId = null;

  if (action === 'like') {
    // Create notification
    const notifId = crypto.randomUUID();
    query(db, `INSERT INTO notifications (id, to_user_id, from_user_id, type) VALUES ($1, $2, $3, 'like')`,
      [notifId, swiped_id, swiperId]).catch(() => {});

    // Check mutual like
    const { rows: mutual } = await query(db,
      `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'`,
      [swiped_id, swiperId]
    );

    if (mutual.length > 0) {
      const [u1, u2] = swiperId < swiped_id ? [swiperId, swiped_id] : [swiped_id, swiperId];
      const newMatchId = crypto.randomUUID();
      const { rows: matchRows } = await query(db,
        `INSERT INTO matches (id, user1_id, user2_id) VALUES ($1, $2, $3)
         ON CONFLICT (user1_id, user2_id) DO NOTHING RETURNING id`,
        [newMatchId, u1, u2]
      );

      if (matchRows.length > 0) {
        matched = true;
        matchId = matchRows[0].id;
      } else {
        const { rows: em } = await query(db, `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`, [u1, u2]);
        if (em.length > 0) { matched = true; matchId = em[0].id; }
      }
    }
  }

  return c.json({ success: true, data: { action, matched, match_id: matchId } });
});

export default swipe;
