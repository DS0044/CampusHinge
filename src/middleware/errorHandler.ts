import { Request, Response, NextFunction } from 'express';

/**
 * Custom operational error class for expected, handleable errors.
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: Record<string, unknown> | null;

  constructor(message: string, statusCode = 400, details: Record<string, unknown> | null = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (details && typeof details === 'object') {
      this.details = details;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware.
 * Catches all errors thrown/next(err) in routes and returns a consistent JSON shape.
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
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
      ...(err.details || {}),
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

export default { errorHandler, AppError };
module.exports = { errorHandler, AppError };
