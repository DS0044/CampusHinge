import { Message } from './api';

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface UserTypingPayload {
  userId: string;
  matchId: string;
}

export interface UnreadCountPayload {
  unread_count: number;
}

export interface NotificationPayload {
  type: string;
  from_user_id?: string;
  match_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface SocketEventMap {
  new_message: Message;
  user_typing: UserTypingPayload;
  user_stop_typing: UserTypingPayload;
  notification: NotificationPayload;
  unread_count: UnreadCountPayload;
  message_ack: unknown;
  error: unknown;
}
