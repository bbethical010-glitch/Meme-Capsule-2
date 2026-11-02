-- Migration 024: Persistent random content files for scheduled notifications
CREATE TABLE IF NOT EXISTS notification_content_files (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  entry_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE notification_schedules ADD COLUMN content_file_id TEXT REFERENCES notification_content_files(id);

CREATE INDEX IF NOT EXISTS idx_notification_schedules_content_file
  ON notification_schedules (content_file_id);
