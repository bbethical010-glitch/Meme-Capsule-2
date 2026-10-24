-- Migration 016: version the Android analytics event contract.
-- Apply before enabling schema-version enforcement in /api/analytics/events.

ALTER TABLE android_analytics_events
  ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
