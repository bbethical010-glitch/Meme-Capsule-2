-- Migration 017: indexes for time-bounded Android KPI queries.
-- Apply before enabling high-volume Phase 3 dashboard traffic.

CREATE INDEX IF NOT EXISTS idx_android_events_timestamp_platform
  ON android_analytics_events(timestamp_utc, platform);

CREATE INDEX IF NOT EXISTS idx_android_events_timestamp_name
  ON android_analytics_events(timestamp_utc, event_name);

CREATE INDEX IF NOT EXISTS idx_android_events_timestamp_category
  ON android_analytics_events(timestamp_utc, category);

CREATE INDEX IF NOT EXISTS idx_android_events_timestamp_session
  ON android_analytics_events(timestamp_utc, session_id);
