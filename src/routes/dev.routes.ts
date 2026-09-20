import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resetSwipes, resetAllSwipes } from '../controllers/dev.controller';

const router = Router();

// Dev endpoints for resetting test data
router.post('/reset-swipes', authenticate, resetSwipes);
router.post('/reset-swipes/:userId', authenticate, resetSwipes);
router.post('/reset-all-swipes', resetAllSwipes);

export default router;
module.exports = router;
