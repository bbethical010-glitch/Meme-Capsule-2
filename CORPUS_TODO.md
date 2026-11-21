# Corpus Restructure Implementation Plan & Audit (v2)

> **File:** `CORPUS_TODO.md`  
> **Status:** Step 0 Audit Complete — Implementation Ready  
> **Target Scope:** Pages Functions, Cloudflare D1 (`meme-capsule-db`), Cloudflare R2 (`memes` bucket — 2.65k objects / 405.93 MB), Curation Engine, Admin Dashboard, SuperAdmin Dashboard  
> **Restore Point Remote Tag:** `restore-point-pre-corpus-v2`  
> **Restore Point Backup Branch:** `backup-before-corpus-v2-main`  

---

## Step 0: Read and Audit (Comprehensive Findings)

### a) Read and Write Mapping for State Fields (file:line)

#### `memes.status` and `memes.is_active`:
- **Writes:**
  - `functions/api/admin/sync-r2.ts:146-160`: `INSERT INTO memes ... status='archived', is_active=0` (new files from R2 dump)
  - `functions/api/admin/memes.ts:287-295`: `INSERT INTO memes ... status=?, is_active=?` (admin manual creation)
  - `functions/api/admin/memes.ts:351-365`: `UPDATE memes SET status = ?, is_active = ? WHERE id = ?` (admin meme edit)
  - `functions/api/admin/memes.ts:390`: `UPDATE memes SET status = 'archived', is_active = 0, curation_status = CASE WHEN curation_status = 'keep' THEN 'review_later' ELSE curation_status END WHERE id = ?`
  - `functions/api/admin/ingestion/upload.ts:39`: `INSERT OR IGNORE INTO memes ... status = 'draft', is_active = 0` (intake draft creation)
  - `functions/api/admin/ingestion/upload.ts:53`: `UPDATE memes SET status = 'draft', is_active = 0 WHERE id = ? AND is_active = 0`
  - `functions/api/curate/save.ts:133`: `UPDATE memes SET is_active = ? WHERE id = ?`
  - `functions/api/curate/approve.ts:245`: `UPDATE memes SET is_active = ?, status = ?, curation_status = ? WHERE id = ?`
  - `functions/api/curate/super/resolve.ts:120, 126`: `UPDATE memes SET is_active = ?, status = ?, curation_status = ? WHERE id = ?`
  - `functions/api/curate/super/bulk-resolve.ts:130`: `UPDATE memes SET is_active = ?, status = ?, curation_status = ? WHERE id = ?`
  - `functions/api/cat/force-remove.ts:119`: `UPDATE memes SET is_active = 0, status = ? WHERE id = ?`
  - `functions/reports.ts:385`: `UPDATE memes SET status = 'archived', is_active = 0 WHERE id = ?`
  - `functions/api/like.ts:44`: `INSERT INTO memes ... status = 'draft', is_active = 0` (fallback seed)
- **Reads:**
  - `functions/_shared/d1r2.ts:148`: `WHERE m.is_active = 1 AND m.status = 'active'` (public random meme delivery)
  - `functions/_shared/d1r2.ts:192`: `WHERE m.is_active = 1 AND m.status = 'active'` (public daily meme delivery)
  - `functions/api/catalog.ts:57`: `WHERE m.is_active = 1 AND m.status = 'active'`
  - `functions/api/curate/next.ts:212, 320`: `WHERE m.status = 'draft'` vs `archived`
  - `functions/api/admin/memes.ts:122, 137`: filter by `m.status` and `m.is_active`
  - `functions/api/curate/super/summary.ts:40-60`: `COUNT(*)` grouped by `m.status`, `m.is_active`

#### `meme_curation_final.corpus_status`:
- **Writes:**
  - `functions/api/curate/approve.ts:237`: `INSERT INTO meme_curation_final (meme_id, corpus_status, ...) VALUES (?, ?, ...)`
  - `functions/api/curate/super/resolve.ts:72`: `INSERT INTO meme_curation_final (meme_id, corpus_status, ...) VALUES (?, ?, ...)`
  - `functions/api/curate/super/bulk-resolve.ts:96`: `INSERT INTO meme_curation_final (meme_id, corpus_status, ...) VALUES (?, ?, ...)`
  - `functions/api/admin/memes.ts:342, 395`: `UPDATE meme_curation_final SET corpus_status = 'review_later' ... WHERE meme_id = ? AND corpus_status = 'keep'`
  - `functions/_shared/forceRemove.ts:84`: `DELETE FROM meme_curation_final WHERE meme_id = ?`
  - `functions/api/admin/memes/hard-delete.ts:60`: `DELETE FROM meme_curation_final WHERE meme_id = ?`
