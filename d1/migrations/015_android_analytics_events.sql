-- Migration 015: Android analytics contract
-- Apply before deploying /api/analytics/events or its dashboard readers.

CREATE TABLE IF NOT EXISTS android_analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  user_hash TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp_utc TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform = 'android'),
  app_version TEXT NOT NULL,
  os_version TEXT,
  country TEXT,
  meme_id TEXT,
  category TEXT,
  source_channel TEXT,
  screen_name TEXT,
  properties_json TEXT NOT NULL DEFAULT '{}',
  consent_status TEXT NOT NULL CHECK (consent_status = 'granted'),
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_android_events_timestamp
  ON android_analytics_events(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_android_events_event_name
  ON android_analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_android_events_user_hash
  ON android_analytics_events(user_hash);
CREATE INDEX IF NOT EXISTS idx_android_events_platform_version
  ON android_analytics_events(platform, app_version);
