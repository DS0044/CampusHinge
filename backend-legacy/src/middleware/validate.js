const { AppError } = require('./errorHandler');

/**
 * Factory that returns Express middleware to validate req.body against a Zod schema.
 * Usage: router.post('/path', validate(myZodSchema), controller);
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} source - Which part of the request to validate
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
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

module.exports = { validate };
