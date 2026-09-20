import { User } from './user';

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    user: User;
  };
  error?: {
    message: string;
    retryAfter?: number;
    details?: unknown;
  };
}

export interface GoogleAuthResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    user: User;
  };
}
