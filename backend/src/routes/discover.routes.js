const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getDiscoverDeck } = require('../controllers/discover.controller');

const router = Router();

router.use(authenticate);

// GET /api/discover — get swipeable deck of profiles
router.get('/', getDiscoverDeck);

module.exports = router;
