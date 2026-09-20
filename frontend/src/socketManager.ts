/**
 * Socket Manager — Socket.IO Client
 *
 * Uses socket.io-client to connect to the Socket.IO server.
 * The server uses Socket.IO (not raw WebSocket), so we MUST use
 * the matching client library for the handshake, framing, and
 * event system to work correctly.
 */

import { io, Socket } from 'socket.io-client';
import { Message, SocketConnectionState } from './types';

// Derive the Socket.IO server URL from the API URL
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const SERVER_URL: string = API_URL.replace(/\/api\/?$/, '') || 'http://localhost:3000';

let socket: Socket | null = null;
let connectionState: SocketConnectionState = 'disconnected';
const stateListeners = new Set<(state: SocketConnectionState) => void>();
const eventListeners = new Map<string, Set<(data: any) => void>>();
const currentRooms = new Set<string>();

/**
 * Get the singleton socket instance.
 */
export function getSocket(): Socket | null {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('token');
  if (!token) return null;

  if (socket?.active) return socket;

  connect(token);
  return socket;
}

function connect(token: string): void {
  if (socket?.connected || socket?.active) return;

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
    console.log('🔌 Socket.IO connected:', socket?.id);
    setConnectionState('connected');

    // Re-join any match rooms we were in
    for (const matchId of currentRooms) {
      socket?.emit('join_match', matchId);
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
  socket.on('new_message', (msg: Message) => {
    dispatchToListeners('new_message', msg);
  });

  socket.on('user_typing', (data: { userId: string; matchId: string }) => {
    dispatchToListeners('user_typing', data);
  });

  socket.on('user_stop_typing', (data: { userId: string; matchId: string }) => {
    dispatchToListeners('user_stop_typing', data);
  });

  socket.on('notification', (data: unknown) => {
    dispatchToListeners('notification', data);
  });

  socket.on('unread_count', (data: { unread_count: number }) => {
    dispatchToListeners('unread_count', data);
  });

  socket.on('message_ack', (data: unknown) => {
    dispatchToListeners('message_ack', data);
  });

  socket.on('error', (data: unknown) => {
    dispatchToListeners('error', data);
  });
}

function dispatchToListeners(event: string, data: unknown): void {
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
export function initSocket(): Socket | null {
  return getSocket();
}

/**
 * Disconnect and clean up (call on logout).
 */
export function destroySocket(): void {
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
export function joinMatch(matchId: string): void {
  currentRooms.add(matchId);
  if (socket?.connected) {
    socket.emit('join_match', matchId);
  }
}

/**
 * Leave a match room.
 */
export function leaveMatch(matchId: string): void {
  currentRooms.delete(matchId);
  if (socket?.connected) {
    socket.emit('leave_match', matchId);
  }
}

/**
 * Send a message via Socket.IO (fast path — avoids HTTP round-trip).
 */
export function sendMessageViaSocket(matchId: string, content: string): Promise<Message> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Message send timeout'));
    }, 5000);

    socket.emit('send_message', { matchId, content }, (response: any) => {
      clearTimeout(timeout);
      if (response?.error) {
        reject(new Error(response.error));
      } else if (response?.message) {
        resolve(response.message);
      } else if (response?.success && response?.message) {
        resolve(response.message);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send typing indicator.
 */
export function sendTyping(matchId: string): void {
  if (socket?.connected) {
    socket.emit('typing', { matchId });
  }
}

/**
 * Send stop typing indicator.
 */
export function sendStopTyping(matchId: string): void {
  if (socket?.connected) {
    socket.emit('stop_typing', { matchId });
  }
}

/**
 * Subscribe to socket events. Returns an unsubscribe function.
 */
export function onSocketEvent<T = any>(event: string, handler: (data: T) => void): () => void {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  const handlers = eventListeners.get(event)!;
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/**
 * Get current connection state.
 */
export function getConnectionState(): SocketConnectionState {
  return connectionState;
}

/**
 * Subscribe to connection state changes. Returns unsubscribe function.
 */
export function onConnectionStateChange(listener: (state: SocketConnectionState) => void): () => void {
  stateListeners.add(listener);
  listener(connectionState);
  return () => {
    stateListeners.delete(listener);
  };
}

function setConnectionState(state: SocketConnectionState): void {
  connectionState = state;
  for (const listener of stateListeners) {
    try {
      listener(state);
    } catch (e) {
      console.error('State listener error:', e);
    }
  }
}