- **Reads:**
  - `functions/_shared/d1r2.ts:149, 191`: `INNER JOIN meme_curation_final f ON m.id = f.meme_id WHERE ... f.corpus_status = 'keep'`
  - `functions/api/catalog.ts:55`: `INNER JOIN meme_curation_final f ON m.id = f.meme_id`
  - `functions/api/curate/super/summary.ts:71, 93, 235`: read resolved counts and unfinalized splits
  - `functions/api/curate/super/export.ts:47`: `FROM meme_curation_final f WHERE f.corpus_status = 'keep'`
  - `functions/api/admin/memes.ts:178, 210, 275, 330`: verify `corpus_status == 'keep'` gate before allowing active state

#### `ingestion_jobs.state`:
- **Writes:**
  - `functions/api/admin/ingestion/batches.ts:303`: `INSERT INTO ingestion_jobs ... state = 'queued', upload_state = 'pending'`
  - `functions/api/admin/ingestion/upload.ts:92`: `SET state = 'human_ready', completed_at = ?`
  - `functions/api/admin/ingestion/upload.ts:104`: `SET upload_state = 'failed', state = 'queued'`
  - `functions/api/admin/ingestion/upload.ts:204`: `SET upload_state = 'uploaded', state = 'queued'`
  - `functions/api/admin/ingestion/upload.ts:225, 250`: `SET state = 'retry_wait'`
  - `functions/api/admin/ingestion/process.ts:236, 251`: `SET state = 'processing'`
  - `functions/api/admin/ingestion/process.ts:284`: `SET state = 'succeeded'` (evaluations)
  - `functions/api/admin/ingestion/process.ts:421`: `SET state = 'human_ready'`
  - `functions/api/admin/ingestion/process.ts:460`: `SET state = 'retry_wait'`
  - `functions/api/curate/advisory-save.ts:202`: `SET state = 'human_ready'`
  - `functions/api/admin/ingestion/retry.ts:33, 40`: reset to `queued` / `pending`
- **Reads:**
  - `functions/_shared/ingestion.ts:341`: `SUM(CASE WHEN state = 'human_ready' THEN 1 ELSE 0 END)`
  - `functions/api/curate/list.ts:39`: `AND (ij.meme_id IS NULL OR ij.state = 'human_ready')`
  - `functions/api/curate/next.ts:169, 323`: filter for `human_ready`
  - `functions/api/curate/super/memes.ts:72`: check `ij.state = 'human_ready'`

---

### b) Dependency Map (`meme_id` Tables)

Audited via `sqlite_master` and `PRAGMA foreign_key_list`:

| Table Name | Column Name | Classification | Deletion Action in `purgeMeme` |
|---|---|---|---|
| `memes` | `id` | ROOT | Primary entity (deleted last in D1 batch) |
| `meme_curation` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `meme_curation_final` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `ai_curation_predictions` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `meme_events` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `meme_analytics` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `meme_daily_stats` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `cat_decisions` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `cat_consensus` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `ai_judge_processed` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `ingestion_jobs` | `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `ingestion_ai_evaluations`| `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `android_analytics_events`| `meme_id` | **DEPENDENT** | DELETE WHERE meme_id = ? |
| `meme_force_removals` | `meme_id` | **AUDIT** | PRESERVED (Permanent historical audit log) |
| `meme_state_log` (Step 1)| `meme_id` | **AUDIT** | PRESERVED (Transition history log) |
| `meme_purge_log` (Step 1)| `meme_id` | **AUDIT** | PRESERVED (Purge audit with votes & hash) |
| `curation_legacy_later_votes` (Step 1)| `meme_id` | **AUDIT** | PRESERVED (30-day legacy backup) |

---

