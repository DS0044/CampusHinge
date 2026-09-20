const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { reportSchema } = require('../validators/report.schema');
const { reportUser } = require('../controllers/report.controller');

const router = Router();

router.use(authenticate);

// POST /api/report — report a user
router.post('/', validate(reportSchema), reportUser);

module.exports = router;
