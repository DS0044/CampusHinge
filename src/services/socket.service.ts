import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env';
import db from '../config/db';
import { AuthUser } from '../types/express';

interface CustomSocket extends Socket {
  user?: AuthUser;
}

interface CacheEntry {
  _cachedAt: number;
  [key: string]: any;
}

// Cache: userId → Set<matchId> (authorized matches)
const matchAuthCache = new Map<string, Set<string>>();
const MATCH_AUTH_TTL = 5 * 60 * 1000; // 5 min

// Cache: matchId → { user1_id, user2_id, is_unlocked } 
const matchDataCache = new Map<string, CacheEntry>();
const MATCH_DATA_TTL = 2 * 60 * 1000; // 2 min

// Cache: `${matchId}:${userId}` → { count, timestamp }
const messageCountCache = new Map<string, CacheEntry>();
const MSG_COUNT_TTL = 60 * 1000; // 1 min

// Cache: userId → { status, expiry, timestamp }
const subscriptionCache = new Map<string, CacheEntry>();
const SUB_CACHE_TTL = 60 * 1000; // 1 min

// Track online users: userId → Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

function getCached<T extends CacheEntry>(cache: Map<string, T>, key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry._cachedAt > ttl) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(cache: Map<string, any>, key: string, value: Record<string, any>) {
  cache.set(key, { ...value, _cachedAt: Date.now() });
}

export async function getMatchData(matchId: string, userId: string): Promise<any | null> {
  const authSet = matchAuthCache.get(userId);
  const cached = getCached(matchDataCache, matchId, MATCH_DATA_TTL);

  if (cached && authSet?.has(matchId)) {
    return cached;
  }

  const { rows } = await db.query(
    `SELECT id, user1_id, user2_id, is_unlocked FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [matchId, userId]
  );

  if (rows.length === 0) return null;

  const match = rows[0];

  setCache(matchDataCache, matchId, match);
  if (!matchAuthCache.has(userId)) matchAuthCache.set(userId, new Set());
  matchAuthCache.get(userId)!.add(matchId);

  return getCached(matchDataCache, matchId, MATCH_DATA_TTL);
}

export async function checkPaywall(matchId: string, userId: string, match: any): Promise<'allowed' | 'paywall'> {
  if (match.is_unlocked) return 'allowed';

  let sub = getCached(subscriptionCache, userId, SUB_CACHE_TTL);
  if (!sub) {
    const { rows } = await db.query(
      `SELECT subscription_status, subscription_expiry FROM users WHERE id = $1`,
      [userId]
    );
    sub = rows[0] || {};
    setCache(subscriptionCache, userId, sub!);
  }

  const hasActiveSub =
    sub!.subscription_status === 'active' &&
    sub!.subscription_expiry &&
    new Date(sub!.subscription_expiry) > new Date();

  if (hasActiveSub) {
    db.query(`UPDATE matches SET is_unlocked = 1 WHERE id = $1`, [matchId]).catch(() => {});
    const cachedMatch = matchDataCache.get(matchId);
    if (cachedMatch) cachedMatch.is_unlocked = 1;
    return 'allowed';
  }

  const countKey = `${matchId}:${userId}`;
  let countEntry = getCached(messageCountCache, countKey, MSG_COUNT_TTL);

  if (!countEntry) {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS count FROM messages WHERE match_id = $1 AND sender_id = $2`,
      [matchId, userId]
    );
    countEntry = { count: parseInt(rows[0].count, 10), _cachedAt: Date.now() };
    setCache(messageCountCache, countKey, countEntry);
  }

  if (countEntry.count >= 2) return 'paywall';
  return 'allowed';
}

let ioInstance: SocketServer | null = null;

export function emitToUser(userId: string, event: string, payload: any): void {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, payload);
  }
}

