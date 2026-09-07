const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const crypto = require('crypto');

/**
 * Socket.io service — ZERO-LATENCY CHAT ENGINE
 *
 * Architecture for instant messaging on free-tier hosting:
 *
 * 1. ACK-FIRST: When a user sends a message, we ACK back to the sender
 *    IMMEDIATELY with the generated message object (before DB write).
 *    The user sees their message in <5ms.
 *
 * 2. ASYNC DB WRITES: The database INSERT happens in the background
 *    after the ACK. If it fails, the message is already delivered via
 *    socket — it just won't persist on reload (acceptable trade-off).
 *
 * 3. IN-MEMORY CACHES: Match authorization, paywall status, and recent
 *    messages are cached in memory to eliminate repeated DB queries.
 *
 * 4. ZERO-COPY RELAY: Incoming messages are relayed to the match room
 *    in the same tick as the ACK — the recipient sees it in <10ms.
 */

// ── In-Memory Caches ──

// Cache: userId → Set<matchId> (authorized matches)
const matchAuthCache = new Map();
const MATCH_AUTH_TTL = 5 * 60 * 1000; // 5 min

// Cache: matchId → { user1_id, user2_id, is_unlocked } 
const matchDataCache = new Map();
const MATCH_DATA_TTL = 2 * 60 * 1000; // 2 min

// Cache: `${matchId}:${userId}` → { count, timestamp }
const messageCountCache = new Map();
const MSG_COUNT_TTL = 60 * 1000; // 1 min

// Cache: userId → { status, expiry, timestamp }
const subscriptionCache = new Map();
const SUB_CACHE_TTL = 60 * 1000; // 1 min

// Track online users: userId → Set<socketId>
const onlineUsers = new Map();

// ── Cache Helpers ──

function getCached(cache, key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry._cachedAt > ttl) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(cache, key, value) {
  cache.set(key, { ...value, _cachedAt: Date.now() });
}

/**
 * Get match data with caching. Returns null if user is not a participant.
 */
async function getMatchData(matchId, userId) {
  // Check auth cache first
  const authSet = matchAuthCache.get(userId);
  const cached = getCached(matchDataCache, matchId, MATCH_DATA_TTL);

  if (cached && authSet?.has(matchId)) {
    return cached;
  }

  // DB lookup
  const { rows } = await db.query(
    `SELECT id, user1_id, user2_id, is_unlocked FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [matchId, userId]
  );

  if (rows.length === 0) return null;

  const match = rows[0];

  // Cache it
  setCache(matchDataCache, matchId, match);
  if (!matchAuthCache.has(userId)) matchAuthCache.set(userId, new Set());
  matchAuthCache.get(userId).add(matchId);

  return getCached(matchDataCache, matchId, MATCH_DATA_TTL);
}

/**
 * Check paywall status with caching. Returns 'allowed' | 'paywall' | 'unlock'.
 */
async function checkPaywall(matchId, userId, match) {
  if (match.is_unlocked) return 'allowed';

  // Check subscription cache
  let sub = getCached(subscriptionCache, userId, SUB_CACHE_TTL);
  if (!sub) {
    const { rows } = await db.query(
      `SELECT subscription_status, subscription_expiry FROM users WHERE id = $1`,
      [userId]
    );
    sub = rows[0] || {};
    setCache(subscriptionCache, userId, sub);
  }

  const hasActiveSub =
    sub.subscription_status === 'active' &&
    sub.subscription_expiry &&
    new Date(sub.subscription_expiry) > new Date();

  if (hasActiveSub) {
    // Unlock match in background (don't block)
    db.query(`UPDATE matches SET is_unlocked = 1 WHERE id = $1`, [matchId]).catch(() => {});
    // Update cache
    const cachedMatch = matchDataCache.get(matchId);
    if (cachedMatch) cachedMatch.is_unlocked = 1;
    return 'allowed';
  }

  // Check message count cache
  const countKey = `${matchId}:${userId}`;
  let countEntry = getCached(messageCountCache, countKey, MSG_COUNT_TTL);

  if (!countEntry) {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS count FROM messages WHERE match_id = $1 AND sender_id = $2`,
      [matchId, userId]
    );
    countEntry = { count: parseInt(rows[0].count, 10) };
    setCache(messageCountCache, countKey, countEntry);
  }

  if (countEntry.count >= 2) return 'paywall';
  return 'allowed';
}


