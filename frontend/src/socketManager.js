/**
 * Socket Manager — Singleton WebSocket connection for CampusHinge.
 *
 * Why a singleton? On free-tier hosting (Render, Railway), each new socket
 * connection triggers a cold start (1-5s). Creating a connection per page
 * visit means users wait every time they open a chat. This manager creates
 * ONE connection at login and reuses it everywhere.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - WebSocket-first with polling fallback
 * - Match room join/leave management
 * - Event listener registration/cleanup
 * - Connection state tracking
 */
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:3000';

let socket = null;
let connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
const stateListeners = new Set();
const currentRooms = new Set(); // Track joined match rooms

/**
 * Get or create the singleton socket connection.
 * Call this after login when a JWT token is available.
 */
export function getSocket() {
  if (socket && socket.connected) return socket;

  const token = localStorage.getItem('token');
  if (!token) return null;

  // If socket exists but disconnected, it will auto-reconnect
  if (socket) return socket;

  setConnectionState('connecting');

  socket = io(SOCKET_URL, {
    auth: { token },
    // Optimized for free-tier hosting
    transports: ['websocket', 'polling'], // Try WebSocket first, fall back to polling
    upgrade: true,
    // Reconnection with exponential backoff (critical for cold starts)
    reconnection: true,
    reconnectionAttempts: Infinity, // Never stop trying
    reconnectionDelay: 1000, // Start at 1s
    reconnectionDelayMax: 30000, // Cap at 30s (covers most cold start times)
    randomizationFactor: 0.5, // Add jitter to prevent thundering herd
    // Timeouts
    timeout: 20000, // 20s connection timeout
    // Prevent buffering too many events during disconnection
    // (we'll re-fetch on reconnect instead)
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    setConnectionState('connected');

    // Re-join any match rooms we were in before disconnection
    for (const matchId of currentRooms) {
      socket.emit('join_match', matchId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
    setConnectionState('disconnected');
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log(`🔌 Reconnecting... attempt ${attempt}`);
    setConnectionState('connecting');
  });

  socket.on('reconnect', () => {
    console.log('🔌 Reconnected successfully');
    setConnectionState('connected');
  });

  socket.on('connect_error', (err) => {
    console.warn('🔌 Connection error:', err.message);
    // If auth fails, don't keep trying
    if (err.message === 'Authentication required' || err.message === 'Invalid or expired token') {
      console.warn('🔌 Auth failed — stopping reconnection');
      socket.disconnect();
      socket = null;
      setConnectionState('disconnected');
    }
  });

  return socket;
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
  setConnectionState('disconnected');
}

/**
 * Join a match room for real-time messages.
 */
export function joinMatch(matchId) {
  currentRooms.add(matchId);
  const s = getSocket();
  if (s && s.connected) {
    s.emit('join_match', matchId);
  }
}

/**
 * Leave a match room.
 */
export function leaveMatch(matchId) {
  currentRooms.delete(matchId);
  const s = getSocket();
  if (s && s.connected) {
    s.emit('leave_match', matchId);
  }
}

/**
 * Send a message via WebSocket (fast path — avoids HTTP round-trip).
 * Returns a promise that resolves with the saved message or rejects with an error.
 */
export function sendMessageViaSocket(matchId, content) {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s || !s.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    // Use Socket.io acknowledgement for reliable delivery
    s.emit('send_message', { matchId, content }, (response) => {
      if (response.error) {
        reject(new Error(response.error === 'paywall' ? response.message : response.error));
      } else {
        resolve(response.message);
      }
    });

    // Timeout after 3s — server now ACKs instantly before DB write,
    // so if it takes longer than this, something is genuinely wrong
    setTimeout(() => {
      reject(new Error('Message send timeout'));
    }, 3000);
  });
}

/**
 * Send typing indicator.
 */
export function sendTyping(matchId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('typing', { matchId });
  }
}

/**
 * Send stop typing indicator.
 */
export function sendStopTyping(matchId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('stop_typing', { matchId });
  }
}

/**
 * Subscribe to socket events. Returns an unsubscribe function.
 */
export function onSocketEvent(event, handler) {
  const s = getSocket();
  if (s) {
    s.on(event, handler);
    return () => s.off(event, handler);
  }
  return () => {};
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
  // Immediately call with current state
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
