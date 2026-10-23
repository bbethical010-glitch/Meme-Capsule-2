-- Migration 020: daily Android aggregates for low-cost dashboard reads.
-- Raw events remain the source of truth; the analytics worker refreshes this
-- bounded window after each scheduled run.

CREATE TABLE IF NOT EXISTS android_analytics_daily_summary (
  summary_date TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform = 'android'),
  event_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  events INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (summary_date, platform, event_name, category, app_version)
);

CREATE INDEX IF NOT EXISTS idx_android_summary_date
  ON android_analytics_daily_summary(summary_date);

CREATE INDEX IF NOT EXISTS idx_android_summary_event_date
  ON android_analytics_daily_summary(event_name, summary_date);

CREATE INDEX IF NOT EXISTS idx_android_summary_category_date
  ON android_analytics_daily_summary(category, summary_date);
