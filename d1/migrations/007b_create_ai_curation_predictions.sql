-- 007b_create_ai_curation_predictions.sql
-- Corrective additive migration: ensures ai_curation_predictions and legacy ai_cat_decisions tables exist
-- prior to 008_optimize_curation_indexes.sql creating index idx_ai_predictions_meme
-- and 010_enforce_superadmin_active_and_cleanup_judges.sql cleaning ai_cat_decisions.

CREATE TABLE IF NOT EXISTS ai_curation_predictions (
  meme_id           TEXT PRIMARY KEY,
  storage_path      TEXT,
  image_url         TEXT,
  corpus_status     TEXT,
  topics            TEXT NOT NULL DEFAULT '[]',
  tone              TEXT,
  humour_mechanisms TEXT NOT NULL DEFAULT '[]',
  confidence        REAL NOT NULL DEFAULT 0,
  reasoning         TEXT,
  model             TEXT,
  tokens_used       INTEGER NOT NULL DEFAULT 0,
  processing_ms     INTEGER NOT NULL DEFAULT 0,
  raw_response      TEXT,
  error             TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (meme_id) REFERENCES memes(id)
);

CREATE TABLE IF NOT EXISTS ai_cat_decisions (
  id TEXT PRIMARY KEY
);

