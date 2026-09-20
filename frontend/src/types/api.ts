import { Profile } from './user';
import { IntentType } from '../constants/intents';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    retryAfter?: number;
    details?: unknown;
  };
}

export type SwipeAction = 'like' | 'pass' | 'super_like';

export interface SwipeResponse {
  matched: boolean;
  match_id?: string;
  action?: SwipeAction;
  intent?: IntentType;
  super_liked?: boolean;
  super_like_available?: boolean;
  partner?: Profile;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  intent?: IntentType | string;
  is_unlocked: boolean;
  created_at: string;
  matched_at?: string;
  partner?: Profile;
  last_message?: string | Message | null;
  lastMessage?: string | Message | null;
  last_message_at?: string | null;
  unread_count?: number;
}

export interface NotificationItem {
  id: string;
  to_user_id: string;
  from_user_id: string;
  type: 'like' | 'message' | 'match' | string;
  is_seen: number | boolean;
  is_read: number | boolean;
  created_at: string;
  sender_profile?: Profile;
}

export interface DiscoverDeckResponse {
  active_intent?: IntentType;
  profiles: Profile[];
  count?: number;
  remaining_swipes?: number;
  daily_quota?: number;
  super_like?: {
    available: boolean;
    next_available_in_seconds: number;
    last_super_like_at: string | null;
  };
}
