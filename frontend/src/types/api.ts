import { Profile } from './user';

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

export type SwipeAction = 'like' | 'pass';

export interface SwipeResponse {
  matched: boolean;
  match_id?: string;
  super_liked?: boolean;
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
  is_unlocked: boolean;
  created_at: string;
  partner?: Profile;
  last_message?: Message | null;
  lastMessage?: Message | null;
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
  profiles: Profile[];
  remaining_swipes?: number;
  daily_quota?: number;
}
