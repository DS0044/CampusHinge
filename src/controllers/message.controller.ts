import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from '../config/db';
import { AppError } from '../middleware/errorHandler';

/**
 * Helper: verify the current user is a participant in the given match.
 * Returns the match row or throws.
 */
export async function verifyMatchParticipant(matchId: string, userId: string): Promise<any> {
  const { rows } = await db.query(
    `SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [matchId, userId]
  );

  if (rows.length === 0) {
    throw new AppError('Match not found or you are not a participant.', 404);
  }

  return rows[0];
}

/**
 * GET /api/messages/:matchId
 * Get message history for a match, paginated.
 * Query params: ?limit=50&before=<messageId>
 */
export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { matchId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const before = req.query.before as string | undefined;

    // Verify participation
    await verifyMatchParticipant(matchId, userId);

    let queryText: string;
    let params: unknown[];

    if (before) {
      const { rows: cursorRows } = await db.query<{ created_at: string }>(
        `SELECT created_at FROM messages WHERE id = $1`,
        [before]
      );

      if (cursorRows.length === 0) {
        throw new AppError('Invalid pagination cursor.', 400);
      }

      queryText = `SELECT id, match_id, sender_id, content, created_at
               FROM messages
               WHERE match_id = $1 AND created_at < $2
               ORDER BY created_at DESC
               LIMIT $3`;
      params = [matchId, cursorRows[0].created_at, limit];
    } else {
      queryText = `SELECT id, match_id, sender_id, content, created_at
               FROM messages
               WHERE match_id = $1
               ORDER BY created_at DESC
               LIMIT $2`;
      params = [matchId, limit];
    }

    // Fetch match info & partner profile info
    const { rows: matchRows } = await db.query<{
      match_id: string;
      is_unlocked: number | boolean;
      partner_id?: string;
      partner_name?: string;
      partner_photos?: string;
    }>(
      `SELECT
         m.id AS match_id,
         m.is_unlocked,
         p.user_id AS partner_id,
         p.name AS partner_name,
         p.photos AS partner_photos
       FROM matches m
       JOIN profiles p ON p.user_id = CASE
         WHEN m.user1_id = $1 THEN m.user2_id
         ELSE m.user1_id
       END
       WHERE m.id = $2`,
      [userId, matchId]
    );

    const matchDetails = matchRows[0] || {};
    let partnerPhoto: string | null = null;
    if (matchDetails.partner_photos) {
      try {
        const photos = JSON.parse(matchDetails.partner_photos);
        partnerPhoto = Array.isArray(photos) && photos.length > 0 ? photos[0] : null;
      } catch {
        partnerPhoto = null;
      }
    }

    const { rows: userRows } = await db.query<{
      subscription_status: string;
      subscription_expiry: string | null;
    }>(
      `SELECT subscription_status, subscription_expiry FROM users WHERE id = $1`,
      [userId]
    );
    const user = userRows[0];
    const isSubscribed = Boolean(
      user &&
      user.subscription_status === 'active' &&
      user.subscription_expiry &&
      new Date(user.subscription_expiry) > new Date()
    );

    const { rows: messages } = await db.query(queryText, params);

    res.status(200).json({
      success: true,
      data: {
        match: {
          id: matchId,
          partner_id: matchDetails.partner_id || null,
          partner_name: matchDetails.partner_name || 'Campus Match',
          partner_photo: partnerPhoto,
          is_unlocked: Boolean(matchDetails.is_unlocked || isSubscribed),
        },
        messages: messages.reverse(),
        has_more: messages.length === limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/messages/:matchId
 * Send a message in a match.
 */
export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { matchId } = req.params;
    const { content } = req.body;

    const match = await verifyMatchParticipant(matchId, userId);

    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const { rows: messageRows } = await db.query(
      `INSERT INTO messages (id, match_id, sender_id, content, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, match_id, sender_id, content, created_at`,
      [messageId, matchId, userId, content, createdAt]
    );

    const message = messageRows[0];

    const recipientId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const nowIso = new Date().toISOString();

    const { rows: existingNotif } = await db.query<{ id: string }>(
      `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`,
      [recipientId, userId]
    );

    let notifId: string;
    if (existingNotif.length > 0) {
      notifId = existingNotif[0].id;
      await db.query(
        `UPDATE notifications
         SET type = 'message', is_read = 0, is_seen = 0, created_at = $1
         WHERE id = $2`,
        [nowIso, notifId]
      );
    } else {
      notifId = crypto.randomUUID();
      await db.query(
        `INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at)
         VALUES ($1, $2, $3, 'message', $4)`,
        [notifId, recipientId, userId, nowIso]
      );
    }

    const io = req.app.get('io');
    if (io) {
      const senderSockets = io.sockets.sockets;
      let senderSocket: any = null;
      for (const [, s] of senderSockets) {
        if ((s as any).user && (s as any).user.id === userId) {
          senderSocket = s;
          break;
        }
      }

      if (senderSocket) {
        senderSocket.to(`match:${matchId}`).emit('new_message', message);
      } else {
        io.to(`match:${matchId}`).emit('new_message', message);
      }

      io.to(`user:${recipientId}`).emit('notification', {
        id: notifId,
        type: 'message',
        from_user_id: userId,
        match_id: matchId,
        created_at: message.created_at,
      });

      try {
        const { rows: unreadRows } = await db.query<{ unread_count: string | number }>(
          `SELECT COUNT(*) AS unread_count FROM notifications WHERE to_user_id = $1 AND is_read = 0`,
          [recipientId]
        );
        io.to(`user:${recipientId}`).emit('unread_count', {
          unread_count: parseInt(String(unreadRows[0]?.unread_count || 0), 10),
        });
      } catch {
        // Non-critical
      }
    }

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (err) {
    next(err);
  }
}

export default { getMessages, sendMessage, verifyMatchParticipant };
module.exports = { getMessages, sendMessage, verifyMatchParticipant };
