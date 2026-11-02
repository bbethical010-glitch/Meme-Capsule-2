-- Migration 023: Reusable messages and durable notification schedules
CREATE TABLE IF NOT EXISTS notification_messages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  screen TEXT NOT NULL DEFAULT 'drop',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_schedules (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES notification_messages(id),
  time_local TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  days_of_week TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
  target TEXT NOT NULL DEFAULT 'all',
  topic TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_schedules_enabled
  ON notification_schedules (is_enabled, time_local);

CREATE TABLE IF NOT EXISTS notification_delivery_runs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES notification_schedules(id),
  occurrence_key TEXT NOT NULL,
  status TEXT NOT NULL,
  total_attempted INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  stale_pruned INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE(schedule_id, occurrence_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_runs_schedule
  ON notification_delivery_runs (schedule_id, started_at DESC);
