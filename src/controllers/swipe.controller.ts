import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { updateSwipePreferences, canSuperLike, parseJsonArray } from '../services/scoring.service';
import { createLikeNotification, createSuperLikeNotification } from '../services/notification.service';
import { IntentType, INTENTS } from '../constants/intent.constants';

/**
 * POST /api/swipe
 * Record a like, pass, or super_like with intent context.
 * If mutual like exists, create a match stamped with the active intent snapshot.
 */
export async function recordSwipe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const swiperId = req.user!.id;
    const { swiped_id, action, intent } = req.body;

    // Can't swipe on yourself
    if (swiperId === swiped_id) {
      throw new AppError('You cannot swipe on yourself.', 400);
    }

    // Check that the swiped user exists and isn't banned
    const { rows: targetUser } = await db.query<{ id: string; is_banned: number | boolean }>(
      `SELECT id, is_banned FROM users WHERE id = $1`,
      [swiped_id]
    );

    if (targetUser.length === 0) {
      throw new AppError('User not found.', 404);
    }

    if (targetUser[0].is_banned) {
      throw new AppError('This user is no longer available.', 400);
    }

    // Determine swipe intent: either provided in body or from swiper's active_intent
    const { rows: swiperUserRows } = await db.query<{ active_intent?: string }>(
      `SELECT active_intent FROM users WHERE id = $1`,
      [swiperId]
    );
    const resolvedIntent: IntentType = (
      intent && INTENTS.includes(intent as IntentType)
        ? intent
        : (swiperUserRows[0]?.active_intent && INTENTS.includes(swiperUserRows[0].active_intent as IntentType)
            ? swiperUserRows[0].active_intent
            : 'dating')
    ) as IntentType;

    // Fetch both users' profiles
    const { rows: swiperProf } = await db.query<{
      interests: string | string[];
      activity_tags?: string | string[];
      branch?: string | null;
      year?: number | null;
    }>(
      `SELECT interests, activity_tags, branch, year FROM profiles WHERE user_id = $1`,
      [swiperId]
    );
    const { rows: swipedProf } = await db.query<{
      interests: string | string[];
      activity_tags?: string | string[];
      branch?: string | null;
      year?: number | null;
    }>(
      `SELECT interests, activity_tags, branch, year FROM profiles WHERE user_id = $1`,
      [swiped_id]
    );

    const swiperInterests = parseJsonArray(swiperProf[0]?.interests);
    const swipedInterests = parseJsonArray(swipedProf[0]?.interests);
    const sharedInterests = swiperInterests.filter((i) => swipedInterests.includes(i));

    const isSuperLike = action === 'super_like';

    if (isSuperLike) {
      // 1. Enforce intent-specific Super Like unlock condition
      const gate = canSuperLike(
        resolvedIntent,
        swiperProf[0] || {},
        swipedProf[0] || {}
      );

      if (!gate.allowed) {
        throw new AppError(gate.reason || 'Super Like is not unlocked for this profile.', 400);
      }

      // 2. Enforce 1 Super Like per 24-hour rolling limit
      const { rows: swiperUser } = await db.query<{ last_super_like_at: string | null }>(
        `SELECT last_super_like_at FROM users WHERE id = $1`, [swiperId]
      );
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
          const err = new AppError(`Next Super Like available in ${hours}h ${mins}m.`, 429);
          (err as any).retryAfter = Math.ceil(remainingMs / 1000);
          throw err;
        }
      }
    }

    const { rows: existingSwipe } = await db.query<{ id: string; action: string }>(
      `SELECT id, action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2`,
      [swiperId, swiped_id]
    );

    let isActionChange = false;
    let isNewSwipe = false;

    if (existingSwipe.length > 0) {
      if (existingSwipe[0].action !== action) {
        isActionChange = true;
        await db.query(
          `UPDATE swipes
           SET action = $1, is_super_like = $2, shared_interests = $3, shared_interests_count = $4, intent = $5, created_at = datetime('now')
           WHERE id = $6`,
          [action, isSuperLike ? 1 : 0, JSON.stringify(sharedInterests), sharedInterests.length, resolvedIntent, existingSwipe[0].id]
        );
      }
    } else {
      isNewSwipe = true;
      const swipeId = crypto.randomUUID();
      await db.query(
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
      db.query(`UPDATE users SET last_active = datetime('now'), last_super_like_at = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});
    } else {
      db.query(`UPDATE users SET last_active = datetime('now') WHERE id = $1`, [swiperId]).catch(() => {});
    }

    // Behavioral learning
    if (isNewSwipe || isActionChange) {
      try {
        if (swipedProf.length > 0) {
          updateSwipePreferences(swiperId, swipedInterests, isSuperLike ? 'like' : action).catch(() => {});
        }
      } catch { /* non-critical */ }
    }

    let matched = false;
    let matchId: string | null = null;

    if (action === 'like' || action === 'super_like') {
      const [user1, user2] = swiperId < swiped_id
        ? [swiperId, swiped_id]
        : [swiped_id, swiperId];

      const { rows: existingMatch } = await db.query<{ id: string; intent?: string }>(
        `SELECT id, intent FROM matches WHERE user1_id = $1 AND user2_id = $2`,
        [user1, user2]
      );

      if (existingMatch.length > 0) {
        matched = true;
        matchId = existingMatch[0].id;
      } else {
        const { rows: mutualLike } = await db.query<{ id: string; intent?: string }>(
          `SELECT id, intent FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action IN ('like', 'super_like')`,
          [swiped_id, swiperId]
        );

        if (mutualLike.length > 0) {
          const newMatchId = crypto.randomUUID();
          // Store snapshot value of the intent active when the match occurred
          const matchIntent = resolvedIntent || mutualLike[0]?.intent || 'dating';

          const { rows: matchRows } = await db.query<{ id: string }>(
            `INSERT INTO matches (id, user1_id, user2_id, intent)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user1_id, user2_id) DO NOTHING
             RETURNING id`,
            [newMatchId, user1, user2, matchIntent]
          );

          if (matchRows.length > 0) {
            matched = true;
            matchId = matchRows[0].id;
          } else {
            const { rows: em } = await db.query<{ id: string }>(
              `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2`,
              [user1, user2]
            );
            if (em.length > 0) {
              matched = true;
              matchId = em[0].id;
            }
          }
        }
      }

      if (isSuperLike) {
        createSuperLikeNotification(swiperId, swiped_id, sharedInterests).catch((err) =>
          console.error('Super Like notification error:', err.message)
        );
      } else {
        createLikeNotification(swiperId, swiped_id).catch((err) =>
          console.error('Notification error:', err.message)
        );
      }
    }

    res.status(200).json({
      success: true,
      data: {
        action,
        intent: resolvedIntent,
        matched,
        match_id: matchId,
        super_like_available: isSuperLike ? false : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
}

export default { recordSwipe };
module.exports = { recordSwipe };
