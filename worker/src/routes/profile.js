/**
 * Profile Routes — CRUD + photo upload
 */
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { uploadToR2 } from '../services/r2.js';
import { INTENTS } from '../constants/intent.constants.js';

const profile = new Hono();
profile.use('/*', authenticate());

// POST /api/profile — Create or update profile (upsert)
profile.post('/', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, bio, photos, branch, year, gender, interested_in, interests, activity_tags, active_intent, email_notifications } = body;

  let photoArray = [];
  if (Array.isArray(photos)) photoArray = photos;
  else if (typeof photos === 'string') { try { photoArray = JSON.parse(photos); } catch { photoArray = []; } }

  if (!Array.isArray(photoArray) || photoArray.length < 2 || photoArray.length > 6) {
    return c.json({ success: false, error: { message: 'Profile must have between 2 and 6 photos.' } }, 400);
  }

  const profileId = crypto.randomUUID();
  const { rows } = await query(db,
    `INSERT INTO profiles (id, user_id, name, bio, photos, branch, year, gender, interested_in, interests, activity_tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, bio = EXCLUDED.bio, photos = EXCLUDED.photos, branch = EXCLUDED.branch,
       year = EXCLUDED.year, gender = EXCLUDED.gender, interested_in = EXCLUDED.interested_in,
       interests = EXCLUDED.interests, activity_tags = EXCLUDED.activity_tags, updated_at = datetime('now')
     RETURNING *`,
    [
      profileId,
      userId,
      name,
      bio || null,
      JSON.stringify(photoArray),
      branch || null,
      year || null,
      gender,
      interested_in,
      typeof interests === 'string' ? interests : JSON.stringify(interests || []),
      typeof activity_tags === 'string' ? activity_tags : JSON.stringify(activity_tags || []),
    ]
  );

  await query(db, `UPDATE users SET profile_completed = 1, updated_at = datetime('now') WHERE id = $1`, [userId]);

  if (active_intent && INTENTS.includes(active_intent)) {
    await query(db, `UPDATE users SET active_intent = $1, updated_at = datetime('now') WHERE id = $2`, [active_intent, userId]);
  }

  if (typeof email_notifications === 'boolean') {
    await query(db, `UPDATE users SET email_notifications = $1 WHERE id = $2`, [email_notifications ? 1 : 0, userId]);
  }

  const savedProfile = rows[0] || {};
  let resPhotos = [];
  try { resPhotos = typeof savedProfile.photos === 'string' ? JSON.parse(savedProfile.photos) : savedProfile.photos || []; } catch {}
  let resInterests = [];
  try { resInterests = typeof savedProfile.interests === 'string' ? JSON.parse(savedProfile.interests) : savedProfile.interests || []; } catch {}
  let resActivityTags = [];
  try { resActivityTags = typeof savedProfile.activity_tags === 'string' ? JSON.parse(savedProfile.activity_tags) : savedProfile.activity_tags || []; } catch {}

  return c.json({
    success: true,
    message: 'Profile saved successfully.',
    data: {
      profile: {
        ...savedProfile,
        photos: resPhotos,
        interests: resInterests,
        activity_tags: resActivityTags,
        active_intent: active_intent || 'dating',
        profile_completed: true,
      },
    },
  });
});

// PATCH /api/profile/intent — update user's active intent
profile.patch('/intent', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;
  const body = await c.req.json();
  const { active_intent } = body;

  if (!active_intent || !INTENTS.includes(active_intent)) {
    return c.json({ success: false, error: { message: `Active intent must be one of: ${INTENTS.join(', ')}` } }, 400);
  }

  await query(db, `UPDATE users SET active_intent = $1, updated_at = datetime('now') WHERE id = $2`, [active_intent, userId]);

  return c.json({
    success: true,
    message: 'Active intent updated successfully.',
    data: { active_intent },
  });
});

// GET /api/profile — Get my profile
profile.get('/', async (c) => {
  const userId = c.get('user').id;
  const db = c.env.DB;

  const { rows } = await query(db,
    `SELECT p.*, u.email, COALESCE(u.active_intent, 'dating') AS active_intent, u.subscription_status, u.email_notifications, u.profile_completed
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [userId]
  );

  if (rows.length === 0) return c.json({ success: false, error: { message: 'User account no longer exists.' } }, 401);

  const row = rows[0];
  if (!row.id) {
    return c.json({ success: true, data: { profile: null, has_profile: false, profile_completed: false } });
  }

  let photos = [];
  try { photos = typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos || []; } catch {}
  let interests = [];
  try { interests = typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests || []; } catch {}
  let activity_tags = [];
  try { activity_tags = typeof row.activity_tags === 'string' ? JSON.parse(row.activity_tags) : row.activity_tags || []; } catch {}

  return c.json({
    success: true,
    data: {
      profile: {
        ...row,
        photos,
        interests,
        activity_tags,
        active_intent: row.active_intent || 'dating',
        has_profile: true,
        profile_completed: Boolean(row.profile_completed),
      },
    },
  });
});

// GET /api/profile/:userId — Get another user's profile
profile.get('/:userId', async (c) => {
  const { userId } = c.req.param();
  const db = c.env.DB;

  const { rows } = await query(db,
    `SELECT p.id, p.user_id, p.name, p.bio, p.photos, p.branch, p.year, p.gender, p.interests, p.activity_tags, COALESCE(u.active_intent, 'dating') AS active_intent
     FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 AND u.is_banned = 0`,
    [userId]
  );

  if (rows.length === 0) return c.json({ success: false, error: { message: 'Profile not found.' } }, 404);

  const row = rows[0];
  let photos = [];
  try { photos = typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos || []; } catch {}
  let interests = [];
  try { interests = typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests || []; } catch {}
  let activity_tags = [];
  try { activity_tags = typeof row.activity_tags === 'string' ? JSON.parse(row.activity_tags) : row.activity_tags || []; } catch {}

  return c.json({
    success: true,
    data: { profile: { ...row, photos, interests, activity_tags } },
  });
});

// POST /api/profile/upload — Direct photo upload to R2
profile.post('/upload', async (c) => {
  const userId = c.get('user').id;
  const r2 = c.env.R2;

  const formData = await c.req.formData();
  let files = formData.getAll('photos');
  if (!files || files.length === 0) {
    files = formData.getAll('photo');
  }

  if (!files || files.length === 0) {
    return c.json({ success: false, error: { message: 'No photo file uploaded.' } }, 400);
  }

  const MAX_SIZE = 5 * 1024 * 1024;
  const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const savedUrls = [];

  for (const file of files) {
    if (file.size > MAX_SIZE) return c.json({ success: false, error: { message: `File exceeds 5MB limit.` } }, 400);
    if (!ALLOWED.includes(file.type)) return c.json({ success: false, error: { message: `Unsupported format. Use JPG, PNG, or WEBP.` } }, 400);

    const { key } = await uploadToR2(r2, userId, file.name, await file.arrayBuffer(), file.type);
    savedUrls.push(`/cdn/${key}`);
  }

  return c.json({ success: true, data: { url: savedUrls[0], urls: savedUrls } });
});

export default profile;
