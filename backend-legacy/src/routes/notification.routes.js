const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getGatedProfile,
} = require('../controllers/notification.controller');

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /api/notifications — fetch notifications list
router.get('/', getNotifications);

// GET /api/notifications/unread-count — fetch unread badge count
router.get('/unread-count', getUnreadCount);

// GET /api/notifications/gated-profile/:targetUserId — fetch gated/unlocked profile
router.get('/gated-profile/:targetUserId', getGatedProfile);

// PATCH /api/notifications/read-all — mark all notifications as read
router.patch('/read-all', markAllAsRead);

// PATCH /api/notifications/:id/read — mark single notification as read
router.patch('/:id/read', markAsRead);

module.exports = router;
