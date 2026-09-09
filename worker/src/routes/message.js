/**
 * Message Routes — get/send messages for matched users
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const message = new Hono();
message.use('/*', authenticate());

async function verifyMatchParticipant(db, matchId, userId) {
  const { rows } = await query(db,
    `SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`, [matchId, userId]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

// GET /api/messages/:matchId
message.get('/:matchId', async (c) => {
  const userId = c.get('user').id;
  const matchId = c.req.param('matchId');
  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const before = c.req.query('before');

  const matchRow = await verifyMatchParticipant(db, matchId, userId);
  if (!matchRow) return c.json({ success: false, error: { message: 'Match not found or you are not a participant.' } }, 404);

  let messages;
  if (before) {
    const { rows: cursor } = await query(db, `SELECT created_at FROM messages WHERE id = $1`, [before]);
    if (cursor.length === 0) return c.json({ success: false, error: { message: 'Invalid pagination cursor.' } }, 400);
    const { rows } = await query(db,
      `SELECT id, match_id, sender_id, content, created_at FROM messages WHERE match_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT $3`,
      [matchId, cursor[0].created_at, limit]
    );
    messages = rows;
  } else {
    const { rows } = await query(db,
      `SELECT id, match_id, sender_id, content, created_at FROM messages WHERE match_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [matchId, limit]
    );
    messages = rows;
  }

  // Get partner info
  const { rows: matchInfo } = await query(db,
    `SELECT p.name AS partner_name, p.photos AS partner_photos
     FROM profiles p WHERE p.user_id = CASE WHEN $1 = (SELECT user1_id FROM matches WHERE id = $2) THEN (SELECT user2_id FROM matches WHERE id = $2) ELSE (SELECT user1_id FROM matches WHERE id = $2) END`,
    [userId, matchId]
  );

  const details = matchInfo[0] || {};
  let partnerPhoto = null;
  if (details.partner_photos) {
    try { const p = JSON.parse(details.partner_photos); partnerPhoto = Array.isArray(p) && p.length > 0 ? p[0] : null; } catch {}
  }

  return c.json({
    success: true,
    data: {
      match: { id: matchId, partner_name: details.partner_name || 'Campus Match', partner_photo: partnerPhoto, is_unlocked: true },
      messages: messages.reverse(),
      has_more: messages.length === limit,
    },
  });
});

// POST /api/messages/:matchId
message.post('/:matchId', async (c) => {
  const userId = c.get('user').id;
  const matchId = c.req.param('matchId');
  const { content } = await c.req.json();
  const db = c.env.DB;

  const matchRow = await verifyMatchParticipant(db, matchId, userId);
  if (!matchRow) return c.json({ success: false, error: { message: 'Match not found.' } }, 404);

  // No message limit — matched users can chat freely

  const messageId = crypto.randomUUID();
  await query(db,
    `INSERT INTO messages (id, match_id, sender_id, content) VALUES ($1, $2, $3, $4)`,
    [messageId, matchId, userId, content]
  );

  // Fetch the created message
  const { rows: msgRows } = await query(db,
    `SELECT id, match_id, sender_id, content, created_at FROM messages WHERE id = $1`, [messageId]
  );
  const msg = msgRows[0];

  // Create/update notification for recipient
  const recipientId = matchRow.user1_id === userId ? matchRow.user2_id : matchRow.user1_id;
  const nowIso = new Date().toISOString();
  const { rows: existingNotif } = await query(db,
    `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`, [recipientId, userId]
  );

  if (existingNotif.length > 0) {
    await query(db, `UPDATE notifications SET type = 'message', is_read = 0, is_seen = 0, created_at = $1 WHERE id = $2`,
      [nowIso, existingNotif[0].id]);
  } else {
    const notifId = crypto.randomUUID();
    await query(db, `INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at) VALUES ($1, $2, $3, 'message', $4)`,
      [notifId, recipientId, userId, nowIso]);
  }

  return c.json({ success: true, data: { message: msg } }, 201);
});

export default message;
