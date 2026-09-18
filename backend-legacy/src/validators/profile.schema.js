const { z } = require('zod');

const createProfileSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  bio: z
    .string()
    .max(500, 'Bio must be at most 500 characters')
    .trim()
    .optional()
    .nullable(),
  photos: z
    .array(z.string().min(1))
    .min(2, 'At least 2 photos are required')
    .max(6, 'Maximum 6 photos allowed'),
  year: z
    .number()
    .int()
    .min(2000, 'Year must be 2000 or later')
    .max(2035, 'Year must be 2035 or earlier')
    .optional()
    .nullable(),
  gender: z.enum(['male', 'female', 'non_binary'], {
    required_error: 'Gender is required',
    invalid_type_error: 'Gender must be male, female, or non_binary',
  }),
  interested_in: z.enum(['male', 'female', 'everyone'], {
    required_error: 'Interested in is required',
    invalid_type_error: 'Interested in must be male, female, or everyone',
  }),
  interests: z
    .array(
      z.string().min(1).max(50).trim()
    )
    .max(20, 'Maximum 20 interests allowed')
    .optional()
    .default([]),
});

const presignedUrlSchema = z.object({
  filename: z
    .string({ required_error: 'Filename is required' })
    .min(1, 'Filename cannot be empty'),
  content_type: z
    .string({ required_error: 'Content type is required' })
    .regex(/^image\/(jpeg|jpg|png|webp|heic)$/, 'Only image files are allowed (jpeg, png, webp, heic)'),
});

module.exports = { createProfileSchema, presignedUrlSchema };
