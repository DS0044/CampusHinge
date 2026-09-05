const { Router } = require('express');
const { signup, login, verifyOtp } = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { signupSchema, verifyOtpSchema } = require('../validators/auth.schema');
const { otpRateLimiter } = require('../middleware/rateLimiter');

const router = Router();

// POST /api/auth/signup — register with campus email, sends OTP
router.post('/signup', otpRateLimiter, validate(signupSchema), signup);

// POST /api/auth/login — log in with existing campus email, sends OTP
router.post('/login', otpRateLimiter, validate(signupSchema), login);

// POST /api/auth/verify-otp — verify OTP and receive JWT
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);

module.exports = router;
