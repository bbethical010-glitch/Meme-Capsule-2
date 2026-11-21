CREATE TABLE IF NOT EXISTS memes (
  id TEXT PRIMARY KEY DEFAULT ('meme-' || hex(randomblob(6))),
  title TEXT NOT NULL DEFAULT 'Untitled meme',
  image_url TEXT,
  storage_path TEXT,
  source_link TEXT,
  category TEXT NOT NULL DEFAULT 'Unsorted',
  tags TEXT NOT NULL DEFAULT '[]',
  duplicate_of TEXT,
  topics TEXT NOT NULL DEFAULT '[]',
  tone TEXT,
  humour_mechanisms TEXT NOT NULL DEFAULT '[]',
  rarity TEXT NOT NULL DEFAULT 'Common' CHECK (rarity IN ('Common', 'Rare', 'Legendary')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  input_method TEXT NOT NULL DEFAULT 'url' CHECK (input_method IN ('url', 'upload', 'google-drive', 'seed')),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  shown_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  rights_note TEXT NOT NULL DEFAULT 'reviewed',
  share_text TEXT NOT NULL DEFAULT 'Spawned from Meme Capsule',
  random_key REAL NOT NULL DEFAULT (abs(random()) / 9223372036854775807.0),
  is_nsfw INTEGER NOT NULL DEFAULT 0 CHECK (is_nsfw IN (0, 1)),
  nsfw_flagged_by TEXT,
  corpus_status TEXT NOT NULL DEFAULT 'draft' CHECK (corpus_status IN ('draft', 'archive', 'active', 'excluded', 'conflict')),
  excluded_at TEXT,
  purge_at TEXT,
  exclusion_reason TEXT,
  content_hash TEXT,
  CHECK (image_url IS NOT NULL OR storage_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_memes_is_nsfw ON memes(is_nsfw);
CREATE INDEX IF NOT EXISTS idx_memes_state_random ON memes(corpus_status, random_key);
CREATE INDEX IF NOT EXISTS idx_memes_purge ON memes(purge_at) WHERE corpus_status = 'excluded';
CREATE INDEX IF NOT EXISTS idx_memes_content_hash ON memes(content_hash) WHERE content_hash IS NOT NULL;

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
  detail TEXT,
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
