const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendMessageSchema } = require('../validators/message.schema');
const { getMessages, sendMessage } = require('../controllers/message.controller');

const router = Router();

router.use(authenticate);

// GET /api/messages/:matchId — get message history
router.get('/:matchId', getMessages);

// POST /api/messages/:matchId — send a message (paywall enforced)
router.post('/:matchId', validate(sendMessageSchema), sendMessage);

module.exports = router;
