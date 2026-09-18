const { Router } = require('express');
const { signup, login, verifyOtp, resendOtp, googleAuth } = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { signupSchema, verifyOtpSchema, resendOtpSchema } = require('../validators/auth.schema');
const { otpRateLimiter, resendOtpRateLimiter } = require('../middleware/rateLimiter');

const router = Router();

// POST /api/auth/google — Google Sign-In
router.post('/google', googleAuth);

// POST /api/auth/signup — register with campus email, sends OTP
router.post('/signup', otpRateLimiter, validate(signupSchema), signup);

// POST /api/auth/login — log in with existing campus email, sends OTP
router.post('/login', otpRateLimiter, validate(signupSchema), login);

// POST /api/auth/verify-otp — verify OTP and receive JWT
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);

// POST /api/auth/resend-otp — resend OTP with cooldown and rate limiting
router.post('/resend-otp', resendOtpRateLimiter, validate(resendOtpSchema), resendOtp);

module.exports = router;
