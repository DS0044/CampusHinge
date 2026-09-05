const { AppError } = require('./errorHandler');

/**
 * Admin role authorization middleware.
 * Must be used AFTER the authenticate middleware.
 */
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Forbidden. Admin access required.', 403));
  }
  next();
}

module.exports = { requireAdmin };
