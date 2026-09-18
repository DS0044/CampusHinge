const env = require('./env');
const { isEmailAllowed, ALLOWLIST } = require('../validators/auth.schema');

/**
 * Check whether an email address belongs to an allowed domain/rule or manual exception.
 * Checks ALLOWED_EXTRA_EMAILS first, then multi-rule allowlist, then falls back to env.ALLOWED_EMAIL_DOMAINS if set.
 */
function isAllowedDomain(email) {
  if (!email || typeof email !== 'string') return false;

  const cleanEmail = email.trim().toLowerCase();

  // Manually approved exception (e.g. for personal testing) — not meant to scale;
  // future requests for more exceptions should go through the ALLOWED_EXTRA_EMAILS env var list.
  const allowedExtraEmails = env.ALLOWED_EXTRA_EMAILS || (process.env.ALLOWED_EXTRA_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // 3a. If the email exactly matches an entry in ALLOWED_EXTRA_EMAILS -> allow
  if (allowedExtraEmails.includes(cleanEmail)) {
    return true;
  }

  // 3b. Else if the email's domain matches one of the existing allowed college domains -> allow (existing logic, untouched)
  if (isEmailAllowed(cleanEmail)) {
    return true;
  }

  const domain = cleanEmail.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  if (env.ALLOWED_EMAIL_DOMAINS?.includes(domain)) {
    return true;
  }

  // 3c. Else -> reject
  return false;
}

module.exports = { isAllowedDomain, isEmailAllowed, ALLOWLIST };

