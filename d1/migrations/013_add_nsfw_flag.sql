-- ============================================================
-- Migration 013: Add explicit NSFW moderation flag and metadata
-- Run: npx wrangler d1 execute meme-capsule-db --file=d1/migrations/013_add_nsfw_flag.sql
-- ============================================================

ALTER TABLE memes ADD COLUMN is_nsfw INTEGER NOT NULL DEFAULT 0
  CHECK (is_nsfw IN (0, 1));
ALTER TABLE memes ADD COLUMN nsfw_flagged_by TEXT; -- 'ai-judge' | 'curator' | 'report' | NULL
CREATE INDEX IF NOT EXISTS idx_memes_is_nsfw ON memes(is_nsfw);