### c) Current Distributions & Production R2 Object State

- **Cloudflare R2 Bucket (`memes`)**: Exactly **2.65k objects**, total size **405.93 MB** (verified from production dashboard screenshot).
- **Local Miniflare Test D1**:
  - `memes`: 3 rows, status `archived`, is_active `0` (and in secondary DB: 3 rows, status `active`, is_active `1`).
  - Storage paths populated: 0 in local test DB (tests use dummy urls).
- **Production D1 Distribution**:
  - Step 11 (`scripts/migrate-corpus-status.ts --dry-run`) is specifically architected to run against the production database to output the live breakdown of:
    - `status x is_active`
    - Memes with successful AI Judge 4 evaluation (`ingestion_ai_evaluations.state = 'succeeded'` / `ai_curation_predictions`)
    - Memes with 0/1/2/3 votes (distinguishing `review_later`)
    - Memes with ledger row (`meme_curation_final`)
    - Unverified memes & duplicate storage paths.

---

### d) CHECK Constraints on `memes.status` and Votes Decision Columns

- `memes.status`: `CHECK (status IN ('active', 'draft', 'archived'))` (defined in `d1/schema.sql` line 14).
- `meme_curation.corpus_status`: `CHECK (corpus_status IN ('keep', 'excluded', 'duplicate', 'review_later'))` (defined in `000_complete_setup.sql` line 44, `004_curation.sql` line 13).
- `meme_curation_final.corpus_status`: `CHECK (corpus_status IN ('keep', 'excluded', 'duplicate', 'review_later'))` (defined in `005_curation_final.sql` line 8).
- *Plan Step 1 Additive Column:* `memes.corpus_status TEXT NOT NULL DEFAULT 'draft' CHECK (corpus_status IN ('draft','archive','active','excluded','conflict'))`.

---

### e) Auto-Triggers for `/ingestion/process`

- Found in `src/lib/adminApi.ts:287` (`processIngestionItem`).
- **No cron, queue, or automatic background trigger calls `/api/admin/ingestion/process`.**
- Stage 1 upload in `BulkIngestionWorkspace.tsx` uploads directly to R2 and creates D1 draft rows without calling `/process`.
- Step 4 enforces `AI_JUDGE_AUTOMATION_ENABLED = false` (default) and wires manual triggering only from the verified DRAFT view.

---

### f) Batch Assignment & Counters

- **Add Meme Tab Intake**: `ingestion_batches` row created via `POST /api/admin/ingestion/batches` with UUID `batch-{timestamp}-{random}`. Batch total items and total bytes are stored, while progress counters (`uploaded_items`, `ready_items`, `failed_items`) are computed dynamically via SQL queries joining `ingestion_jobs`.
- **R2 Sync / Direct Dump**: Previously created **no batch** and **no job**. Migration 028 assigned legacy batches retroactively. Under Step 3 & 3B, every sync run creates an `ingestion_batches` row with `source = 'r2_sync'` and creates `ingestion_jobs` rows through `intakeMeme()`.
- **Counters**: Derived dynamically from `ingestion_jobs` via `GROUP BY batch_id`, not stored statically.

---

### g) Worker Configurations & R2 Bindings

1. `wrangler.toml` (Cloudflare Pages Project: `meme-capsule`):
   - `DB`: `meme-capsule-db` (`64e2bb16-1557-4d53-8e6b-5197c8636d09`)
   - `MEMES_BUCKET`: `memes` (**Has R2 binding**)
   - `ANALYTICS_KV`: `078fce53803845b3a47751baef405341`
2. `workers/wrangler.analytics.toml` (`meme-capsule-analytics`):
   - `DB`: `meme-capsule-db`
   - `ANALYTICS_KV`: `078fce53803845b3a47751baef405341`
   - (**No R2 binding**)
3. `workers/wrangler.notifications.toml` (`meme-capsule-notifications`):
   - `DB`: `meme-capsule-db`
   - `MEMES_BUCKET`: `memes` (**Has R2 binding**)
4. `workers/wrangler.curation.toml` (New maintenance worker to be added in Step 7):
   - `DB`: `meme-capsule-db`
   - `MEMES_BUCKET`: `memes` (**Requires both DB and R2 bindings**)

