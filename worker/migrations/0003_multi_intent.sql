-- CampusHinge D1 Migration: 0003_multi_intent.sql
-- Add Multi-Intent support columns

ALTER TABLE users ADD COLUMN active_intent TEXT DEFAULT 'dating';
ALTER TABLE profiles ADD COLUMN activity_tags TEXT DEFAULT '[]';
ALTER TABLE swipes ADD COLUMN intent TEXT DEFAULT 'dating';
ALTER TABLE matches ADD COLUMN intent TEXT DEFAULT 'dating';
