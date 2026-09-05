const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Socket.io service — handles real-time messaging.
 *
 * Clients authenticate via a JWT token in the handshake auth object,
 * then join match-specific rooms to receive messages in real time.
 */
function initializeSocket(io) {
  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌  Socket connected: ${socket.user.id}`);

    // Join user's personal room for real-time notifications
    socket.join(`user:${socket.user.id}`);

    // Join a match room for real-time messages
    socket.on('join_match', (matchId) => {
      socket.join(`match:${matchId}`);
      console.log(`   User ${socket.user.id} joined match:${matchId}`);
    });

    // Leave a match room
    socket.on('leave_match', (matchId) => {
      socket.leave(`match:${matchId}`);
    });

    // Typing indicator
    socket.on('typing', ({ matchId }) => {
      socket.to(`match:${matchId}`).emit('user_typing', {
        userId: socket.user.id,
        matchId,
      });
    });

    socket.on('stop_typing', ({ matchId }) => {
      socket.to(`match:${matchId}`).emit('user_stop_typing', {
        userId: socket.user.id,
        matchId,
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌  Socket disconnected: ${socket.user.id}`);
    });
  });
}

module.exports = { initializeSocket };
