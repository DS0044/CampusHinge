const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server: SocketServer } = require('socket.io');
const path = require('path');
const fileUpload = require('express-fileupload');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { apiRateLimiter } = require('./middleware/rateLimiter');

// ── Express app ──
const app = express();
const server = http.createServer(app);

// ── Socket.io — optimized for free-tier hosting ──
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  // Free-tier optimization: keep connections alive before platform idle timeout (e.g. Render's 30s)
  pingInterval: 25000,
  pingTimeout: 20000,
  // Start with WebSocket, fall back to polling if upgrade fails
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  // Limit memory usage on free tier
  maxHttpBufferSize: 1e6, // 1MB max per message
  // Connection state recovery — clients can reconnect and catch up on missed events
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: false,
  },
});

// Make io accessible in routes/controllers
app.set('io', io);

// ── Global middleware ──
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(fileUpload({ createParentPath: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/cdn/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(apiRateLimiter);

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'CampusApp API is running', timestamp: new Date().toISOString() });
});

// ── API routes ──
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const discoverRoutes = require('./routes/discover.routes');
const swipeRoutes = require('./routes/swipe.routes');
const matchRoutes = require('./routes/match.routes');
const messageRoutes = require('./routes/message.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const reportRoutes = require('./routes/report.routes');
const blockRoutes = require('./routes/block.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const devRoutes = require('./routes/dev.routes');

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/swipe', swipeRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscribe', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dev', devRoutes);

// ── 404 handler ──
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: 'Route not found' } });
});

// ── Error handler (must be last) ──
app.use(errorHandler);

// ── Initialize Socket.io ──
const { initializeSocket } = require('./services/socket.service');
initializeSocket(io);

// ── Start server ──
if (require.main === module) {
  server.listen(env.PORT, () => {
    console.log(`🚀  CampusApp API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

module.exports = { app, server, io };

