const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { blockSchema } = require('../validators/report.schema');
const { blockUser, unblockUser } = require('../controllers/block.controller');

const router = Router();

router.use(authenticate);

// POST /api/block — block a user
router.post('/', validate(blockSchema), blockUser);

// DELETE /api/block/:userId — unblock a user
router.delete('/:userId', unblockUser);

module.exports = router;
