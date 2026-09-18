/**
 * CampusHinge API — Cloudflare Worker Entry Point
 *
 * Hono framework replaces Express.js.
 * D1 replaces better-sqlite3.
 * Durable Objects replace Socket.io.
 * R2 replaces S3/local file storage.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveR2Object } from './services/r2.js';

// Import route modules
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import discoverRoutes from './routes/discover.js';
import swipeRoutes from './routes/swipe.js';
import matchRoutes from './routes/match.js';
import messageRoutes from './routes/message.js';
import subscriptionRoutes from './routes/subscription.js';
import notificationRoutes from './routes/notification.js';
import reportRoutes from './routes/report.js';
import blockRoutes from './routes/block.js';
import adminRoutes from './routes/admin.js';
import devRoutes from './routes/dev.js';

// Import Durable Object
export { ChatRoom } from './durable-objects/ChatRoom.js';

// ── Create Hono App ──
const app = new Hono();

// ── Global Middleware ──
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature'],
}));

// ── Health Check ──
app.get('/health', (c) => {
  return c.json({
    success: true,
    message: 'CampusHinge API is running on Cloudflare Workers',
    timestamp: new Date().toISOString(),
    runtime: 'cloudflare-workers',
  });
});

// ── API Routes ──
app.route('/api/auth', authRoutes);
app.route('/api/profile', profileRoutes);
app.route('/api/discover', discoverRoutes);
app.route('/api/swipe', swipeRoutes);
app.route('/api/matches', matchRoutes);
app.route('/api/messages', messageRoutes);
app.route('/api/subscribe', subscriptionRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/report', reportRoutes);
app.route('/api/block', blockRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/dev', devRoutes);

// ── R2 CDN — serve uploaded photos ──
app.get('/cdn/*', async (c) => {
  const key = c.req.path.replace('/cdn/', '');
  return serveR2Object(c.env.R2, key);
});

// ── WebSocket Upgrade → Durable Object ──
app.get('/ws/chat', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }

  // Route to a single ChatRoom Durable Object (for now, one global room)
  // In production, you'd route per-match: c.env.CHAT_ROOM.get(matchId)
  const id = c.env.CHAT_ROOM.idFromName('global-chat');
  const stub = c.env.CHAT_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

// ── 404 Handler ──
app.notFound((c) => {
  return c.json({ success: false, error: { message: 'Route not found' } }, 404);
});

// ── Global Error Handler ──
app.onError((err, c) => {
  console.error('❌ Unhandled error:', err.message, err.stack);
  const status = err.status || 500;
  return c.json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  }, status);
});

export default app;
