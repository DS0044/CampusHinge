const rateLimit = require('express-rate-limit');

/**
 * OTP-specific rate limiter.
 * Max 5 OTP requests per email per 5-minute window.
 * Only limits the OTP *request* endpoint — does NOT block /verify-otp.
 */
const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (was 15)
  max: 5, // allow 5 attempts per window (was 3)
  keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many OTP requests. Please try again after 5 minutes.',
    },
  },
  handler: (req, res, _next, options) => {
    console.warn(`⚠️  [RATE LIMIT] OTP request blocked for: ${req.body?.email || req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Resend OTP rate limiter: max 5 resend attempts per email per 1-hour window.
 */
const resendOtpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.body?.email?.toLowerCase()?.trim() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many OTP resend requests. Please try again after 1 hour.',
      retryAfter: 3600,
    },
  },
  handler: (req, res, _next, options) => {
    console.warn(`⚠️  [RATE LIMIT] OTP resend blocked for: ${req.body?.email || req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * General API rate limiter — generous default for profile setup, photo uploads, and swiping.
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 2000 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests. Please try again later.',
    },
  },
});

module.exports = { otpRateLimiter, resendOtpRateLimiter, apiRateLimiter };
