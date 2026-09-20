-- CampusHinge D1 Migration: 0002_super_like.sql
-- Add Super Like support columns

ALTER TABLE users ADD COLUMN last_super_like_at TEXT;
ALTER TABLE swipes ADD COLUMN is_super_like INTEGER DEFAULT 0;
ALTER TABLE swipes ADD COLUMN shared_interests TEXT DEFAULT '[]';
ALTER TABLE swipes ADD COLUMN shared_interests_count INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN metadata TEXT;
