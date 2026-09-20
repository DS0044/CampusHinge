import { z } from 'zod';
import { INTENTS } from '../constants/intent.constants';

export const swipeSchema = z.object({
  swiped_id: z
    .string({ required_error: 'swiped_id is required' })
    .uuid('swiped_id must be a valid UUID'),
  action: z.enum(['like', 'pass', 'super_like'], {
    required_error: 'Action is required',
    invalid_type_error: 'Action must be "like", "pass", or "super_like"',
  }),
  intent: z
    .enum(INTENTS, {
      invalid_type_error: 'intent must be dating, friendship, study, activity, or networking',
    })
    .optional(),
});

export default { swipeSchema };
module.exports = { swipeSchema };

