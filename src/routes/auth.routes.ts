import { Router } from 'express';
import { signup, login, verifyOtp, resendOtp, googleAuth } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { signupSchema, verifyOtpSchema, resendOtpSchema } from '../validators/auth.schema';
import { otpRateLimiter, resendOtpRateLimiter } from '../middleware/rateLimiter';

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

export default router;
module.exports = router;
