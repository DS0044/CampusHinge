/**
 * Socket Manager — Socket.IO Client
 *
 * Uses socket.io-client to connect to the Socket.IO server.
 * The server uses Socket.IO (not raw WebSocket), so we MUST use
 * the matching client library for the handshake, framing, and
 * event system to work correctly.
 *
 * Public API (unchanged for rest of frontend):
 *   getSocket, initSocket, destroySocket,
 *   joinMatch, leaveMatch, sendMessageViaSocket,
 *   sendTyping, sendStopTyping,
 *   onSocketEvent, onConnectionStateChange, getConnectionState
 */

import { io } from 'socket.io-client';

// Derive the Socket.IO server URL from the API URL
// Socket.IO connects to the server root (not /ws/chat)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const SERVER_URL = API_URL.replace(/\/api\/?$/, '') || 'http://localhost:3000';

let socket = null;
let connectionState = 'disconnected';
const stateListeners = new Set();
const eventListeners = new Map(); // event → Set<handler>
const currentRooms = new Set();

/**
 * Get the singleton socket instance.
 */
export function getSocket() {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('token');
  if (!token) return null;

  if (socket?.connecting) return socket;

  connect(token);
  return socket;
}

function connect(token) {
  if (socket?.connected || socket?.connecting) return;

  // Disconnect any stale socket
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  setConnectionState('connecting');

  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket.IO connected:', socket.id);
    setConnectionState('connected');

    // Re-join any match rooms we were in
    for (const matchId of currentRooms) {
      socket.emit('join_match', matchId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.IO disconnected:', reason);
    setConnectionState('disconnected');
  });

  socket.on('connect_error', (err) => {
    console.warn('🔌 Socket.IO connect error:', err.message);
    setConnectionState('disconnected');
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log(`🔌 Reconnecting (attempt ${attempt})...`);
    setConnectionState('connecting');
  });

  socket.io.on('reconnect', () => {
    console.log('🔌 Reconnected!');
    setConnectionState('connected');
  });

  // ── Forward all server events to our event listener system ──

  // New message from chat partner
  socket.on('new_message', (msg) => {
    dispatchToListeners('new_message', msg);
  });

  // Typing indicators
  socket.on('user_typing', (data) => {
    dispatchToListeners('user_typing', data);
  });

  socket.on('user_stop_typing', (data) => {
    dispatchToListeners('user_stop_typing', data);
  });

  // Notifications
  socket.on('notification', (data) => {
    dispatchToListeners('notification', data);
  });

  // Unread count updates
  socket.on('unread_count', (data) => {
    dispatchToListeners('unread_count', data);
  });

  // Message ACK (for sendMessageViaSocket)
  socket.on('message_ack', (data) => {
    dispatchToListeners('message_ack', data);
  });

  // Error events
  socket.on('error', (data) => {
    dispatchToListeners('error', data);
  });
}

function dispatchToListeners(event, data) {
  const handlers = eventListeners.get(event);
  if (handlers) {
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error('Event handler error:', e);
      }
    }
  }
}

/**
 * Initialize socket connection (call after login).
 */
export function initSocket() {
  return getSocket();
}

/**
 * Disconnect and clean up (call on logout).
 */
export function destroySocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentRooms.clear();
  eventListeners.clear();
  setConnectionState('disconnected');
}

/**
 * Join a match room for real-time messages.
 */
export function joinMatch(matchId) {
  currentRooms.add(matchId);
  if (socket?.connected) {
    socket.emit('join_match', matchId);
  }
}

/**
 * Leave a match room.
 */
export function leaveMatch(matchId) {
  currentRooms.delete(matchId);
  if (socket?.connected) {
    socket.emit('leave_match', matchId);
  }
}

/**
 * Send a message via Socket.IO (fast path — avoids HTTP round-trip).
 * Returns a promise that resolves with the saved message or rejects on error.
 */
export function sendMessageViaSocket(matchId, content) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Message send timeout'));
    }, 5000);

    // Socket.IO supports acknowledgement callbacks
    socket.emit('send_message', { matchId, content }, (response) => {
      clearTimeout(timeout);
      if (response?.error) {
        reject(new Error(response.error));
      } else if (response?.message) {
        resolve(response.message);
      } else if (response?.success && response?.message) {
        resolve(response.message);
      } else {
        // If server doesn't use callback pattern, resolve with response
        resolve(response);
      }
    });
  });
}

/**
 * Send typing indicator.
 */
export function sendTyping(matchId) {
  if (socket?.connected) {
    socket.emit('typing', { matchId });
  }
}

/**
 * Send stop typing indicator.
 */
export function sendStopTyping(matchId) {
  if (socket?.connected) {
    socket.emit('stop_typing', { matchId });
  }
}

/**
 * Subscribe to socket events. Returns an unsubscribe function.
 */
export function onSocketEvent(event, handler) {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event).add(handler);
  return () => {
    const handlers = eventListeners.get(event);
    if (handlers) handlers.delete(handler);
  };
}

/**
 * Get current connection state.
 */
export function getConnectionState() {
  return connectionState;
}

/**
 * Subscribe to connection state changes. Returns unsubscribe function.
 */
export function onConnectionStateChange(listener) {
  stateListeners.add(listener);
  listener(connectionState);
  return () => stateListeners.delete(listener);
}

function setConnectionState(state) {
  connectionState = state;
  for (const listener of stateListeners) {
    try {
      listener(state);
    } catch (e) {
      console.error('State listener error:', e);
    }
  }
}
