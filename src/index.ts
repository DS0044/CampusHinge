import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import fileUpload from 'express-fileupload';
import env from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import discoverRoutes from './routes/discover.routes';
import swipeRoutes from './routes/swipe.routes';
import matchRoutes from './routes/match.routes';
import messageRoutes from './routes/message.routes';
import subscriptionRoutes from './routes/subscription.routes';
import reportRoutes from './routes/report.routes';
import blockRoutes from './routes/block.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';
import devRoutes from './routes/dev.routes';
import { initializeSocket } from './services/socket.service';

// ── Express app ──
export const app = express();
export const server = http.createServer(app);

// ── Socket.io — optimized for free-tier hosting ──
export const io = new SocketServer(server, {
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
initializeSocket(io);

// ── Start server ──
if (require.main === module) {
  server.listen(env.PORT, () => {
    console.log(`🚀  CampusApp API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

export default { app, server, io };
module.exports = { app, server, io };
