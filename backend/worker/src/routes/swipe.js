/**
 * Swipe Routes — like/pass + behavioral learning
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { updateSwipePreferences } from '../services/scoring.js';

import { sendSuperLikeEmail } from '../services/email.js';

const swipe = new Hono();
swipe.use('/*', authenticate());

// POST /api/swipe
swipe.post('/', async (c) => {
  const swiperId = c.get('user').id;
  const { swiped_id, action } = await c.req.json();
  const db = c.env.DB;

  if (swiperId === swiped_id) return c.json({ success: false, error: { message: 'You cannot swipe on yourself.' } }, 400);
  if (action !== 'like' && action !== 'pass' && action !== 'super_like') {
    return c.json({ success: false, error: { message: 'Action must be "like", "pass", or "super_like".' } }, 400);
  }

  const { rows: targetUser } = await query(db, `SELECT id, email, email_notifications, is_banned FROM users WHERE id = $1`, [swiped_id]);
  if (targetUser.length === 0) return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  if (targetUser[0].is_banned) return c.json({ success: false, error: { message: 'This user is no longer available.' } }, 400);

  const isSuperLike = action === 'super_like';
  let sharedInterests = [];

  if (isSuperLike) {
    // 1. Fetch both users' profiles to compute shared interests
    const { rows: swiperProf } = await query(db, `SELECT interests FROM profiles WHERE user_id = $1`, [swiperId]);
    const { rows: swipedProf } = await query(db, `SELECT interests FROM profiles WHERE user_id = $1`, [swiped_id]);

    let swiperInterests = [];
    let swipedInterests = [];
    try { swiperInterests = typeof swiperProf[0]?.interests === 'string' ? JSON.parse(swiperProf[0].interests) : swiperProf[0]?.interests || []; } catch {}
    try { swipedInterests = typeof swipedProf[0]?.interests === 'string' ? JSON.parse(swipedProf[0].interests) : swipedProf[0]?.interests || []; } catch {}

    sharedInterests = Array.isArray(swiperInterests) && Array.isArray(swipedInterests)
      ? swiperInterests.filter((i) => swipedInterests.includes(i))
      : [];

    if (sharedInterests.length < 4) {
      return c.json({ success: false, error: { message: 'Super Like is only unlocked when you share 4 or more interests.' } }, 400);
    }

    // 2. Enforce 1 Super Like per 24-hour rolling limit
    const { rows: swiperUser } = await query(db, `SELECT last_super_like_at FROM users WHERE id = $1`, [swiperId]);
    const lastSuperLikeAt = swiperUser[0]?.last_super_like_at;

    if (lastSuperLikeAt) {
      let lastTimeStr = String(lastSuperLikeAt);
      if (!lastTimeStr.endsWith('Z') && !lastTimeStr.includes('+')) {
        lastTimeStr = lastTimeStr.replace(' ', 'T') + 'Z';
      }
      const lastMs = new Date(lastTimeStr).getTime();
      const elapsedMs = Date.now() - lastMs;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      if (!isNaN(lastMs) && elapsedMs < ONE_DAY_MS) {
        const remainingMs = ONE_DAY_MS - elapsedMs;
        const hours = Math.floor(remainingMs / 3600000);
        const mins = Math.ceil((remainingMs % 3600000) / 60000);
        return c.json({
          success: false,
          error: {
            message: `Next Super Like available in ${hours}h ${mins}m.`,
            retryAfter: Math.ceil(remainingMs / 1000),
          },
        }, 429);
      }
    }
  }

  // Check existing swipe (allow re-swipe / update without 409 conflict)
  const { rows: existing } = await query(db, `SELECT id, action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`, [swiperId, swiped_id]);

  let isActionChange = false;
  let isNewSwipe = false;

  if (existing.length > 0) {
    if (existing[0].action !== action) {
      isActionChange = true;
      await query(db,
        `UPDATE swipes SET action = $1, is_super_like = $2, shared_interests = $3, shared_interests_count = $4, created_at = datetime('now') WHERE id = $5`,
        [action, isSuperLike ? 1 : 0, JSON.stringify(sharedInterests), sharedInterests.length, existing[0].id]
      );
    }
  } else {
    isNewSwipe = true;
    const swipeId = crypto.randomUUID();
    await query(db,
      `INSERT INTO swipes (id, swiper_id, swiped_id, action, is_super_like, shared_interests, shared_interests_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, datetime('now'))
       ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET
         action = excluded.action,
         is_super_like = excluded.is_super_like,
         shared_interests = excluded.shared_interests,
         shared_interests_count = excluded.shared_interests_count,
         created_at = datetime('now')`,
      [swipeId, swiperId, swiped_id, action, isSuperLike ? 1 : 0, JSON.stringify(sharedInterests), sharedInterests.length]
    );
  }

  // Update last_active (and last_super_like_at if super like)
  if (isSuperLike) {
    query(db, `UPDATE users SET last_active = datetime('now'), last_super_like_at = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});
  } else {
    query(db, `UPDATE users SET last_active = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});
  }

  // Behavioral learning (only on new swipe or changed action)
  if (isNewSwipe || isActionChange) {
    try {
      const { rows: sp } = await query(db, `SELECT interests FROM profiles WHERE user_id = $1`, [swiped_id]);
      if (sp.length > 0) {
        let interests = [];
        try { interests = typeof sp[0].interests === 'string' ? JSON.parse(sp[0].interests) : sp[0].interests || []; } catch {}
        c.executionCtx.waitUntil(updateSwipePreferences(db, swiperId, interests, isSuperLike ? 'like' : action));
      }
    } catch { /* non-critical */ }
  }

  let matched = false, matchId = null;

  if (action === 'like' || action === 'super_like') {
    // Check if match already exists
    const [u1, u2] = swiperId < swiped_id ? [swiperId, swiped_id] : [swiped_id, swiperId];
    const { rows: existingMatch } = await query(db, `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`, [u1, u2]);

    if (existingMatch.length > 0) {
      matched = true;
      matchId = existingMatch[0].id;
    } else {
      // Check mutual like / super_like
      const { rows: mutual } = await query(db,
        `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action IN ('like', 'super_like')`,
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

    if (isSuperLike) {
      // Fetch sender name
      const { rows: senderRows } = await query(db, `SELECT name FROM profiles WHERE user_id = $1`, [swiperId]);
      const senderName = senderRows[0]?.name || 'Someone';

      const metadata = JSON.stringify({
        shared_interests: sharedInterests,
        shared_count: sharedInterests.length,
        sender_name: senderName,
      });

      const { rows: existingNotif } = await query(db,
        `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`,
        [swiped_id, swiperId]
      );

      if (existingNotif.length > 0) {
        await query(db,
          `UPDATE notifications SET type = 'super_like', metadata = $1, is_read = 0, is_seen = 0, created_at = datetime('now') WHERE id = $2`,
          [metadata, existingNotif[0].id]
        );
      } else {
        const notifId = crypto.randomUUID();
        await query(db,
          `INSERT INTO notifications (id, to_user_id, from_user_id, type, metadata, created_at) VALUES ($1, $2, $3, 'super_like', $4, datetime('now'))`,
          [notifId, swiped_id, swiperId, metadata]
        );
      }

      // Send transactional email if recipient opted in
      const recipient = targetUser[0];
      if (recipient?.email && recipient.email_notifications !== 0) {
        c.executionCtx.waitUntil(
          sendSuperLikeEmail(c.env, recipient.email, senderName, sharedInterests).catch(e => console.error('Super Like email error:', e))
        );
      }
    } else {
      // Anti-spam notification: only notify if an unread/existing 'like' or 'super_like' notification doesn't already exist
      const { rows: existingNotif } = await query(db,
        `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2 AND type IN ('like', 'super_like')`,
        [swiped_id, swiperId]
      );

      if (existingNotif.length === 0) {
        const notifId = crypto.randomUUID();
        query(db, `INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at) VALUES ($1, $2, $3, 'like', datetime('now'))`,
          [notifId, swiped_id, swiperId]).catch(() => {});
      }
    }
  }

  return c.json({
    success: true,
    data: {
      action,
      matched,
      match_id: matchId,
      super_like_available: isSuperLike ? false : undefined,
    },
  });
});

export default swipe;