---

### h) Storage Location of Excluded Media ("Quarantine")

- Excluded media remains in bucket `memes` at its original `storage_path` (e.g. `ingestion/batch-.../meme-.../hash-uuid-name.ext` or `filename.jpg`).
- There is **no physical quarantine bucket or subdirectory**. "Quarantine" is purely a logical state (`corpus_status = 'excluded'` with `purge_at = now + 7 days`).
- Purge operation deletes the physical object at `storage_path.replace(/^\/+/, "")`.

---

### i) Comprehensive Audit of `review_later`

- **Backend Endpoints & Logic:**
  - `functions/_shared/curationConsensus.ts:1`: `CorpusStatus` type includes `"review_later"`.
  - `functions/api/curate/save.ts`: accepts `review_later` as a vote.
  - `functions/api/curate/next.ts:437`: filters queue by `review_later`.
  - `functions/api/curate/list.ts:43`: lists `review_later` items.
  - `functions/api/curate/super/summary.ts:19, 115`: counts `review_later` in summary metrics.
  - `functions/api/admin/memes.ts:148, 342, 346, 390`: falls back to `review_later` on manual archive.
  - `functions/api/admin/ingestion/process.ts:21, 90, 144`: AI judge fallback to `review_later`.
- **Frontend Components & UI:**
  - `src/types.ts:19`, `src/curate/curateTypes.ts:41, 97, 110`: status types include `review_later`.
  - `src/curate/CurateApp.tsx:1152, 1198, 1209, 1441, 1686, 2048, 2318`: `review_later` buttons, keyboard shortcut handling, dropdown filters, badge styling.
  - `src/curate/CurationStatsModal.tsx:94`: `stats.counts.review_later` stat box.
  - `src/curate/AiReviewPanel.tsx:341`: editorial actions legend.
  - `src/admin/AdminApp.tsx:250, 1618, 1621`: manual curation action option.
  - `src/curate/ai-judge/AiJudgeConsole.tsx:741, 1723, 1794`: fallback configuration option.
- **Action under Plan:** Completely removed from all interfaces, shortcuts, legends, and endpoints. Any incoming vote with `review_later` is rejected with HTTP 400. Legacy `review_later` rows archived to `curation_legacy_later_votes` in Step 11.

---

### j) Quick Judge Mode & Judge Accounts

- **Quick Judge Mode / Unauthenticated Fallback:**
  - In `functions/api/curate/save.ts:82`: `const userId = sessionUser?.id || (body.user_id ? body.user_id.trim() : "user-judge1");`
  - In `functions/api/curate/next.ts:163`: `const userId = sessionUser?.id || "user-judge1";`
  - If no session exists or Quick Judge mode is used, actions are recorded as `user-judge1` ("Judge One").
- **The Stray 4th "Judge" Account:**
  - `user-judge4` has `role = 'judge'`, username `'ai-judge'`, display name `'AI Judge'`.
  - Because its role is `'judge'`, generic queries (`SELECT * FROM cat_users WHERE role = 'judge'`) returned 4 judges (`judge1`, `judge2`, `judge3`, `user-judge4`).
  - Under Section 5: Only active users with role `judge` and username in (`judge1`, `judge2`, `judge3`) count toward the 3-human consensus. `user-judge4` / `ai-judge` is strictly advisory.

---

### k) Duplicate Coverage Across Intake Routes

| Route | Pre-flight Hash Check? | Target Checked | Hash Algorithm | Stored Hash Location | Legacy / Direct Hash? |
|---|---|---|---|---|---|
| **Add Meme tab** | Yes (advisory browser SHA-256) | `ingestion_jobs.content_hash` only | SHA-256 | `ingestion_jobs.content_hash` | No hash on `memes` row |
| **R2 Sync (`sync-r2`)** | No | None (checked only key / url match) | None | None | None |
| **Wrangler CLI / SQL** | No | None | None | None | None |

- **Root Cause Identified:** Duplicates were checked solely against `ingestion_jobs.content_hash`. Memes created via R2 sync, direct CLI, or before migration 025 had zero hash records.
- **Fix in Step 1 & 3:** Add `memes.content_hash` as the canonical hash store; `intakeMeme()` computes and stores streaming SHA-256 for all routes. Step 3C provides resumable legacy backfill.

