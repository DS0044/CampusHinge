const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { resetSwipes, resetAllSwipes } = require('../controllers/dev.controller');

const router = Router();

// Dev endpoints for resetting test data
router.post('/reset-swipes', authenticate, resetSwipes);
router.post('/reset-swipes/:userId', authenticate, resetSwipes);
router.post('/reset-all-swipes', resetAllSwipes);

module.exports = router;
