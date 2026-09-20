const { z } = require('zod');

const sendMessageSchema = z.object({
  content: z
    .string({ required_error: 'Message content is required' })
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be at most 2000 characters')
    .trim(),
});

module.exports = { sendMessageSchema };