---

### l) Route Comparison Matrix

| Aspect | Route A: R2 Dump + `sync-r2` | Route B: Wrangler CLI / Direct D1 | Route C: Add Meme Tab (Admin) | Unified Target (`intakeMeme`) |
|---|---|---|---|---|
| **File-type Check** | File extension only (`mediaExtensions`) | None | Browser magic-byte sniff + edge check | `verifyObject`: magic-byte sniff + extension match |
| **Hashing** | None | None | Browser WebCrypto SHA-256 | Edge streaming `crypto.DigestStream` SHA-256 |
| **Size Limit** | None | None | 20 MiB (`INGESTION_MAX_FILE_BYTES`) | Enforced 20 MiB max, non-zero |
| **Allowed Exts** | `.jpg, .jpeg, .png, .gif, .webp, .avif, .svg, .bmp, .mp4, .webm, .mov, .avi, .mkv` | Any | Images only: `.jpg, .jpeg, .png, .gif, .webp, .heic` | `ALLOWED_MEDIA` unified map |
| **Duplicate Check**| None | None | Against `ingestion_jobs.content_hash` | Against `memes.content_hash` + in-flight jobs |
| **Batch/Job Reg.** | None (skipped completely) | None | `ingestion_batches` + `ingestion_jobs` | `ingestion_batches` + `ingestion_jobs` (`source`) |
| **Initial State** | `status = 'archived', is_active = 0` | Dependent on raw SQL (default `draft`) | `status = 'draft', is_active = 0` | `corpus_status = 'draft', is_active = 0` |
| **Category** | `'Synced'` | Raw SQL insert | `'Unsorted'` | `'Unsorted'` (never `'Synced'`) |
| **Random Key** | `Math.random()` | Null or raw SQL | `Math.random()` | Single function assignment |
| **AI Triggering** | Skipped | Skipped | Manual or decoupled | Manual only from verified DRAFT view |
| **Storage Key** | Existing R2 key | Arbitrary | `ingestion/{batch}/{meme}/{hash16}-{uuid}-{name}` | Kept as provided; real key in `storage_path` |

#### Route Divergence Matrix: "Can a file be treated differently here? How?"
- **Before:** Yes! A file dumped to R2 bypassed all duplicate checks, file integrity, MIME sniffing, batch registration, and landed directly in `archived` as `'Synced'`. A file uploaded via Add Meme tab went into `draft` as `'Unsorted'` with hash tracking.
- **After (Path Equivalence Invariant):** All routes call `intakeMeme()`. Same validation, same streaming SHA-256, same duplicate check against `memes.content_hash`, same job/batch registration, same initial state (`corpus_status = 'draft'`), same `'Unsorted'` category.

---

### m) What "Replace Existing" Does Today

In `functions/api/admin/ingestion/upload.ts:72-99` (`replaceExistingMemeMedia`):
1. Updates `memes SET storage_path = ?, uploaded_at = ? WHERE id = targetMemeId`
2. Updates `ingestion_jobs SET meme_id = ?, state = 'human_ready' WHERE job_id = ?`
3. Physically deletes old R2 object: `await env.MEMES_BUCKET.delete(oldStoragePath)`
- **Issues identified:** Does not purge dependent child rows; does not reset consensus/votes; does not check if the existing meme is currently ACTIVE in the app; does not log to `meme_purge_log`.
- **Fix in Step 3:** Replace Existing calls `purgeMeme(env, oldMemeId, {reason: 'replace_existing', actor})` and `intakeMeme()` for the new file. Requires explicit confirmation if existing meme is ACTIVE.

---

### n) Duplicate `storage_path` Values in `memes`

- Tested against local SQLite instances: 0 duplicate `storage_path` values.
- Step 1 creates `CREATE INDEX IF NOT EXISTS idx_memes_content_hash ON memes(content_hash) WHERE content_hash IS NOT NULL`.
- Creation of `CREATE UNIQUE INDEX idx_memes_storage_path` is conditioned on Step 11 dry-run confirming zero duplicates in production D1.

---

## Master Implementation Checklist

