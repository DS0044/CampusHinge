/**
 * Swipe Routes — like/pass + behavioral learning
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { updateSwipePreferences, canSuperLike, parseJsonArray } from '../services/scoring.js';
import { INTENTS } from '../constants/intent.constants.js';
import { sendSuperLikeEmail, sendLikeEmail } from '../services/email.js';
import type { Env, HonoVariables } from '../types.js';

type AppType = { Bindings: Env; Variables: HonoVariables };

const swipe = new Hono<AppType>();
swipe.use('/*', authenticate());

interface SwipeBody {
  swiped_id?: string;
  action?: string;
  intent?: string;
}

interface TargetUserRow {
  id: string;
  email: string;
  email_notifications: number | string | boolean;
  is_banned: number;
}

interface SwiperRow {
  active_intent: string | null;
  last_super_like_at: string | null;
}

interface SwipeRow {
  id: string;
  action: string;
}

interface MutualSwipeRow {
  id: string;
  intent: string | null;
}

interface MatchRow {
  id: string;
}

interface ProfileInfoRow {
  interests: unknown;
  activity_tags: unknown;
  branch: string | null;
  year: number | string | null;
  name?: string;
}

// POST /api/swipe
swipe.post('/', async (c) => {
  const swiperId = c.get('user').id;
  const body = await c.req.json<SwipeBody>();
  const { swiped_id, action, intent } = body;
  const db = c.env.DB;

  if (!swiped_id || !action) {
    return c.json({ success: false, error: { message: 'swiped_id and action are required.' } }, 400);
  }

  if (swiperId === swiped_id) {
    return c.json({ success: false, error: { message: 'You cannot swipe on yourself.' } }, 400);
  }
  if (action !== 'like' && action !== 'pass' && action !== 'super_like') {
    return c.json(
      { success: false, error: { message: 'Action must be "like", "pass", or "super_like".' } },
      400
    );
  }

  const { rows: targetUser } = await query<TargetUserRow>(
    db,
    `SELECT id, email, email_notifications, is_banned FROM users WHERE id = $1`,
    [swiped_id]
  );
  if (targetUser.length === 0) {
    return c.json({ success: false, error: { message: 'User not found.' } }, 404);
  }
  if (targetUser[0].is_banned) {
    return c.json({ success: false, error: { message: 'This user is no longer available.' } }, 400);
  }

  const { rows: swiperUserRows } = await query<SwiperRow>(
    db,
    `SELECT active_intent, last_super_like_at FROM users WHERE id = $1`,
    [swiperId]
  );
  const swiperActiveIntent = swiperUserRows[0]?.active_intent ?? 'dating';
  const resolvedIntent =
    intent && INTENTS.includes(intent as typeof INTENTS[number]) ? intent : swiperActiveIntent;

  const isSuperLike = action === 'super_like';
  let sharedInterests: string[] = [];

  if (isSuperLike) {
    const { rows: swiperProf } = await query<ProfileInfoRow>(
      db,
      `SELECT interests, activity_tags, branch, year FROM profiles WHERE user_id = $1`,
      [swiperId]
    );
    const { rows: swipedProf } = await query<ProfileInfoRow>(
      db,
      `SELECT interests, activity_tags, branch, year FROM profiles WHERE user_id = $1`,
      [swiped_id]
    );

    const sProf = swiperProf[0] ?? {};
    const tProf = swipedProf[0] ?? {};

    const swiperInterests = parseJsonArray(sProf.interests);
    const swipedInterests = parseJsonArray(tProf.interests);
    sharedInterests = swiperInterests.filter((i) => swipedInterests.includes(i));

    const check = canSuperLike(resolvedIntent, sProf, tProf);
    if (!check.allowed) {
      return c.json(
        { success: false, error: { message: check.reason ?? 'Super Like requirements not met.' } },
        400
      );
    }

    const lastSuperLikeAt = swiperUserRows[0]?.last_super_like_at;
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
        const hours = Math.floor(remainingMs / 3_600_000);
        const mins = Math.ceil((remainingMs % 3_600_000) / 60_000);
        return c.json(
          {
            success: false,
            error: {
              message: `Next Super Like available in ${hours}h ${mins}m.`,
              retryAfter: Math.ceil(remainingMs / 1000),
            },
          },
          429
        );
      }
    }
  }

  const { rows: existing } = await query<SwipeRow>(
    db,
    `SELECT id, action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`,
    [swiperId, swiped_id]
  );

  let isActionChange = false;
  let isNewSwipe = false;

  if (existing.length > 0) {
    if (existing[0].action !== action) {
      isActionChange = true;
      await query(
        db,
        `UPDATE swipes SET action = $1, is_super_like = $2, shared_interests = $3, shared_interests_count = $4, intent = $5, created_at = datetime('now') WHERE id = $6`,
        [action, isSuperLike ? 1 : 0, JSON.stringify(sharedInterests), sharedInterests.length, resolvedIntent, existing[0].id]
      );
    }
  } else {
    isNewSwipe = true;
    const swipeId = crypto.randomUUID();
    await query(
      db,
      `INSERT INTO swipes (id, swiper_id, swiped_id, action, is_super_like, shared_interests, shared_interests_count, intent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))
       ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET
         action = excluded.action,
         is_super_like = excluded.is_super_like,
         shared_interests = excluded.shared_interests,
         shared_interests_count = excluded.shared_interests_count,
         intent = excluded.intent,
         created_at = datetime('now')`,
      [swipeId, swiperId, swiped_id, action, isSuperLike ? 1 : 0, JSON.stringify(sharedInterests), sharedInterests.length, resolvedIntent]
    );
  }

  if (isSuperLike) {
    query(
      db,
      `UPDATE users SET last_active = datetime('now'), last_super_like_at = datetime('now') WHERE id = $1`,
      [swiperId]
    ).catch(() => {});
  } else {
    query(db, `UPDATE users SET last_active = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});
  }

  if (isNewSwipe || isActionChange) {
    try {
      const { rows: sp } = await query<{ interests: unknown }>(
        db,
        `SELECT interests FROM profiles WHERE user_id = $1`,
        [swiped_id]
      );
      if (sp.length > 0) {
        const interests = parseJsonArray(sp[0].interests);
        c.executionCtx.waitUntil(
          updateSwipePreferences(db, swiperId, interests, isSuperLike ? 'like' : action)
        );
      }
    } catch {
      /* non-critical */
    }
  }

  let matched = false;
  let matchId: string | null = null;

  if (action === 'like' || action === 'super_like') {
    const [u1, u2] = swiperId < swiped_id ? [swiperId, swiped_id] : [swiped_id, swiperId];
    const { rows: existingMatch } = await query<MatchRow>(
      db,
      `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`,
      [u1, u2]
    );

    if (existingMatch.length > 0) {
      matched = true;
      matchId = existingMatch[0].id;
    } else {
      const { rows: mutual } = await query<MutualSwipeRow>(
        db,
        `SELECT id, intent FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action IN ('like', 'super_like')`,
        [swiped_id, swiperId]
      );

      if (mutual.length > 0) {
        const matchSnapshotIntent = resolvedIntent ?? mutual[0].intent ?? 'dating';
        const newMatchId = crypto.randomUUID();
        const { rows: matchRows } = await query<MatchRow>(
          db,
          `INSERT INTO matches (id, user1_id, user2_id, intent) VALUES ($1, $2, $3, $4)
           ON CONFLICT (user1_id, user2_id) DO NOTHING RETURNING id`,
          [newMatchId, u1, u2, matchSnapshotIntent]
        );

        if (matchRows.length > 0) {
          matched = true;
          matchId = matchRows[0].id;
        } else {
          const { rows: em } = await query<MatchRow>(
            db,
            `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`,
            [u1, u2]
          );
          if (em.length > 0) {
            matched = true;
            matchId = em[0].id;
          }
        }
      }
    }

    if (isSuperLike) {
      const { rows: senderRows } = await query<{ name: string }>(
        db,
        `SELECT name FROM profiles WHERE user_id = $1`,
        [swiperId]
      );
      const senderName = senderRows[0]?.name ?? 'Someone';

      const metadata = JSON.stringify({
        shared_interests: sharedInterests,
        shared_count: sharedInterests.length,
        sender_name: senderName,
      });

      const { rows: existingNotif } = await query<{ id: string }>(
        db,
        `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`,
        [swiped_id, swiperId]
      );

      if (existingNotif.length > 0) {
        await query(
          db,
          `UPDATE notifications SET type = 'super_like', metadata = $1, is_read = 0, is_seen = 0, created_at = datetime('now') WHERE id = $2`,
          [metadata, existingNotif[0].id]
        );
      } else {
        const notifId = crypto.randomUUID();
        await query(
          db,
          `INSERT INTO notifications (id, to_user_id, from_user_id, type, metadata, created_at) VALUES ($1, $2, $3, 'super_like', $4, datetime('now'))`,
          [notifId, swiped_id, swiperId, metadata]
        );
      }

      const recipient = targetUser[0];
      const shouldNotifySuperLike =
        recipient?.email &&
        recipient.email_notifications !== 0 &&
        recipient.email_notifications !== '0' &&
        recipient.email_notifications !== false;

      if (shouldNotifySuperLike) {
        console.log(`📨 Triggering Super Like notification email for ${recipient.email}`);
        const p = sendSuperLikeEmail(c.env, recipient.email, senderName, sharedInterests)
          .then(() => console.log(`✅ Super Like email sent to ${recipient.email}`))
          .catch((e: unknown) => console.error('❌ Super Like email error:', e));
        if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
          c.executionCtx.waitUntil(p);
        }
      }
    } else {
      const { rows: existingNotif } = await query<{ id: string }>(
        db,
        `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`,
        [swiped_id, swiperId]
      );

      if (existingNotif.length > 0) {
        await query(
          db,
          `UPDATE notifications SET type = 'like', is_read = 0, is_seen = 0, created_at = datetime('now') WHERE id = $1`,
          [existingNotif[0].id]
        );
      } else {
        const notifId = crypto.randomUUID();
        await query(
          db,
          `INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at) VALUES ($1, $2, $3, 'like', datetime('now'))`,
          [notifId, swiped_id, swiperId]
        );
      }

      const recipient = targetUser[0];
      const shouldNotifyLike =
        recipient?.email &&
        recipient.email_notifications !== 0 &&
        recipient.email_notifications !== '0' &&
        recipient.email_notifications !== false;

      if (shouldNotifyLike) {
        console.log(`📨 Triggering Like notification email for ${recipient.email}`);
        const p = sendLikeEmail(c.env, recipient.email)
          .then(() => console.log(`✅ Like email sent to ${recipient.email}`))
          .catch((e: unknown) => console.error('❌ Like email error:', e));
        if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
          c.executionCtx.waitUntil(p);
        }
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
