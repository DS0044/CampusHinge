/**
 * ChatRoom Durable Object — WebSocket chat for CampusHinge.
 *
 * Replaces Socket.io with native WebSocket via Cloudflare Durable Objects.
 * Each match room gets its own Durable Object instance for isolated,
 * persistent chat with zero cross-talk.
 *
 * Protocol (client sends JSON):
 *   { type: "join", matchId: string, token: string }
 *   { type: "send_message", matchId: string, content: string }
 *   { type: "typing", matchId: string }
 *   { type: "stop_typing", matchId: string }
 *
 * Server sends JSON:
 *   { type: "new_message", message: {...} }
 *   { type: "message_ack", message: {...} }
 *   { type: "typing", userId: string }
 *   { type: "stop_typing", userId: string }
 *   { type: "error", message: string }
 */

import { jwtVerify } from 'jose';
import type { Env } from '../types.js';

interface SessionInfo {
  userId: string | null;
  matchId: string | null;
}

interface IncomingMessage {
  type: string;
  token?: string;
  matchId?: string;
  content?: string;
}

interface MatchParticipantRow {
  user1_id: string;
  user2_id: string;
}

interface NotificationRow {
  id: string;
}

export class ChatRoom implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private readonly sessions: Map<WebSocket, SessionInfo>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map<WebSocket, SessionInfo>();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();
    this.sessions.set(server, { userId: null, matchId: null });

    server.addEventListener('message', async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as IncomingMessage;
        await this.handleMessage(server, data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        server.send(JSON.stringify({ type: 'error', message: msg }));
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

  private async handleMessage(ws: WebSocket, data: IncomingMessage): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    switch (data.type) {
      case 'join': {
        try {
          const secret = new TextEncoder().encode(this.env.JWT_SECRET);
          const { payload } = await jwtVerify(data.token ?? '', secret);
          const userId = payload['id'] as string;
          session.userId = userId;
          session.matchId = data.matchId ?? null;

          // Verify this user is a participant in the match
          const result = await this.env.DB.prepare(
            'SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)'
          )
            .bind(data.matchId, userId, userId)
            .first();

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
          )
            .bind(messageId, session.matchId, session.userId, data.content, now)
            .run();

          // Update notification for recipient
          const matchResult = await this.env.DB.prepare(
            'SELECT user1_id, user2_id FROM matches WHERE id = ?'
          )
            .bind(session.matchId)
            .first<MatchParticipantRow>();

          if (matchResult) {
            const recipientId =
              matchResult.user1_id === session.userId
                ? matchResult.user2_id
                : matchResult.user1_id;

            const existingNotif = await this.env.DB.prepare(
              'SELECT id FROM notifications WHERE to_user_id = ? AND from_user_id = ?'
            )
              .bind(recipientId, session.userId)
              .first<NotificationRow>();

            if (existingNotif) {
              await this.env.DB.prepare(
                'UPDATE notifications SET type = ?, is_read = 0, is_seen = 0, created_at = ? WHERE id = ?'
              )
                .bind('message', now, existingNotif.id)
                .run();
            } else {
              const notifId = crypto.randomUUID();
              await this.env.DB.prepare(
                'INSERT INTO notifications (id, to_user_id, from_user_id, type, created_at) VALUES (?, ?, ?, ?, ?)'
              )
                .bind(notifId, recipientId, session.userId, 'message', now)
                .run();
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('DB write error:', msg);
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
        ws.send(
          JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` })
        );
    }
  }
}
