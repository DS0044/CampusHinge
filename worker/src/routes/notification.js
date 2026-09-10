/**
 * Notification Routes
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const notification = new Hono();
notification.use('/*', authenticate());

// GET /api/notifications
notification.get('/', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;

  const { rows: notifications } = await query(db,
    `SELECT n.id, n.type, n.metadata, n.is_seen, n.is_read, n.created_at, n.from_user_id,
            p.name AS from_user_name, p.photos AS from_user_photos, m.id AS match_id
     FROM notifications n
     JOIN profiles p ON p.user_id = n.from_user_id
     JOIN users u ON u.id = n.from_user_id
     LEFT JOIN matches m ON ((m.user1_id = $1 AND m.user2_id = n.from_user_id) OR (m.user1_id = n.from_user_id AND m.user2_id = $1))
     WHERE n.to_user_id = $1 AND u.is_banned = 0
     ORDER BY (CASE WHEN n.type = 'super_like' AND n.is_read = 0 THEN 0 WHEN n.type = 'super_like' THEN 1 ELSE 2 END), n.created_at DESC`,
    [userId]
  );

  // Deduplicate per sender
  const seen = new Set();
  const unique = [];
  for (const n of notifications) {
    if (!seen.has(n.from_user_id)) { seen.add(n.from_user_id); unique.push(n); }
  }

  const formatted = unique.map(n => {
    let firstPhoto = null;
    if (n.from_user_photos) {
      try { const p = typeof n.from_user_photos === 'string' ? JSON.parse(n.from_user_photos) : n.from_user_photos;
        if (Array.isArray(p) && p.length > 0) firstPhoto = p[0]; } catch {}
    }
    const isMatched = Boolean(n.match_id);
    let meta = {};
    try { meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {}); } catch {}

    const isSuperLike = n.type === 'super_like';
    const senderName = n.from_user_name || 'Campus Student';

    return {
      id: n.id, type: n.type,
      metadata: meta,
      shared_interests: meta.shared_interests || [],
      shared_interests_count: meta.shared_count || (meta.shared_interests ? meta.shared_interests.length : 0),
      is_seen: Boolean(n.is_seen), is_read: Boolean(n.is_read),
      created_at: n.created_at, from_user_id: n.from_user_id,
      from_user_name: isMatched || n.type === 'message' || isSuperLike ? senderName : 'Someone',
      real_name: senderName,
      from_user_photo: firstPhoto, match_id: n.match_id || null, is_matched: isMatched,
    };
  });

  return c.json({ success: true, data: { notifications: formatted } });
});

// GET /api/notifications/unread-count
notification.get('/unread-count', async (c) => {
  const userId = c.get('user').id;
  const { rows } = await query(c.env.DB, `SELECT COUNT(*) AS unread_count FROM notifications WHERE to_user_id = $1 AND is_read = 0`, [userId]);
  return c.json({ success: true, data: { unread_count: parseInt(rows[0]?.unread_count || 0) } });
});

// PATCH /api/notifications/:id/read
notification.patch('/:id/read', async (c) => {
  const userId = c.get('user').id;
  const id = c.req.param('id');
  await query(c.env.DB, `UPDATE notifications SET is_read = 1, is_seen = 1 WHERE id = $1 AND to_user_id = $2`, [id, userId]);
  return c.json({ success: true, message: 'Notification marked as read.' });
});

// PATCH /api/notifications/read-all
notification.patch('/read-all', async (c) => {
  const userId = c.get('user').id;
  await query(c.env.DB, `UPDATE notifications SET is_read = 1, is_seen = 1 WHERE to_user_id = $1`, [userId]);
  return c.json({ success: true, message: 'All notifications marked as read.' });
});

// GET /api/notifications/gated-profile/:targetUserId
notification.get('/gated-profile/:targetUserId', async (c) => {
  const currentUserId = c.get('user').id;
  const targetUserId = c.req.param('targetUserId');
  const db = c.env.DB;

  const { rows: profileRows } = await query(db,
    `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interests
     FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 AND u.is_banned = 0`,
    [targetUserId]
  );
  if (profileRows.length === 0) return c.json({ success: false, error: { message: 'Profile not found.' } }, 404);

  const raw = profileRows[0];
  let photos = [], interests = [];
  try { photos = typeof raw.photos === 'string' ? JSON.parse(raw.photos) : raw.photos || []; } catch {}
  try { interests = typeof raw.interests === 'string' ? JSON.parse(raw.interests) : raw.interests || []; } catch {}

  const { rows: matchRows } = await query(db,
    `SELECT id FROM matches WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
    [currentUserId, targetUserId]
  );
  const hasMatched = matchRows.length > 0;
  const matchId = matchRows[0]?.id || null;

  const { rows: userRows } = await query(db, `SELECT subscription_status, subscription_expiry FROM users WHERE id = $1`, [currentUserId]);
  const cu = userRows[0];
  const isSub = Boolean(cu && cu.subscription_status === 'active' && cu.subscription_expiry && new Date(cu.subscription_expiry) > new Date());
  const isUnlocked = hasMatched || isSub;

  if (isUnlocked) {
    return c.json({ success: true, data: { profile: {
      user_id: raw.user_id, name: raw.name, bio: raw.bio, photos, year: raw.year, gender: raw.gender,
      interests, is_locked: false, has_matched: hasMatched, match_id: matchId, is_subscribed: isSub,
    } } });
  }

  return c.json({ success: true, data: { profile: {
    user_id: raw.user_id, name: 'Someone', primary_photo: photos[0] || null, photos: [photos[0] || null],
    is_locked: true, has_matched: false, match_id: null, is_subscribed: false,
  } } });
});

export default notification;
