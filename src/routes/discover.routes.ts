import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDiscoverDeck } from '../controllers/discover.controller';

const router = Router();

router.use(authenticate);

// GET /api/discover — get swipeable deck of profiles
router.get('/', getDiscoverDeck);

export default router;
module.exports = router;
