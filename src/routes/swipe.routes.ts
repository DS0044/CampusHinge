import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { swipeSchema } from '../validators/swipe.schema';
import { recordSwipe } from '../controllers/swipe.controller';

const router = Router();

router.use(authenticate);

// POST /api/swipe — like or pass on a profile
router.post('/', validate(swipeSchema), recordSwipe);

export default router;
module.exports = router;
