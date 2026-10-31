-- Migration 021: Create Device Tokens table for Firebase Push Notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  token TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'android',
  app_version TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_active
  ON device_tokens (is_active, platform);

CREATE INDEX IF NOT EXISTS idx_device_tokens_updated_at
  ON device_tokens (updated_at);