export function initializeSocket(io: SocketServer): void {
  ioInstance = io;

  io.use((socket: CustomSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      socket.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as CustomSocket;
    const userId = socket.user?.id;
    if (!userId) return;

    console.log(`🔌  Socket connected: ${userId}`);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);

    socket.join(`user:${userId}`);

    socket.on('join_match', async (matchId: string, callback?: (resp: any) => void) => {
      try {
        const match = await getMatchData(matchId, userId);
        if (!match) {
          if (typeof callback === 'function') callback({ error: 'Not authorized' });
          return;
        }

        socket.join(`match:${matchId}`);
        if (typeof callback === 'function') callback({ success: true });
      } catch (err: any) {
        console.error('❌  join_match error:', err.message);
        if (typeof callback === 'function') callback({ error: 'Failed to join' });
      }
    });

    socket.on('leave_match', (matchId: string) => {
      socket.leave(`match:${matchId}`);
    });

    socket.on('send_message', async ({ matchId, content }: { matchId: string; content: string }, callback?: (resp: any) => void) => {
      try {
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
          if (typeof callback === 'function') callback({ error: 'Message cannot be empty' });
          return;
        }

        const trimmedContent = content.trim().slice(0, 2000);

        const match = await getMatchData(matchId, userId);
        if (!match) {
          if (typeof callback === 'function') callback({ error: 'Match not found' });
          return;
        }

        const messageId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const message = {
          id: messageId,
          match_id: matchId,
          sender_id: userId,
          content: trimmedContent,
          created_at: createdAt,
        };

        const recipientId = match.user1_id === userId ? match.user2_id : match.user1_id;

        if (typeof callback === 'function') {
          callback({ success: true, message });
        }

        socket.to(`match:${matchId}`).emit('new_message', message);

        io.to(`user:${recipientId}`).emit('notification', {
          type: 'message',
          from_user_id: userId,
          match_id: matchId,
          created_at: createdAt,
        });

        setImmediate(async () => {
          try {
            await db.query(
              `INSERT INTO messages (id, match_id, sender_id, content, created_at)
               VALUES ($1, $2, $3, $4, $5)`,
              [messageId, matchId, userId, trimmedContent, createdAt]
            );

            const countKey = `${matchId}:${userId}`;
            const cached = messageCountCache.get(countKey);
            if (cached) cached.count = (cached.count || 0) + 1;

            const notifId = crypto.randomUUID();
            const nowIso = createdAt;

            const { rows: existingNotif } = await db.query(
              `SELECT id FROM notifications WHERE to_user_id = $1 AND from_user_id = $2`,
              [recipientId, userId]
            );

            if (existingNotif.length > 0) {
              await db.query(
                `UPDATE notifications SET type = 'message', is_read = 0, is_seen = 0, created_at = $1 WHERE id = $2`,
                [nowIso, existingNotif[0].id]
              );
            } else {
              await db.query(
                `INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at) VALUES ($1, $2, $3, 'message', $4)`,
                [notifId, recipientId, userId, nowIso]
              );
            }

            const { rows: countRows } = await db.query(
              `SELECT COUNT(*) AS unread_count FROM notifications WHERE to_user_id = $1 AND is_read = 0`,
              [recipientId]
            );
            io.to(`user:${recipientId}`).emit('unread_count', {
              unread_count: parseInt(countRows[0]?.unread_count || '0', 10),
            });
          } catch (err: any) {
            console.error('❌  Background DB write failed:', err.message);
          }
        });
      } catch (err: any) {
        console.error('❌  send_message error:', err.message);
        if (typeof callback === 'function') callback({ error: 'Failed to send' });
      }
    });

    socket.on('typing', ({ matchId }: { matchId: string }) => {
      socket.to(`match:${matchId}`).emit('user_typing', { userId, matchId });
    });

    socket.on('stop_typing', ({ matchId }: { matchId: string }) => {
      socket.to(`match:${matchId}`).emit('user_stop_typing', { userId, matchId });
    });

    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) onlineUsers.delete(userId);
      }
    });
  });
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && (onlineUsers.get(userId)?.size || 0) > 0;
}

export default { initializeSocket, isUserOnline, emitToUser, getMatchData, checkPaywall };
module.exports = { initializeSocket, isUserOnline, emitToUser, getMatchData, checkPaywall };
