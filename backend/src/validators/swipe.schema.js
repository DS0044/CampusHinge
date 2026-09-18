const { z } = require('zod');

const swipeSchema = z.object({
  swiped_id: z
    .string({ required_error: 'swiped_id is required' })
    .uuid('swiped_id must be a valid UUID'),
  action: z.enum(['like', 'pass', 'super_like'], {
    required_error: 'Action is required',
    invalid_type_error: 'Action must be "like", "pass", or "super_like"',
  }),
});

module.exports = { swipeSchema };
