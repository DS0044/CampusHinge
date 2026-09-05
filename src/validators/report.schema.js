const { z } = require('zod');

const reportSchema = z.object({
  reported_id: z
    .string({ required_error: 'reported_id is required' })
    .uuid('reported_id must be a valid UUID'),
  reason: z
    .string({ required_error: 'Reason is required' })
    .min(5, 'Reason must be at least 5 characters')
    .max(1000, 'Reason must be at most 1000 characters')
    .trim(),
});

const blockSchema = z.object({
  blocked_id: z
    .string({ required_error: 'blocked_id is required' })
    .uuid('blocked_id must be a valid UUID'),
});

module.exports = { reportSchema, blockSchema };
