import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProfileSchema, updateIntentSchema, presignedUrlSchema } from '../validators/profile.schema';
import {
  createOrUpdateProfile,
  updateActiveIntent,
  getMyProfile,
  getProfileById,
  getUploadUrl,
  uploadPhoto,
} from '../controllers/profile.controller';

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// POST /api/profile — create or update profile
router.post('/', validate(createProfileSchema), createOrUpdateProfile);

// PATCH /api/profile/intent — update user active intent
router.patch('/intent', validate(updateIntentSchema), updateActiveIntent);

// GET /api/profile — get own profile
router.get('/', getMyProfile);

// GET /api/profile/:userId — get another user's public profile
router.get('/:userId', getProfileById);

// POST /api/profile/upload-url — get presigned S3 upload URL
router.post('/upload-url', validate(presignedUrlSchema), getUploadUrl);

// POST /api/profile/upload — direct photo upload handler
router.post('/upload', uploadPhoto);

export default router;
module.exports = router;
