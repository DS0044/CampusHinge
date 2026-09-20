import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { blockSchema } from '../validators/report.schema';
import { blockUser, unblockUser } from '../controllers/block.controller';

const router = Router();

router.use(authenticate);

// POST /api/block — block a user
router.post('/', validate(blockSchema), blockUser);

// DELETE /api/block/:userId — unblock a user
router.delete('/:userId', unblockUser);

export default router;
module.exports = router;
