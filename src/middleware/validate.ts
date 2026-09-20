import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from './errorHandler';

/**
 * Factory that returns Express middleware to validate req.body against a Zod schema.
 * Usage: router.post('/path', validate(myZodSchema), controller);
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const messages = result.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      return next(new AppError(`Validation failed: ${messages.join('; ')}`, 422));
    }

    // Replace with parsed/coerced data
    req[source] = result.data;
    next();
  };
}

export default { validate };
module.exports = { validate };
