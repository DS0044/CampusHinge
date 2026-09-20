import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { getReports, reviewReport, banUser, unbanUser } from '../controllers/admin.controller';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/reports — list reports
router.get('/reports', getReports);

// POST /api/admin/reports/:reportId/review — review a report
router.post('/reports/:reportId/review', reviewReport);

// POST /api/admin/ban/:userId — ban a user
router.post('/ban/:userId', banUser);

// POST /api/admin/unban/:userId — unban a user
router.post('/unban/:userId', unbanUser);

export default router;
module.exports = router;
