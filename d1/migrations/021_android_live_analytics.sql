-- Migration 021: bounded live Android analytics rollups.
-- Migration 015 already provides received_at; this migration adds its index.

CREATE INDEX IF NOT EXISTS idx_android_events_received_at
  ON android_analytics_events(received_at);

CREATE TABLE IF NOT EXISTS android_live_minute (
  minute_utc TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (minute_utc, event_name)
);

CREATE TABLE IF NOT EXISTS android_live_hourly (
  hour_utc TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour_utc, event_name)
);

CREATE TABLE IF NOT EXISTS android_live_presence (
  user_hash TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_events INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_android_live_presence_last_seen
  ON android_live_presence(last_seen_at);

CREATE TABLE IF NOT EXISTS android_pipeline_health (
  component TEXT PRIMARY KEY,
  last_ok_at TEXT,
  last_error_at TEXT,
  last_error TEXT,
  detail TEXT
);