- [x] **Step 0: Read and Audit**
  - [x] Record answers (a) through (n) in `CORPUS_TODO.md`
  - [x] Verify remote sync and GitHub restore points
- [x] **Step 1: Schema Migration**
  - [x] Create `d1/migrations/029_corpus_restructure.sql` (additive columns, indices, `meme_state_log`, `meme_purge_log`, `corpus_maintenance_runs`, `curation_legacy_later_votes`)
- [x] **Step 2: Single State Writer**
  - [x] Create `functions/_shared/corpus.ts` with `evaluateConsensus(votes)`, `applyConsensus(env, memeId)`, `transitionMeme(...)`
  - [x] Add `scripts/check-state-writers.ts` to enforce zero unauthorized state writes
- [x] **Step 3: Unified Intake Pipeline**
  - [x] Create `functions/_shared/intake.ts` with `ALLOWED_MEDIA`, `verifyObject`, and `intakeMeme`
  - [x] Refactor Add Meme upload endpoint to call `intakeMeme`
- [x] **Step 3B: Rebuild `sync-r2` on Intake Pipeline**
  - [x] Update `functions/api/admin/sync-r2.ts` to call `intakeMeme` for new files and `purgeMeme` for deletions
  - [x] Implement chunking (max 25 per subrequest) and dry-run safety
- [x] **Step 3C: Duplicates & Legacy Backfill**
  - [x] Implement manual resumable backfill for unverified legacy memes
  - [x] Build read-only duplicate audit script/endpoint
- [x] **Step 4: AI Judge Manual Only**
  - [x] Ensure `AI_JUDGE_AUTOMATION_ENABLED = false`
  - [x] Wire manual RUN AI JUDGE from verified DRAFT view with lease management
- [x] **Step 5: Judge-Facing Rules**
  - [x] Remove REVIEW LATER everywhere (UI, hotkeys, legends, filters, endpoints)
  - [x] Enforce 3-human consensus (`keep`, `excluded`, `duplicate`)
  - [x] Isolate ARCHIVE queue to unvoted items for that judge
- [x] **Step 6: SuperAdmin Actions & Arbitration**
  - [x] Implement CONFLICT arbitration (`superadmin_arbitration`)
  - [x] Implement EXCLUDED review with 7-day countdown and EDIT VOTE
  - [x] Remove obsolete bulk auto-resolve buttons
- [x] **Step 7: Unified Purge & Curation Maintenance Worker**
  - [x] Create `purgeMeme` in `functions/_shared/corpus.ts` covering all DEPENDENT tables + R2
  - [x] Create `workers/curationMaintenance.ts` and `workers/wrangler.curation.toml` (cron + token POST)
- [x] **Step 8: Ghost Scans & Integrity Classes**
  - [x] Implement `scanGhosts(env)` and `purgeGhosts(env, {classes, confirm})` for classes (a) through (i)
  - [x] Add tests ensuring purged memes cannot be recreated
- [x] **Step 9: Public API Alignment**
  - [x] Update `randomMemeOrFallback` and `getDailyMeme` to query `m.corpus_status = 'active' AND f.corpus_status = 'keep'`
  - [x] Verify index usage and invariant public JSON shape
- [x] **Step 10: Single Source of Truth Counts & Category Cards UI**
  - [x] Implement `GET /api/admin/corpus/summary`
  - [x] Build shared `CorpusCategoryCards` component and use across Admin and SuperAdmin
  - [x] Clean up obsolete metric cards and NSFW counters from dashboards
- [x] **Step 11: Legacy Data Migration**
  - [x] Write `scripts/migrate-corpus-status.ts` with `--dry-run` default
  - [x] Verify all migration rules (legacy live, review_later backup, 3-vote consensus, archive, draft)
- [x] **Step 12: Comprehensive Test Suite**
  - [x] Test `evaluateConsensus` across all 27 permutations
  - [x] Test `transitionMeme` and concurrency
  - [x] Test path equivalence for all media fixtures
  - [x] Test `purgeMeme` dependency cleanup
- [x] **Step 13: Final Verification & Build**
  - [x] `npm run build` and `npx tsc --noEmit` pass
  - [x] `check-state-writers` passes
  - [x] Deliver deployment instructions (without deploying to production)
