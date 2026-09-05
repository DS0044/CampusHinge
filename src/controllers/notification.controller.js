const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user, ordered by most recent first.
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;

    const { rows: notifications } = await db.query(
      `SELECT
         n.id,
         n.type,
         n.is_seen,
         n.is_read,
         n.created_at,
         n.from_user_id,
         p.name AS from_user_name,
         p.photos AS from_user_photos,
         m.id AS match_id
       FROM notifications n
       JOIN profiles p ON p.user_id = n.from_user_id
       JOIN users u ON u.id = n.from_user_id
       LEFT JOIN matches m ON ((m.user1_id = $1 AND m.user2_id = n.from_user_id) OR (m.user1_id = n.from_user_id AND m.user2_id = $1))
       WHERE n.to_user_id = $1 AND u.is_banned = false
       ORDER BY n.created_at DESC`,
      [userId]
    );

    // Deduplicate notifications per sender (keep only most recent per from_user_id)
    const seenFromUsers = new Set();
    const uniqueNotifications = [];
    const duplicateIdsToDelete = [];

    for (const n of notifications) {
      if (!seenFromUsers.has(n.from_user_id)) {
        seenFromUsers.add(n.from_user_id);
        uniqueNotifications.push(n);
      } else {
        duplicateIdsToDelete.push(n.id);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      db.query(
        `DELETE FROM notifications WHERE id IN (${duplicateIdsToDelete.map((_, i) => `$${i + 1}`).join(',')})`,
        duplicateIdsToDelete
      ).catch(() => {});
    }

    const formatted = uniqueNotifications.map((n) => {
      let firstPhoto = null;
      if (n.from_user_photos) {
        try {
          const photos = typeof n.from_user_photos === 'string' ? JSON.parse(n.from_user_photos) : n.from_user_photos;
          if (Array.isArray(photos) && photos.length > 0) {
            firstPhoto = photos[0];
          }
        } catch (e) {
          firstPhoto = null;
        }
      }

      return {
        id: n.id,
        type: n.type,
        is_seen: Boolean(n.is_seen),
        is_read: Boolean(n.is_read),
        created_at: n.created_at,
        from_user_id: n.from_user_id,
        from_user_name: n.from_user_name || 'Campus Student',
        from_user_photo: firstPhoto,
        match_id: n.match_id || null,
      };
    });

    res.status(200).json({
      success: true,
      data: { notifications: formatted },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notifications/unread-count
 * Returns unread notification count.
 */
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE to_user_id = $1 AND is_read = 0`,
      [userId]
    );

    const unreadCount = parseInt(rows[0]?.unread_count || 0, 10);

    res.status(200).json({
      success: true,
      data: { unread_count: unreadCount },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read & seen.
 */
async function markAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await db.query(
      `UPDATE notifications SET is_read = 1, is_seen = 1 WHERE id = $1 AND to_user_id = $2`,
      [id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read & seen for the user.
 */
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications SET is_read = 1, is_seen = 1 WHERE to_user_id = $1`,
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notifications/gated-profile/:targetUserId
 * Returns profile details for a liker with freemium gating rules:
 * - If mutual match exists OR user is subscribed → is_locked = false (full profile).
 * - Otherwise → is_locked = true (only display name & primary photo, rest hidden/locked).
 */
async function getGatedProfile(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const { targetUserId } = req.params;

    // 1. Fetch target user's profile
    const { rows: profileRows } = await db.query(
      `SELECT p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interests
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1 AND u.is_banned = false`,
      [targetUserId]
    );

    if (profileRows.length === 0) {
      throw new AppError('Profile not found.', 404);
    }

    const rawProfile = profileRows[0];
    let photos = [];
    let interests = [];
    try { photos = typeof rawProfile.photos === 'string' ? JSON.parse(rawProfile.photos) : rawProfile.photos || []; } catch { photos = []; }
    try { interests = typeof rawProfile.interests === 'string' ? JSON.parse(rawProfile.interests) : rawProfile.interests || []; } catch { interests = []; }

    // 2. Check if mutual match exists
    const { rows: matchRows } = await db.query(
      `SELECT id FROM matches
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [currentUserId, targetUserId]
    );
    const hasMatched = matchRows.length > 0;
    const matchId = matchRows[0]?.id || null;

    // 3. Check if current user has an active subscription
    const { rows: userRows } = await db.query(
      `SELECT subscription_status, subscription_expiry FROM users WHERE id = $1`,
      [currentUserId]
    );

    const currentUser = userRows[0];
    const isSubscribed = Boolean(
      currentUser &&
      currentUser.subscription_status === 'active' &&
      currentUser.subscription_expiry &&
      new Date(currentUser.subscription_expiry) > new Date()
    );

    const isUnlocked = hasMatched || isSubscribed;

    if (isUnlocked) {
      return res.status(200).json({
        success: true,
        data: {
          profile: {
            user_id: rawProfile.user_id,
            name: rawProfile.name,
            bio: rawProfile.bio,
            photos,
            year: rawProfile.year,
            gender: rawProfile.gender,
            interests,
            is_locked: false,
            has_matched: hasMatched,
            match_id: matchId,
            is_subscribed: isSubscribed,
          },
        },
      });
    }

    // Gated/Locked View: only return primary photo and display name
    res.status(200).json({
      success: true,
      data: {
        profile: {
          user_id: rawProfile.user_id,
          name: rawProfile.name,
          primary_photo: photos[0] || null,
          photos: [photos[0] || null],
          is_locked: true,
          has_matched: false,
          match_id: null,
          is_subscribed: false,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getGatedProfile,
};
