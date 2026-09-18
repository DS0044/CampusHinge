/**
 * ChatRoom Durable Object — WebSocket chat for CampusHinge.
 *
 * Replaces Socket.io with native WebSocket via Cloudflare Durable Objects.
 * Each match room gets its own Durable Object instance for isolated,
 * persistent chat with zero cross-talk.
 *
 * Protocol (client sends JSON):
 *   { type: "join", matchId, token }
 *   { type: "send_message", matchId, content }
 *   { type: "typing", matchId }
 *   { type: "stop_typing", matchId }
 *
 * Server sends JSON:
 *   { type: "new_message", message: {...} }
 *   { type: "message_ack", message: {...} }
 *   { type: "typing", userId }
 *   { type: "stop_typing", userId }
 *   { type: "error", message: "..." }
 */

import { jwtVerify } from 'jose';

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Map<WebSocket, { userId, matchId }>
    this.sessions = new Map();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sessions.set(server, { userId: null, matchId: null });

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(server, data);
      } catch (err) {
        server.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });

    server.addEventListener('error', () => {
      this.sessions.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(ws, data) {
    const session = this.sessions.get(ws);

    switch (data.type) {
      case 'join': {
        // Authenticate via JWT
        try {
          const secret = new TextEncoder().encode(this.env.JWT_SECRET);
          const { payload } = await jwtVerify(data.token, secret);
          session.userId = payload.id;
          session.matchId = data.matchId;

          // Verify this user is a participant in the match
          const result = await this.env.DB.prepare(
            'SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)'
          ).bind(data.matchId, payload.id, payload.id).first();

          if (!result) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authorized for this match.' }));
            ws.close(4003, 'Unauthorized');
            return;
          }

          ws.send(JSON.stringify({ type: 'joined', matchId: data.matchId }));
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed.' }));
          ws.close(4001, 'Auth failed');
        }
        break;
      }

      case 'send_message': {
        if (!session.userId || !session.matchId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not joined to a match room.' }));
          return;
        }

        const messageId = crypto.randomUUID();
        const now = new Date().toISOString();
        const message = {
          id: messageId,
          match_id: session.matchId,
          sender_id: session.userId,
          content: data.content,
          created_at: now,
        };

        // ACK immediately (before DB write) for zero latency
        ws.send(JSON.stringify({ type: 'message_ack', message }));

        // Broadcast to other participants in this room
        for (const [otherWs, otherSession] of this.sessions) {
          if (otherWs !== ws && otherSession.matchId === session.matchId) {
            otherWs.send(JSON.stringify({ type: 'new_message', message }));
          }
        }

        // Write to DB in background (non-blocking)
        try {
          await this.env.DB.prepare(
            'INSERT INTO messages (id, match_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(messageId, session.matchId, session.userId, data.content, now).run();

          // Update notification for recipient
          const matchResult = await this.env.DB.prepare(
            'SELECT user1_id, user2_id FROM matches WHERE id = ?'
          ).bind(session.matchId).first();

          if (matchResult) {
            const recipientId = matchResult.user1_id === session.userId
              ? matchResult.user2_id : matchResult.user1_id;

            const existingNotif = await this.env.DB.prepare(
              'SELECT id FROM notifications WHERE to_user_id = ? AND from_user_id = ?'
            ).bind(recipientId, session.userId).first();

            if (existingNotif) {
              await this.env.DB.prepare(
                'UPDATE notifications SET type = ?, is_read = 0, is_seen = 0, created_at = ? WHERE id = ?'
              ).bind('message', now, existingNotif.id).run();
            } else {
              const notifId = crypto.randomUUID();
              await this.env.DB.prepare(
                'INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at) VALUES (?, ?, ?, ?, ?)'
              ).bind(notifId, recipientId, session.userId, 'message', now).run();
            }
          }
        } catch (err) {
          console.error('DB write error:', err.message);
          // Message was already ACK'd and delivered via WebSocket — DB is best-effort
        }
        break;
      }

      case 'typing': {
        if (!session.userId || !session.matchId) return;
        for (const [otherWs, otherSession] of this.sessions) {
          if (otherWs !== ws && otherSession.matchId === session.matchId) {
            otherWs.send(JSON.stringify({ type: 'typing', userId: session.userId }));
          }
        }
        break;
      }

      case 'stop_typing': {
        if (!session.userId || !session.matchId) return;
        for (const [otherWs, otherSession] of this.sessions) {
          if (otherWs !== ws && otherSession.matchId === session.matchId) {
            otherWs.send(JSON.stringify({ type: 'stop_typing', userId: session.userId }));
          }
        }
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
    }
  }
}
