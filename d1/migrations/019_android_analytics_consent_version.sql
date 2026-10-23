-- Migration 019: retain the client consent-policy version with each event.

ALTER TABLE android_analytics_events
  ADD COLUMN consent_version TEXT NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_android_events_consent_version
  ON android_analytics_events(consent_version);
