const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * Helper: verify the current user is a participant in the given match.
 * Returns the match row or throws.
 */
async function verifyMatchParticipant(matchId, userId) {
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
async function getMessages(req, res, next) {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before; // cursor-based pagination

    // Verify participation
    await verifyMatchParticipant(matchId, userId);

    let query;
    let params;

    if (before) {
      // Get the created_at of the cursor message
      const { rows: cursorRows } = await db.query(
        `SELECT created_at FROM messages WHERE id = $1`,
        [before]
      );

      if (cursorRows.length === 0) {
        throw new AppError('Invalid pagination cursor.', 400);
      }

      query = `SELECT id, match_id, sender_id, content, created_at
               FROM messages
               WHERE match_id = $1 AND created_at < $2
               ORDER BY created_at DESC
               LIMIT $3`;
      params = [matchId, cursorRows[0].created_at, limit];
    } else {
      query = `SELECT id, match_id, sender_id, content, created_at
               FROM messages
               WHERE match_id = $1
               ORDER BY created_at DESC
               LIMIT $2`;
      params = [matchId, limit];
    }

    // Fetch match info & partner profile info
    const { rows: matchRows } = await db.query(
      `SELECT
         m.id AS match_id,
         m.is_unlocked,
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
    let partnerPhoto = null;
    if (matchDetails.partner_photos) {
      try {
        const photos = JSON.parse(matchDetails.partner_photos);
        partnerPhoto = Array.isArray(photos) && photos.length > 0 ? photos[0] : null;
      } catch (e) {
        partnerPhoto = null;
      }
    }

    const { rows: userRows } = await db.query(
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

    const { rows: messages } = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: {
        match: {
          id: matchId,
          partner_name: matchDetails.partner_name || 'Campus Match',
          partner_photo: partnerPhoto,
          is_unlocked: Boolean(matchDetails.is_unlocked || isSubscribed),
        },
        messages: messages.reverse(), // Return in chronological order
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
 * Chat is free and unlimited for all matched users.
 */
async function sendMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;
    const { content } = req.body;

    // Verify participation
    const match = await verifyMatchParticipant(matchId, userId);

    // No message limit — matched users can chat freely

    const crypto = require('crypto');
    const messageId = crypto.randomUUID();

    // ── Send the message ──
    const { rows: messageRows } = await db.query(
      `INSERT INTO messages (id, match_id, sender_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, match_id, sender_id, content, created_at`,
      [messageId, matchId, userId, content]
    );

    const message = messageRows[0];

    // ── Create or update notification for recipient (1 notification per sender) ──
    const recipientId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const nowIso = new Date().toISOString();

    const { rows: existingNotif } = await db.query(
      `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`,
      [recipientId, userId]
    );

    let notifId;
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

    // Emit via Socket.io for real-time delivery & notification
    // Use socket.to() to emit only to OTHER participants (not the sender)
    const io = req.app.get('io');
    if (io) {
      // Get the sender's socket to exclude them from the broadcast
      const senderSockets = io.sockets.sockets;
      let senderSocket = null;
      for (const [, s] of senderSockets) {
        if (s.user && s.user.id === userId) {
          senderSocket = s;
          break;
        }
      }

      if (senderSocket) {
        // Emit to match room EXCLUDING the sender
        senderSocket.to(`match:${matchId}`).emit('new_message', message);
      } else {
        // Sender not connected via socket — broadcast to entire room
        io.to(`match:${matchId}`).emit('new_message', message);
      }

      // Always send notification to recipient's personal room
      io.to(`user:${recipientId}`).emit('notification', {
        id: notifId,
        type: 'message',
        from_user_id: userId,
        match_id: matchId,
        created_at: message.created_at,
      });

      // Push updated unread count to recipient
      try {
        const { rows: unreadRows } = await db.query(
          `SELECT COUNT(*) AS unread_count FROM notifications WHERE to_user_id = $1 AND is_read = 0`,
          [recipientId]
        );
        io.to(`user:${recipientId}`).emit('unread_count', {
          unread_count: parseInt(unreadRows[0]?.unread_count || 0, 10),
        });
      } catch (e) {
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

module.exports = { getMessages, sendMessage };
