import { Request, Response, NextFunction } from 'express';
import db from '../config/db';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user, ordered by most recent first.
 */
export async function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const { rows: notifications } = await db.query<{
      id: string;
      type: string;
      metadata?: string | Record<string, any>;
      is_seen: number | boolean;
      is_read: number | boolean;
      created_at: string;
      from_user_id: string;
      from_user_name?: string;
      from_user_photos?: string | string[];
      match_id?: string | null;
    }>(
      `SELECT
         n.id,
         n.type,
         n.metadata,
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
       ORDER BY (CASE WHEN n.type = 'super_like' AND n.is_read = 0 THEN 0 WHEN n.type = 'super_like' THEN 1 ELSE 2 END), n.created_at DESC`,
      [userId]
    );

    // Deduplicate notifications per sender
    const seenFromUsers = new Set<string>();
    const uniqueNotifications: typeof notifications = [];
    const duplicateIdsToDelete: string[] = [];

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
      let firstPhoto: string | null = null;
      if (n.from_user_photos) {
        try {
          const photos = typeof n.from_user_photos === 'string' ? JSON.parse(n.from_user_photos) : n.from_user_photos;
          if (Array.isArray(photos) && photos.length > 0) {
            firstPhoto = photos[0];
          }
        } catch {
          firstPhoto = null;
        }
      }

      const isMatched = Boolean(n.match_id);
      let meta: any = {};
      try {
        meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {});
      } catch { meta = {}; }

      const isSuperLike = n.type === 'super_like';
      const senderName = n.from_user_name || 'Campus Student';

      return {
        id: n.id,
        type: n.type,
        metadata: meta,
        shared_interests: meta.shared_interests || [],
        shared_interests_count: meta.shared_count || (meta.shared_interests ? meta.shared_interests.length : 0),
        is_seen: Boolean(n.is_seen),
        is_read: Boolean(n.is_read),
        created_at: n.created_at,
        from_user_id: n.from_user_id,
        from_user_name: isMatched || n.type === 'message' || isSuperLike ? senderName : 'Someone',
        real_name: senderName,
        from_user_photo: firstPhoto,
        match_id: n.match_id || null,
        is_matched: isMatched,
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
export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const { rows } = await db.query<{ unread_count: string | number }>(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE to_user_id = $1 AND is_read = 0`,
      [userId]
    );

    const unreadCount = parseInt(String(rows[0]?.unread_count || 0), 10);

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
export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
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
export async function markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

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
export async function getGatedProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const { targetUserId } = req.params;

    // 1. Fetch target user's profile
    const { rows: profileRows } = await db.query<{
      user_id: string;
      name: string;
      bio?: string | null;
      photos: string | string[];
      year?: number | null;
      gender: string;
      interests: string | string[];
    }>(
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
    let photos: string[] = [];
    let interests: string[] = [];
    try { photos = typeof rawProfile.photos === 'string' ? JSON.parse(rawProfile.photos) : rawProfile.photos || []; } catch { photos = []; }
    try { interests = typeof rawProfile.interests === 'string' ? JSON.parse(rawProfile.interests) : rawProfile.interests || []; } catch { interests = []; }

    // 2. Check if mutual match exists
    const { rows: matchRows } = await db.query<{ id: string }>(
      `SELECT id FROM matches
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [currentUserId, targetUserId]
    );
    const hasMatched = matchRows.length > 0;
    const matchId = matchRows[0]?.id || null;

    // 3. Check if current user has an active subscription
    const { rows: userRows } = await db.query<{
      subscription_status: string;
      subscription_expiry: string | null;
    }>(
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

    // 4. Compute shared interests
    const { rows: myProfileRows } = await db.query<{ interests: string | string[] }>(
      `SELECT interests FROM profiles WHERE user_id = $1`,
      [currentUserId]
    );
    let myInterests: string[] = [];
    try { myInterests = typeof myProfileRows[0]?.interests === 'string' ? JSON.parse(myProfileRows[0].interests) : myProfileRows[0]?.interests || []; } catch {}
    const sharedInterests = Array.isArray(interests) && Array.isArray(myInterests)
      ? interests.filter((i) => myInterests.includes(i))
      : [];

    if (isUnlocked) {
      res.status(200).json({
        success: true,
        data: {
          profile: {
            user_id: rawProfile.user_id,
            name: rawProfile.name,
            bio: rawProfile.bio,
            primary_photo: photos[0] || null,
            photos,
            year: rawProfile.year,
            gender: rawProfile.gender,
            interests,
            shared_interests: sharedInterests,
            is_locked: false,
            has_matched: hasMatched,
            match_id: matchId,
            is_subscribed: isSubscribed,
          },
        },
      });
      return;
    }

    // Gated/Locked View: only return primary photo and display name
    res.status(200).json({
      success: true,
      data: {
        profile: {
          user_id: rawProfile.user_id,
          name: 'Someone',
          primary_photo: photos[0] || null,
          photos: [photos[0] || null],
          interests: [],
          shared_interests: sharedInterests,
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

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getGatedProfile,
};
module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getGatedProfile,
};
