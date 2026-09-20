const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { swipeSchema } = require('../validators/swipe.schema');
const { recordSwipe } = require('../controllers/swipe.controller');

const router = Router();

router.use(authenticate);

// POST /api/swipe — like or pass on a profile
router.post('/', validate(swipeSchema), recordSwipe);

module.exports = router;
