const env = require('./env');
const { isEmailAllowed, ALLOWLIST } = require('../validators/auth.schema');

/**
 * Check whether an email address belongs to an allowed domain/rule.
 * Checks multi-rule allowlist first, then falls back to env.ALLOWED_EMAIL_DOMAINS if set.
 */
function isAllowedDomain(email) {
  if (!email || typeof email !== 'string') return false;

  if (isEmailAllowed(email)) {
    return true;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  return env.ALLOWED_EMAIL_DOMAINS?.includes(domain) || false;
}

module.exports = { isAllowedDomain, isEmailAllowed, ALLOWLIST };

