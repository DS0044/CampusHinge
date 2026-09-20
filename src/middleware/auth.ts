import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { AppError } from './errorHandler';
import { AuthUser } from '../types/express';

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Sets req.user = { id, email, role, subscription_status, ... }
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Provide a Bearer token.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;

    req.user = decoded;
    next();
  } catch (err: any) {
    if (err instanceof AppError) return next(err);
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please log in again.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token.', 401));
    }
    next(err);
  }
}

export default { authenticate };
module.exports = { authenticate };
