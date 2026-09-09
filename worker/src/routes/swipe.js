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
  if (action !== 'like' && action !== 'pass') return c.json({ success: false, error: { message: 'Action must be "like" or "pass".' } }, 400);

  const { rows: targetUser } = await query(db, `SELECT id, is_banned FROM users WHERE id = $1`, [swiped_id]);
  if (targetUser.length === 0) return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  if (targetUser[0].is_banned) return c.json({ success: false, error: { message: 'This user is no longer available.' } }, 400);

  // Check existing swipe (allow re-swipe / update without 409 conflict)
  const { rows: existing } = await query(db, `SELECT id, action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`, [swiperId, swiped_id]);

  let isActionChange = false;
  let isNewSwipe = false;

  if (existing.length > 0) {
    if (existing[0].action !== action) {
      isActionChange = true;
      await query(db, `UPDATE swipes SET action = $1, created_at = datetime('now') WHERE id = $2`, [action, existing[0].id]);
    }
  } else {
    isNewSwipe = true;
    const swipeId = crypto.randomUUID();
    await query(db, `INSERT INTO swipes (id, swiper_id, swiped_id, action, created_at) VALUES ($1, $2, $3, $4, datetime('now'))
                     ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET action = excluded.action, created_at = datetime('now')`,
      [swipeId, swiperId, swiped_id, action]
    );
  }

  // Update last_active
  query(db, `UPDATE users SET last_active = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});

  // Behavioral learning (only on new swipe or changed action)
  if (isNewSwipe || isActionChange) {
    try {
      const { rows: sp } = await query(db, `SELECT interests FROM profiles WHERE user_id = $1`, [swiped_id]);
      if (sp.length > 0) {
        let interests = [];
        try { interests = typeof sp[0].interests === 'string' ? JSON.parse(sp[0].interests) : sp[0].interests || []; } catch { interests = []; }
        c.executionCtx.waitUntil(updateSwipePreferences(db, swiperId, interests, action));
      }
    } catch { /* non-critical */ }
  }

  let matched = false, matchId = null;

  if (action === 'like') {
    // Check if match already exists
    const [u1, u2] = swiperId < swiped_id ? [swiperId, swiped_id] : [swiped_id, swiperId];
    const { rows: existingMatch } = await query(db, `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`, [u1, u2]);

    if (existingMatch.length > 0) {
      matched = true;
      matchId = existingMatch[0].id;
    } else {
      // Check mutual like
      const { rows: mutual } = await query(db,
        `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'`,
        [swiped_id, swiperId]
      );

      if (mutual.length > 0) {
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

    // Anti-spam notification: only notify if an unread/existing 'like' notification doesn't already exist
    const { rows: existingNotif } = await query(db,
      `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2 AND type = 'like'`,
      [swiped_id, swiperId]
    );

    if (existingNotif.length === 0) {
      const notifId = crypto.randomUUID();
      query(db, `INSERT INTO notifications (id, to_user_id, from_user_id, type) VALUES ($1, $2, $3, 'like')`,
        [notifId, swiped_id, swiperId]).catch(() => {});
    }
  }

  return c.json({ success: true, data: { action, matched, match_id: matchId } });
});

export default swipe;
