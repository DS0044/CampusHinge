const env = require('./env');

/**
 * Check whether an email address belongs to an allowed domain.
 * Domains are loaded from the ALLOWED_EMAIL_DOMAINS env var (comma-separated).
 */
function isAllowedDomain(email) {
  if (!email || typeof email !== 'string') return false;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  return env.ALLOWED_EMAIL_DOMAINS.includes(domain);
}

module.exports = { isAllowedDomain };
