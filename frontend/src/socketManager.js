/**
 * Socket Manager — Native WebSocket for Cloudflare Workers/Durable Objects.
 *
 * Replaces Socket.io with native WebSocket API.
 * Uses the same public interface (getSocket, joinMatch, etc.) so the rest
 * of the frontend doesn't need to change.
 *
 * Protocol:
 *   Client → Server: JSON { type, matchId, content, token }
 *   Server → Client: JSON { type, message, userId }
 */

const WS_URL = import.meta.env.VITE_WS_URL
  || (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, '').replace(/^http/, 'ws') + '/ws/chat'
    : 'ws://localhost:8787/ws/chat');

let ws = null;
let connectionState = 'disconnected';
const stateListeners = new Set();
const eventListeners = new Map(); // event → Set<handler>
const currentRooms = new Set();
let reconnectAttempts = 0;
let reconnectTimer = null;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Get or create the singleton WebSocket connection.
 */
export function getSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;

  const token = localStorage.getItem('token');
  if (!token) return null;

  if (ws && (ws.readyState === WebSocket.CONNECTING)) return ws;

  connect(token);
  return ws;
}

function connect(token) {
  if (ws && ws.readyState <= WebSocket.OPEN) return;

  setConnectionState('connecting');

  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.warn('🔌 WebSocket creation failed:', err.message);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('🔌 WebSocket connected');
    setConnectionState('connected');
    reconnectAttempts = 0;

    // Re-join any match rooms
    for (const matchId of currentRooms) {
      ws.send(JSON.stringify({ type: 'join', matchId, token }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      dispatchEvent(data.type, data);
    } catch (err) {
      console.error('🔌 Failed to parse message:', err);
    }
  };

  ws.onclose = (event) => {
    console.log('🔌 WebSocket disconnected:', event.code, event.reason);
    setConnectionState('disconnected');

    if (event.code === 4001 || event.code === 4003) {
      console.warn('🔌 Auth failed — not reconnecting');
      ws = null;
      return;
    }

    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.warn('🔌 WebSocket error');
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
  const jitter = delay * (0.5 + Math.random() * 0.5);

  console.log(`🔌 Reconnecting in ${Math.round(jitter / 1000)}s (attempt ${reconnectAttempts})`);
  setConnectionState('connecting');

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ws = null;
    const token = localStorage.getItem('token');
    if (token) connect(token);
  }, jitter);
}

function dispatchEvent(type, data) {
  const handlers = eventListeners.get(type);
  if (handlers) {
    for (const handler of handlers) {
      try { handler(data); } catch (e) { console.error('Event handler error:', e); }
    }
  }

  // Map Durable Object events to Socket.io-compatible event names
  // so existing ChatPage.jsx code works without changes
  if (type === 'new_message') {
    const handlers2 = eventListeners.get('new_message');
    // Already dispatched above
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
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) {
    ws.onclose = null; // Prevent reconnect
    ws.close();
    ws = null;
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
  if (ws && ws.readyState === WebSocket.OPEN) {
    const token = localStorage.getItem('token');
    ws.send(JSON.stringify({ type: 'join', matchId, token }));
  }
}

/**
 * Leave a match room.
 */
export function leaveMatch(matchId) {
  currentRooms.delete(matchId);
  // Native WebSocket doesn't have room concept at protocol level
  // The Durable Object handles this server-side
}

/**
 * Send a message via WebSocket (fast path — avoids HTTP round-trip).
 * Returns a promise that resolves with the saved message or rejects with an error.
 */
export function sendMessageViaSocket(matchId, content) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Socket not connected'));
      return;
    }

    // Listen for the ACK
    const ackHandler = (data) => {
      if (data.type === 'message_ack' && data.message) {
        removeHandler('message_ack', ackHandler);
        clearTimeout(timeout);
        resolve(data.message);
      }
    };

    const errorHandler = (data) => {
      if (data.type === 'error') {
        removeHandler('error', errorHandler);
        removeHandler('message_ack', ackHandler);
        clearTimeout(timeout);
        reject(new Error(data.message));
      }
    };

    addHandler('message_ack', ackHandler);
    addHandler('error', errorHandler);

    ws.send(JSON.stringify({ type: 'send_message', matchId, content }));

    const timeout = setTimeout(() => {
      removeHandler('message_ack', ackHandler);
      removeHandler('error', errorHandler);
      reject(new Error('Message send timeout'));
    }, 3000);
  });
}

/**
 * Send typing indicator.
 */
export function sendTyping(matchId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'typing', matchId }));
  }
}

/**
 * Send stop typing indicator.
 */
export function sendStopTyping(matchId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'stop_typing', matchId }));
  }
}

function addHandler(event, handler) {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event).add(handler);
}

function removeHandler(event, handler) {
  const handlers = eventListeners.get(event);
  if (handlers) handlers.delete(handler);
}

/**
 * Subscribe to socket events. Returns an unsubscribe function.
 */
export function onSocketEvent(event, handler) {
  addHandler(event, handler);
  return () => removeHandler(event, handler);
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
    try { listener(state); } catch (e) { console.error('State listener error:', e); }
  }
}
