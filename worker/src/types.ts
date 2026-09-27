/**
 * Shared TypeScript types for the CampusHinge Cloudflare Worker.
 *
 * These types describe:
 *  - The Cloudflare Workers environment bindings (D1, R2, Durable Objects)
 *  - JWT payload shape
 *  - Common DB row shapes returned by queries
 *  - Request/response body shapes for each route
 */

// ── Cloudflare Worker Environment Bindings ──

export interface Env {
  /** D1 SQLite database */
  DB: D1Database;
  /** R2 object storage bucket */
  R2: R2Bucket;
  /** Durable Object namespace for chat rooms */
  CHAT_ROOM: DurableObjectNamespace;

  // Secrets (set via `wrangler secret put`)
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  BREVO_API_KEY?: string;
  SMTP_PASS?: string;
  SMTP_HOST?: string;
  SMTP_USER?: string;
  SMTP_PORT?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RAZORPAY_PLAN_ID?: string;

  // Non-secret vars (from wrangler.toml [vars])
  ALLOWED_EMAIL_DOMAINS?: string;
  ALLOWED_EXTRA_EMAILS?: string;
  JWT_EXPIRES_IN?: string;
  SUBSCRIPTION_DURATION_DAYS?: string;
  FRONTEND_URL?: string;
  GOOGLE_CLIENT_ID?: string;
}

// ── JWT Payload ──

export interface JwtPayload {
  id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown; // Jose adds extra claims
}

// ── Hono Context variable map ──

export interface HonoVariables {
  user: JwtPayload;
}

// ── Common DB Row Shapes ──

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  is_banned: number;
  email_verified: number;
  role: string;
  active_intent: string | null;
  last_active: string | null;
  last_super_like_at: string | null;
  created_at: string;
  subscription_active: number;
  subscription_expires_at: string | null;
}

export interface ProfileRow {
  user_id: string;
  name: string;
  bio: string | null;
  branch: string | null;
  year: number | null;
  gender: string;
  interested_in: string;
  interests: string | string[];
  activity_tags: string | string[] | null;
  photos: string | string[];
  active_intent?: string;
}

export interface OtpRow {
  id: string;
  user_id: string;
  code: string;
  expires_at: string;
  attempts: number;
  created_at: string;
}

export interface SwipeRow {
  id: string;
  swiper_id: string;
  swiped_id: string;
  action: string;
  created_at: string;
}

export interface MatchRow {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  from_user_id: string | null;
  match_id: string | null;
  is_read: number;
  created_at: string;
}

export interface SwipePreferenceRow {
  tag: string;
  likes: number;
  total: number;
}

export interface InterestPopularityRow {
  tag: string;
  user_count: number;
}

// ── Scoring types ──

export interface ScoreBreakdown {
  interest: number;
  behavioral: number;
  freshness: number;
}

export interface CompatibilityResult {
  score: number;
  breakdown: ScoreBreakdown;
}

export interface ScoredProfile extends ProfileRow {
  compatibility_score?: number;
  is_fallback?: boolean;
  is_looped?: number;
}

export interface SuperLikeGate {
  allowed: boolean;
  reason?: string;
  sharedCount?: number;
}

// ── Request body shapes ──

export interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface VerifyOtpBody {
  email: string;
  otp: string;
}

export interface ProfileUpdateBody {
  name?: string;
  bio?: string;
  branch?: string;
  year?: number | string;
  gender?: string;
  interested_in?: string;
  interests?: string[] | string;
  activity_tags?: string[] | string;
  active_intent?: string;
  email_notifications?: boolean;
}

export interface SwipeBody {
  swiped_id: string;
  action: 'like' | 'dislike' | 'super_like';
}

export interface SendMessageBody {
  content: string;
}

// ── Email params ──

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  logName?: string;
}

// ── D1 query result ──

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  changes?: number;
}
