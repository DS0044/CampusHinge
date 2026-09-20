export interface DbUser {
  id: string;
  email: string;
  role: string;
  subscription_status: string;
  subscription_expiry?: string | null;
  is_banned: number | boolean;
  email_notifications: number | boolean;
  profile_completed: number | boolean;
  last_active?: string | null;
  accepted_terms_at?: string | null;
  terms_version?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  id: string;
  user_id: string;
  name: string;
  bio?: string | null;
  photos: string; // JSON string in DB
  branch?: string | null;
  year?: number | null;
  gender: string;
  interested_in: string;
  interests: string; // JSON string in DB
  score?: number;
  is_looped?: number;
  created_at: string;
  updated_at: string;
}

export interface DbMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  is_unlocked: number | boolean;
  created_at: string;
}

export interface DbMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface DbNotification {
  id: string;
  to_user_id: string;
  from_user_id: string;
  type: string;
  is_seen: number | boolean;
  is_read: number | boolean;
  created_at: string;
}

export interface DbSwipe {
  id: string;
  swiper_id: string;
  swiped_id: string;
  action: 'like' | 'pass' | 'super_like' | string;
  created_at: string;
}
