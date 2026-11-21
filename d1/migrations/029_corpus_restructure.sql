-- Migration 029: Corpus Restructure & Unified Intake State
-- Introduces single authoritative corpus_status ('draft', 'archive', 'active', 'excluded', 'conflict')
-- Adds content_hash to memes table as the single source of truth for media deduplication
-- Adds unified intake columns to ingestion_batches and ingestion_jobs
-- Adds immutable audit logs: meme_state_log, meme_purge_log, corpus_maintenance_runs, curation_legacy_later_votes

-- 1. Authoritative Corpus State on memes
ALTER TABLE memes ADD COLUMN corpus_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (corpus_status IN ('draft','archive','active','excluded','conflict'));
ALTER TABLE memes ADD COLUMN excluded_at TEXT;
ALTER TABLE memes ADD COLUMN purge_at TEXT;
ALTER TABLE memes ADD COLUMN exclusion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_memes_state_random ON memes(corpus_status, random_key);
CREATE INDEX IF NOT EXISTS idx_memes_purge ON memes(purge_at) WHERE corpus_status = 'excluded';

-- 2. Unified Intake Hash Store on memes
ALTER TABLE memes ADD COLUMN content_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_memes_content_hash ON memes(content_hash) WHERE content_hash IS NOT NULL;

-- 3. Unified Intake Columns on ingestion_batches & ingestion_jobs
ALTER TABLE ingestion_batches ADD COLUMN source TEXT; -- 'admin_upload' | 'r2_sync' | 'legacy'

ALTER TABLE ingestion_jobs ADD COLUMN source TEXT;
ALTER TABLE ingestion_jobs ADD COLUMN sniffed_mime TEXT;
ALTER TABLE ingestion_jobs ADD COLUMN checks_json TEXT;
ALTER TABLE ingestion_jobs ADD COLUMN reject_reason TEXT;
ALTER TABLE ingestion_jobs ADD COLUMN matched_meme_id TEXT;
ALTER TABLE ingestion_jobs ADD COLUMN verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_storage_path ON ingestion_jobs(storage_path);

-- 4. Immutable Audit Logs
CREATE TABLE IF NOT EXISTS meme_state_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meme_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  actor TEXT NOT NULL,
  reason TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS meme_purge_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meme_id TEXT NOT NULL,
  storage_path TEXT,
  content_hash TEXT,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  r2_deleted INTEGER NOT NULL DEFAULT 0,
  detail TEXT, -- votes JSON
  purged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS corpus_maintenance_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ok INTEGER,
  summary_json TEXT
);

CREATE TABLE IF NOT EXISTS curation_legacy_later_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_vote_id INTEGER,
  meme_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  corpus_status TEXT NOT NULL,
  duplicate_of TEXT,
  topics TEXT,
  tone TEXT,
  humour_mechanisms TEXT,
  curator_note TEXT,
  reviewed_at TEXT,
  archived_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_meme_state_log_meme_id ON meme_state_log(meme_id);
CREATE INDEX IF NOT EXISTS idx_meme_purge_log_meme_id ON meme_purge_log(meme_id);
CREATE INDEX IF NOT EXISTS idx_curation_legacy_later_meme ON curation_legacy_later_votes(meme_id);
