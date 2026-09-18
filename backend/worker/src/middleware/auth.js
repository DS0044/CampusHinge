/**
 * JWT Authentication Middleware for Hono (Cloudflare Workers).
 *
 * Uses the `jose` library instead of `jsonwebtoken` because jose works
 * with the Web Crypto API (no Node.js crypto dependency).
 */
import { jwtVerify } from 'jose';

/**
 * Hono middleware: verifies Bearer token and sets c.set('user', decoded).
 */
export function authenticate() {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: { message: 'Authentication required. Provide a Bearer token.' } }, 401);
    }

    const token = authHeader.split(' ')[1];

    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      c.set('user', payload);
      await next();
    } catch (err) {
      if (err.code === 'ERR_JWT_EXPIRED') {
        return c.json({ success: false, error: { message: 'Token expired. Please log in again.' } }, 401);
      }
      return c.json({ success: false, error: { message: 'Invalid token.' } }, 401);
    }
  };
}

/**
 * Admin-only middleware. Must be used AFTER authenticate().
 */
export function adminOnly() {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || user.role !== 'admin') {
      return c.json({ success: false, error: { message: 'Admin access required.' } }, 403);
    }
    await next();
  };
}
