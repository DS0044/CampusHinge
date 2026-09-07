/**
 * Match Routes — list matches
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const match = new Hono();
match.use('/*', authenticate());

// GET /api/matches
match.get('/', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;

  const { rows: matches } = await query(db,
    `SELECT
       m.id AS match_id, m.is_unlocked, m.created_at AS matched_at,
       p.user_id, p.name, p.photos, p.bio,
       (SELECT content FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message,
       (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
     FROM matches m
     JOIN profiles p ON p.user_id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
     JOIN users u ON u.id = p.user_id
     WHERE (m.user1_id = $1 OR m.user2_id = $1) AND u.is_banned = 0
     ORDER BY last_message_at DESC NULLS LAST, m.created_at DESC`,
    [userId]
  );

  return c.json({ success: true, data: { matches } });
});

export default match;
