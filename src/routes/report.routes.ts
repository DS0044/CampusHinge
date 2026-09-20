import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { reportSchema } from '../validators/report.schema';
import { reportUser } from '../controllers/report.controller';

const router = Router();

router.use(authenticate);

// POST /api/report — report a user
router.post('/', validate(reportSchema), reportUser);

export default router;
module.exports = router;
