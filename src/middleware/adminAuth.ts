import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Admin role authorization middleware.
 * Must be used AFTER the authenticate middleware.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Forbidden. Admin access required.', 403));
  }
  next();
}

export default { requireAdmin };
module.exports = { requireAdmin };
