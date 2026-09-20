const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getMatches } = require('../controllers/match.controller');

const router = Router();

router.use(authenticate);

// GET /api/matches — list current user's matches
router.get('/', getMatches);

module.exports = router;
