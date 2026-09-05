const { z } = require('zod');

const swipeSchema = z.object({
  swiped_id: z
    .string({ required_error: 'swiped_id is required' })
    .uuid('swiped_id must be a valid UUID'),
  action: z.enum(['like', 'pass'], {
    required_error: 'Action is required',
    invalid_type_error: 'Action must be "like" or "pass"',
  }),
});

module.exports = { swipeSchema };
