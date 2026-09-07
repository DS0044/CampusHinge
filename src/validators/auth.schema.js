const { z } = require('zod');

const ALLOWLIST = [
  { type: 'exact_domain', value: 'vitbhopal.ac.in' },
  { type: 'exact_email', value: 'international@LNCTU.ac.in' },
  { type: 'exact_domain', value: 'lpu.co.in' },
  { type: 'wildcard_subdomain', value: 'bits-pilani.ac.in' },
];

/**
 * Check whether an email address is allowed based on the allowlist rules:
 * - exact_email: full email must match exactly
 * - exact_domain: domain after @ must match exactly
 * - wildcard_subdomain: domain after @ must equal the value OR end with "." + value
 *
 * @param {string} email
 * @param {Array<{ type: string, value: string }>} [list=ALLOWLIST]
 * @returns {boolean}
 */
function isEmailAllowed(email, list = ALLOWLIST) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const cleanEmail = email.trim().toLowerCase();
  const atIndex = cleanEmail.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== cleanEmail.indexOf('@') || atIndex === cleanEmail.length - 1) {
    return false;
  }

  const domain = cleanEmail.slice(atIndex + 1);

  for (const rule of list) {
    if (!rule || !rule.type || !rule.value) continue;
    const ruleValue = rule.value.trim().toLowerCase();

    switch (rule.type) {
      case 'exact_email': {
        if (cleanEmail === ruleValue) {
          return true;
        }
        break;
      }
      case 'exact_domain': {
        if (domain === ruleValue) {
          return true;
        }
        break;
      }
      case 'wildcard_subdomain': {
        if (domain === ruleValue || domain.endsWith('.' + ruleValue)) {
          return true;
        }
        break;
      }
      default:
        break;
    }
  }

  return false;
}

const signupSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .transform((v) => v.toLowerCase().trim())
    .refine((val) => isEmailAllowed(val), {
      message: "This email isn't eligible for verification",
    }),
});

const verifyOtpSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .transform((v) => v.toLowerCase().trim()),
  code: z
    .string({ required_error: 'OTP code is required' })
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

module.exports = {
  ALLOWLIST,
  allowlist: ALLOWLIST,
  isEmailAllowed,
  signupSchema,
  verifyOtpSchema,
};

