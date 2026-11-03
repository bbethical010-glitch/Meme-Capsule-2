-- Durable admin intake state for bulk meme ingestion and advisory AI preprocessing.
-- New intake records remain private until both configured advisory evaluations succeed.

CREATE TABLE IF NOT EXISTS ingestion_batches (
  id              TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id        TEXT NOT NULL,
  actor_name      TEXT,
  status          TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'processing', 'partial', 'complete', 'failed', 'cancelled')),
  total_items     INTEGER NOT NULL DEFAULT 0,
  total_bytes     INTEGER NOT NULL DEFAULT 0,
  ready_items     INTEGER NOT NULL DEFAULT 0,
  failed_items    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingestion_batches_created
  ON ingestion_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_batches_status
  ON ingestion_batches(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  job_id            TEXT PRIMARY KEY,
  idempotency_key   TEXT NOT NULL UNIQUE,
  batch_id          TEXT NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
  -- meme_id is intentionally not a foreign key: the durable job exists before
  -- the R2 upload creates the private memes metadata row.
  meme_id           TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  title             TEXT NOT NULL,
  content_hash      TEXT NOT NULL,
  byte_size         INTEGER NOT NULL,
  mime_type         TEXT NOT NULL,
  media_type        TEXT NOT NULL DEFAULT 'image' CHECK (media_type = 'image'),
  duplicate_of_job_id TEXT,
  upload_state      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (upload_state IN ('pending', 'uploading', 'uploaded', 'failed')),
  state             TEXT NOT NULL DEFAULT 'queued'
                    CHECK (state IN ('queued', 'processing', 'retry_wait', 'failed', 'human_ready')),
  storage_path      TEXT,
  error_code        TEXT,
  error_message     TEXT,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  lease_owner       TEXT,
  lease_expires_at  TEXT,
  next_attempt_at   TEXT,
  last_attempt_at   TEXT,
  completed_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_batch
  ON ingestion_jobs(batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_state
  ON ingestion_jobs(state, next_attempt_at, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_upload
  ON ingestion_jobs(upload_state, updated_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_hash
  ON ingestion_jobs(content_hash);

CREATE TABLE IF NOT EXISTS ingestion_ai_evaluations (
  id                TEXT PRIMARY KEY,
  job_id            TEXT NOT NULL REFERENCES ingestion_jobs(job_id) ON DELETE CASCADE,
  meme_id           TEXT NOT NULL,
  judge_key         TEXT NOT NULL CHECK (judge_key IN ('judge4', 'judge5')),
  provider_key      TEXT,
  model             TEXT,
  state             TEXT NOT NULL DEFAULT 'pending'
                    CHECK (state IN ('pending', 'processing', 'retry_wait', 'succeeded', 'failed')),
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  decision          TEXT,
  topics            TEXT NOT NULL DEFAULT '[]',
  tone              TEXT,
  humour_mechanisms TEXT NOT NULL DEFAULT '[]',
  confidence        REAL,
  reasoning         TEXT,
  result_json       TEXT,
  error_code        TEXT,
  error_message     TEXT,
  started_at        TEXT,
  finished_at       TEXT,
  next_attempt_at   TEXT,
  lease_owner       TEXT,
  lease_expires_at  TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(job_id, judge_key)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_ai_job
  ON ingestion_ai_evaluations(job_id, judge_key);
CREATE INDEX IF NOT EXISTS idx_ingestion_ai_state
  ON ingestion_ai_evaluations(state, next_attempt_at, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_ai_meme
  ON ingestion_ai_evaluations(meme_id, judge_key);
