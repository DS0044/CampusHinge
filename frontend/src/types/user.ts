export type Gender = 'male' | 'female' | 'non_binary';
export type InterestedIn = 'male' | 'female' | 'everyone';

export interface User {
  id: string;
  email: string;
  role?: 'user' | 'admin' | string;
  subscription_status?: 'free' | 'active' | 'expired' | string;
  subscription_expiry?: string | null;
  is_banned?: boolean | number;
  email_notifications?: boolean | number;
  profile_completed?: boolean | number;
  has_profile?: boolean;
  last_active?: string | null;
  accepted_terms_at?: string | null;
  terms_version?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  id?: string;
  user_id: string;
  name: string;
  bio?: string | null;
  photos: string[];
  branch?: string | null;
  year?: number | null;
  gender: Gender;
  interested_in: InterestedIn;
  interests: string[];
  age?: number;
  email_notifications?: boolean | number;
  created_at?: string;
  updated_at?: string;
  score?: number;
  is_looped?: number;
  profile_completed?: boolean | number;
  has_profile?: boolean;
}
