const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createProfileSchema, presignedUrlSchema } = require('../validators/profile.schema');
const {
  createOrUpdateProfile,
  getMyProfile,
  getProfileById,
  getUploadUrl,
  uploadPhoto,
} = require('../controllers/profile.controller');

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// POST /api/profile — create or update profile
router.post('/', validate(createProfileSchema), createOrUpdateProfile);

// GET /api/profile — get own profile
router.get('/', getMyProfile);

// GET /api/profile/:userId — get another user's public profile
router.get('/:userId', getProfileById);

// POST /api/profile/upload-url — get presigned S3 upload URL
router.post('/upload-url', validate(presignedUrlSchema), getUploadUrl);

// POST /api/profile/upload — direct photo upload handler
router.post('/upload', uploadPhoto);

module.exports = router;
