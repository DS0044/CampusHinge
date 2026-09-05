/**
 * Global error handling middleware.
 * Catches all errors thrown/next(err) in routes and returns a consistent JSON shape.
 */
function errorHandler(err, _req, res, _next) {
  // Log full error in dev
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌  Error:', err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

/**
 * Custom operational error class for expected, handleable errors.
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, AppError };
