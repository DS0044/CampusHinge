-- CampusApp — Initial Database Schema
-- Run against PostgreSQL 16+

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    email_verified  BOOLEAN DEFAULT false,
    role            VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    subscription_status VARCHAR(20) DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'expired')),
    subscription_expiry TIMESTAMPTZ,
    is_banned       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OTP CODES
-- ============================================================
CREATE TABLE otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    code        VARCHAR(6) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_codes_email_created ON otp_codes (email, created_at);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    bio             TEXT,
    photos          JSONB DEFAULT '[]',
    branch          VARCHAR(100),
    year            INTEGER,
    gender          VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'non_binary')),
    interested_in   VARCHAR(20) NOT NULL CHECK (interested_in IN ('male', 'female', 'everyone')),
    interests       JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_gender ON profiles (gender);
CREATE INDEX idx_profiles_interested_in ON profiles (interested_in);

-- ============================================================
-- SWIPES
-- ============================================================
CREATE TABLE swipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action      VARCHAR(10) NOT NULL CHECK (action IN ('like', 'pass')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (swiper_id, swiped_id)
);

CREATE INDEX idx_swipes_swiped_action ON swipes (swiped_id, action);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE matches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_unlocked BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user1_id, user2_id),
    CHECK (user1_id < user2_id)
);

CREATE INDEX idx_matches_user1 ON matches (user1_id);
CREATE INDEX idx_matches_user2 ON matches (user2_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_match_created ON messages (match_id, created_at);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    razorpay_subscription_id VARCHAR(255),
    razorpay_order_id       VARCHAR(255),
    status                  VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
    activated_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_razorpay ON subscriptions (razorpay_subscription_id);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_reported ON reports (reported_id);
CREATE INDEX idx_reports_status ON reports (status);

-- ============================================================
-- BLOCKS
-- ============================================================
CREATE TABLE blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);
