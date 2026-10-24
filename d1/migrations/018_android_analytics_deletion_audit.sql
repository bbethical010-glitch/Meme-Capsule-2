-- Migration 018: auditable deletion requests for Android analytics.

CREATE TABLE IF NOT EXISTS android_analytics_deletion_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_reference TEXT NOT NULL UNIQUE,
  user_hash TEXT NOT NULL,
  deleted_event_count INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_android_deletion_audit_created
  ON android_analytics_deletion_audit(created_at);

CREATE INDEX IF NOT EXISTS idx_android_deletion_audit_user_hash
  ON android_analytics_deletion_audit(user_hash);
