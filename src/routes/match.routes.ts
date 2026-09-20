import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMatches } from '../controllers/match.controller';

const router = Router();

router.use(authenticate);

// GET /api/matches — list current user's matches
router.get('/', getMatches);

export default router;
module.exports = router;
