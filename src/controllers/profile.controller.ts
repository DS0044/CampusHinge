import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { UploadedFile } from 'express-fileupload';
import db from '../config/db';
import { getPresignedUploadUrl } from '../services/s3.service';
import { AppError } from '../middleware/errorHandler';

/**
 * POST /api/profile
 * Create or update the authenticated user's profile (upsert).
 */
export async function createOrUpdateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { name, bio, photos, year, gender, interested_in, interests, email_notifications } = req.body;

    let photoArray: string[] = [];
    if (Array.isArray(photos)) {
      photoArray = photos;
    } else if (typeof photos === 'string') {
      try { photoArray = JSON.parse(photos); } catch { photoArray = []; }
    }

    if (!Array.isArray(photoArray) || photoArray.length < 2 || photoArray.length > 6) {
      throw new AppError('Profile must have between 2 and 6 photos.', 400);
    }

    const profileId = crypto.randomUUID();

    const { rows } = await db.query(
      `INSERT INTO profiles (id, user_id, name, bio, photos, year, gender, interested_in, interests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         name = EXCLUDED.name,
         bio = EXCLUDED.bio,
         photos = EXCLUDED.photos,
         year = EXCLUDED.year,
         gender = EXCLUDED.gender,
         interested_in = EXCLUDED.interested_in,
         interests = EXCLUDED.interests,
         updated_at = datetime('now')
       RETURNING *`,
      [
        profileId,
        userId,
        name,
        bio || null,
        JSON.stringify(photoArray),
        year || null,
        gender,
        interested_in,
        typeof interests === 'string' ? interests : JSON.stringify(interests || []),
      ]
    );

    await db.query(
      `UPDATE users SET profile_completed = 1, updated_at = datetime('now') WHERE id = $1`,
      [userId]
    );

    if (typeof email_notifications === 'boolean') {
      await db.query(
        `UPDATE users SET email_notifications = $1 WHERE id = $2`,
        [email_notifications ? 1 : 0, userId]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Profile saved successfully.',
      data: { profile: { ...rows[0], profile_completed: true } },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/profile
 * Get the authenticated user's own profile.
 */
export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const { rows } = await db.query(
      `SELECT p.*, u.email, u.subscription_status, u.email_notifications, u.profile_completed
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      throw new AppError('User account no longer exists. Please sign in again.', 401);
    }

    const row = rows[0];

    if (!row.id) {
      res.status(200).json({
        success: true,
        data: {
          profile: null,
          has_profile: false,
          profile_completed: false,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        profile: {
          ...row,
          has_profile: true,
          profile_completed: Boolean(row.profile_completed),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/profile/:userId
 * Get another user's public profile (limited fields).
 */
export async function getProfileById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;

    const { rows } = await db.query(
      `SELECT p.id, p.user_id, p.name, p.bio, p.photos, p.year, p.gender, p.interests
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1 AND u.is_banned = false`,
      [userId]
    );

    if (rows.length === 0) {
      throw new AppError('Profile not found.', 404);
    }

    const row = rows[0];
    let photos: string[] = [];
    try { photos = typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos || []; } catch {}
    let interests: string[] = [];
    try { interests = typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests || []; } catch {}

    res.status(200).json({
      success: true,
      data: { profile: { ...row, photos, interests } },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/profile/upload
 * Direct single or multi-photo upload handler.
 */
export async function uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    if (!req.files) {
      throw new AppError('No photo file uploaded.', 400);
    }

    const rawFiles = req.files.photos || req.files.photo;
    if (!rawFiles) {
      throw new AppError('No photo file uploaded.', 400);
    }

    const fileList: UploadedFile[] = Array.isArray(rawFiles) ? rawFiles : [rawFiles];

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const savedUrls: string[] = [];

    const userDir = path.join(__dirname, `../../uploads/${userId}`);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    for (const photo of fileList) {
      if (photo.size > MAX_FILE_SIZE) {
        throw new AppError(`File "${photo.name}" exceeds 5MB size limit.`, 400);
      }
      if (!ALLOWED_MIME_TYPES.includes(photo.mimetype)) {
        throw new AppError(`File "${photo.name}" format is not supported. Use JPG, PNG, or WEBP.`, 400);
      }

      const ext = path.extname(photo.name) || '.jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const filePath = path.join(userDir, filename);

      await photo.mv(filePath);
      const publicUrl = `http://localhost:3000/uploads/${userId}/${filename}`;
      savedUrls.push(publicUrl);
    }

    res.status(200).json({
      success: true,
      data: {
        url: savedUrls[0],
        urls: savedUrls,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/profile/upload-url
 * Generate a presigned S3 URL for direct client-side photo upload.
 */
export async function getUploadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { filename, content_type } = req.body;

    const { uploadUrl, key } = await getPresignedUploadUrl(userId, filename, content_type);

    res.status(200).json({
      success: true,
      data: { upload_url: uploadUrl, key },
    });
  } catch (err) {
    next(err);
  }
}

export default { createOrUpdateProfile, getMyProfile, getProfileById, getUploadUrl, uploadPhoto };
module.exports = { createOrUpdateProfile, getMyProfile, getProfileById, getUploadUrl, uploadPhoto };
