import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendMessageSchema } from '../validators/message.schema';
import { getMessages, sendMessage } from '../controllers/message.controller';

const router = Router();

router.use(authenticate);

// GET /api/messages/:matchId — get message history
router.get('/:matchId', getMessages);

// POST /api/messages/:matchId — send a message
router.post('/:matchId', validate(sendMessageSchema), sendMessage);

export default router;
module.exports = router;