function initializeSocket(io) {
  // ── Authentication middleware ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      socket.user = jwt.verify(token, env.JWT_SECRET);
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`🔌  Socket connected: ${userId}`);

    // Track online user
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Join personal room
    socket.join(`user:${userId}`);

    // ── Join match room (AUTHORIZED, CACHED) ──
    socket.on('join_match', async (matchId, callback) => {
      try {
        const match = await getMatchData(matchId, userId);
        if (!match) {
          if (typeof callback === 'function') callback({ error: 'Not authorized' });
          return;
        }

        socket.join(`match:${matchId}`);
        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('❌  join_match error:', err.message);
        if (typeof callback === 'function') callback({ error: 'Failed to join' });
      }
    });

    // ── Leave match room ──
    socket.on('leave_match', (matchId) => {
      socket.leave(`match:${matchId}`);
    });

    // ══════════════════════════════════════════════════════════
    // ██  INSTANT SEND — ACK FIRST, DB LATER  ██
    // ══════════════════════════════════════════════════════════
    socket.on('send_message', async ({ matchId, content }, callback) => {
      try {
        // ── Validate ──
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
          if (typeof callback === 'function') callback({ error: 'Message cannot be empty' });
          return;
        }

        const trimmedContent = content.trim().slice(0, 2000);

        // ── Check authorization (from cache, ~0ms) ──
        const match = await getMatchData(matchId, userId);
        if (!match) {
          if (typeof callback === 'function') callback({ error: 'Match not found' });
          return;
        }

        // ── Check paywall (from cache, ~0ms after first call) ──
        const paywallResult = await checkPaywall(matchId, userId, match);
        if (paywallResult === 'paywall') {
          if (typeof callback === 'function') {
            callback({ error: 'paywall', message: 'Message limit reached. Subscribe to send unlimited messages.' });
          }
          return;
        }

        // ── Generate message object INSTANTLY ──
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

        // ══════════════════════════════════════════════════
        // ⚡ ACK IMMEDIATELY — user sees message in <5ms
        // ══════════════════════════════════════════════════
        if (typeof callback === 'function') {
          callback({ success: true, message });
        }

        // ⚡ RELAY to other user in same tick — they see it in <10ms
        socket.to(`match:${matchId}`).emit('new_message', message);

        // ⚡ Push notification to recipient instantly
        io.to(`user:${recipientId}`).emit('notification', {
          type: 'message',
          from_user_id: userId,
          match_id: matchId,
          created_at: createdAt,
        });

        // ══════════════════════════════════════════════════
        // 📝 BACKGROUND: Write to database (non-blocking)
        // ══════════════════════════════════════════════════
        setImmediate(async () => {
          try {
            // Insert message
            await db.query(
              `INSERT INTO messages (id, match_id, sender_id, content, created_at)
               VALUES ($1, $2, $3, $4, $5)`,
              [messageId, matchId, userId, trimmedContent, createdAt]
            );

            // Increment cached message count
            const countKey = `${matchId}:${userId}`;
            const cached = messageCountCache.get(countKey);
            if (cached) cached.count = (cached.count || 0) + 1;

            // Upsert notification (background, non-blocking)
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

            // Push unread count
            const { rows: countRows } = await db.query(
              `SELECT COUNT(*) AS unread_count FROM notifications WHERE to_user_id = $1 AND is_read = 0`,
              [recipientId]
            );
            io.to(`user:${recipientId}`).emit('unread_count', {
              unread_count: parseInt(countRows[0]?.unread_count || 0, 10),
            });
          } catch (err) {
            console.error('❌  Background DB write failed:', err.message);
            // Message was already delivered via socket — it just won't persist on reload
            // This is an acceptable trade-off for instant delivery
          }
        });
      } catch (err) {
        console.error('❌  send_message error:', err.message);
        if (typeof callback === 'function') callback({ error: 'Failed to send' });
      }
    });

    // ── Typing indicators (pure memory, zero DB) ──
    socket.on('typing', ({ matchId }) => {
      socket.to(`match:${matchId}`).emit('user_typing', { userId, matchId });
    });

    socket.on('stop_typing', ({ matchId }) => {
      socket.to(`match:${matchId}`).emit('user_stop_typing', { userId, matchId });
    });

    // ── Disconnect cleanup ──
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) onlineUsers.delete(userId);
      }
    });
  });
}

function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

module.exports = { initializeSocket, isUserOnline };
