# Meme Capsule — Implementation Walkthrough and Phase History

> **History scope:** This document records the Admin Overhaul plan's Phases 0–7.
> It also preserves the older Android analytics and curation verification notes
> that were already present in this file. Those similarly named analytics phases
> are separate from the Admin Overhaul phase numbers.
>
> **Last updated:** 2026-11-03 10:33:30 +05:30

## Source-of-truth and current branch state

- The complete Admin Overhaul Phase 0–7 plan is available in the governing task
  instructions and is reproduced in verified scope form below. The Phase 0 audit
  is `docs/ADMIN_OVERHAUL_AUDIT.md`.
- The workspace was synchronized with `origin/main`, which advanced from
  `2cafbe8d...` to `7c32bda` during the Phase 4 start check. The remote change is
  the unrelated random-meme repetition/rebalancing work in
  `functions/_shared/d1r2.ts`, `functions/api/random-meme.ts`,
  `functions/api/admin/rebalance-random-keys.ts`, and related documentation.
- Existing local work was preserved through the fast-forward. The tracked root
  `AGENT_RULES.md` deletion remains pre-existing workspace state; the complete
  canonical `docs/AGENT_RULES.md` was read before this phase work.
- No production deployment, migration, R2 deletion, or secret-bearing operation
  was performed during the Phase 4 groundwork.

## Admin Overhaul Phase 0 — Audit and scope lock

### Objective

Audit the current Admin Console, curation, AI, public delivery, authentication,
R2/D1 operations, migration history, and documentation before any schema or
behavior change.

### Verified implementation details

- Read the repository rules, project context, current state, database references,
  migration inventory, API/UI entry points, worker code, and existing tests.
- Confirmed `main` was synchronized with `origin/main` at the original audit
  baseline before Phase 3 work.
- Confirmed intentional duplicate migration prefixes `004`, `011`, and `021`,
  migration history through `024`, and no existing `025_` migration.
- Mapped the distinct AI stores (`ai_curation_predictions`,
  `ai_judge_processed`, and legacy `memes.ai_*` contracts), human consensus,
  public final-`keep` gating, R2/D1 operations, and Android/notification systems.
- Recorded the current governance concern: the continuous browser AI loop can
  invoke the human approval endpoint, while the approved architecture requires
  AI to remain advisory.
- Recorded the clean local migration-chain failure at historical migration 008
  because `ai_curation_predictions` is not created before its index.

### Files and records

- `docs/ADMIN_OVERHAUL_AUDIT.md`: complete audit, dependency map, candidate
  schema/state design, compatibility strategy, required checks, and blockers.
- Existing repository rules, database docs, state docs, migration files, API
  routes, workers, and test files were inspected without functional changes.

### Verification and status

- `git fetch origin`: passed at audit time.
- Frontend build, analytics tests, and consensus tests passed at the audit
  baseline; Functions typecheck and clean local migration apply exposed recorded
  pre-existing failures.
- **Status:** Completed as an audit. Production behavior and schema were not
  changed in Phase 0.

## Admin Overhaul Phase 1 — Durable ingestion state

### Objective and planned implementation

Introduce a unique `025_` migration and durable batch/item/evaluation state
without overloading `memes.status`. The planned states are batch/item queued,
processing, retry-wait, failed, and human-ready, with idempotency, leases,
bounded errors, independent AI evaluation records, and an optional media
operation saga.

### Implementation record

- Added `d1/migrations/025_durable_meme_ingestion.sql` with additive
  `ingestion_batches`, `ingestion_jobs`, and `ingestion_ai_evaluations` tables.
  The tables store stable idempotency keys, generated intake IDs, content hashes,
  upload state, retry/lease state, bounded errors, and per-judge advisory result
  fields. Historical migrations were not edited.
- Added `functions/_shared/ingestion.ts` for server-side limits, image-signature
  checks, SHA-256 helpers, schema availability checks, batch status derivation,
  and read-only human-ready lookup. New intake tables do not replace
  `memes.status` or human curation tables.
- Added authenticated `/api/admin/ingestion/batches` creation/read,
  `/api/admin/ingestion/upload`, and `/api/admin/ingestion/retry` contracts.
  Batch creation is idempotent; upload uses unique R2 keys and persists a
  private archived/inactive `memes` row only after R2 success. R2-success/D1
  failure remains recoverable through the durable job row.
- Added queue compatibility gates to `functions/api/curate/next.ts`,
  `functions/api/curate/list.ts`, and `functions/api/curate/super/memes.ts`.
  `functions/api/curate/approve.ts` and `functions/api/curate/save.ts` reject
  editorial votes for a new intake item until its job is `human_ready`; legacy
  rows without a job retain the existing behavior.

### Verification and status

- The migration SQL was executed against the disposable local D1 state and all
  three new tables were verified with `PRAGMA table_info(...)`.
- Remote schema verification was attempted read-only but is blocked because this
  environment has no `CLOUDFLARE_API_TOKEN`; no production migration or query
  was executed.
- **Status:** Implemented locally. Production use requires applying migration
  `025` after the remote migration-history/bootstrap decision is resolved.

## Admin Overhaul Phase 2 — AI preprocessing and human-ready gating

### Objective and planned implementation

Require both configured advisory AI evaluations to persist successfully before a
new intake item becomes eligible for human curation. The planned worker must
claim/recover jobs, retry bounded transient failures, validate structured output,
persist results, and never write human ballots or call human approval endpoints.
New items remain archived and inactive; legacy items without ingestion jobs retain
legacy queue behavior.

### Implementation record

- Added `functions/api/admin/ingestion/process.ts`, a bounded, lease-aware
  processor for one uploaded job at a time. It loads the configured Judge 4 and
  Judge 5 advisory presets, fetches the private R2 object, validates structured
  taxonomy output, persists independent evaluation rows, and retries transient
  provider failures up to three attempts with bounded backoff.
- The processor never calls `/api/curate/approve`, never writes `meme_curation`,
  never creates a final keep, and never activates a meme. Only both successful
  evaluation rows transition the job to `human_ready`.
- An optional compatibility write updates `ai_curation_predictions` for the
  existing read-only advisory preview; durable evaluation rows remain the
  readiness source. Missing legacy preview storage does not block readiness.
- The processor uses existing encrypted `cat_judge_ai_presets` records for the
  stable `judge4` and `judge5` keys. Missing provider configuration is recorded
  as a bounded terminal item error that can be retried after configuration.

### Verification and status

- New intake gating and the advisory-only boundary are covered by code paths and
  the frontend status surface; existing 9-case human consensus tests remain
  unchanged and pass.
- This release uses an authenticated, UI-driven bounded processor endpoint
  rather than adding a separate scheduled Worker. Durable leases and retry state
  make later Worker scheduling additive without changing the data contract.
- **Status:** Implemented locally with the documented request-driven processor
  decision. Provider configuration and production migration remain rollout
  prerequisites.

## Admin Overhaul Phase 3 — Navigation and retired Admin views

- Reorganized `/admin` into Collection, Curation, and Operations groups while
  retaining the Neo-Brutalist visual system.
- Added an accessible desktop collapse/icon-rail control with hover/focus
  expansion, a pin/toggle control, keyboard focus states, and a mobile drawer
  with an overlay close action.
- Added direct navigation from the Admin Console to Human Curation (`/curate`),
  AI Judge Workflow (`/ai-judge`), and Reports / Moderation (`/reports`).
- Retired the Admin Analytics and legacy Admin AI Categorisation React views and
  deleted their exclusive frontend modules. Legacy Admin analytics/AI backend
  endpoints, Android telemetry, notification APIs/workers, `/categorise`, and
  the separate `/ai-judge` workflow remain preserved.
- No database migration or schema change was made in this phase.
- Verification: `npm run build` passed with the existing Vite chunk-size warning;
  `npm run test:analytics` passed 5/5; `node --test
  tests/curationConsensus.test.mjs` passed 9/9; targeted source-reference and
  documentation checks found no remaining Admin Analytics or legacy Admin AI UI
  imports.

### Phase 3 implementation record

- `src/admin/AdminApp.tsx`: grouped Collection/Curation/Operations navigation,
  direct links to `/curate`, `/ai-judge`, and `/reports`, accessible menu state,
  and Add Memes routing.
- `src/admin/admin.css`: responsive mobile drawer/backdrop, desktop collapse/icon
  rail, hover/focus expansion, labels/tooltips, and keyboard focus styling.
- Deleted exclusive frontend modules under `src/admin/ai/` and
  `src/admin/analytics-dashboard/`.
- Updated `docs/ADMIN_OVERHAUL_AUDIT.md`, `docs/DATABASE.md`, `docs/GEMINI.md`,
  `docs/PROJECT_STRUCTURE.md`, `docs/README.md`, `docs/README_ANALYTICS.md`,
  `docs/STATE.md`, and this walkthrough. Backend analytics, Android telemetry,
  notification workers, `/categorise`, `/curate`, and `/ai-judge` were retained.
- **Status:** Completed locally; no migration or production deployment.

## Admin Overhaul Phase 4 — Bulk Add Memes workspace

### Objective and exact scope from the approved plan

Provide reliable, resumable bulk image ingestion in the Admin Console:

1. Multi-select and drag/drop image intake.
2. Review grid/table with thumbnails, filenames, generated stable IDs, editable
   titles, size/type, duplicate warnings, and validation state.
3. Remove files before submission.
4. Client and server validation; first release rejects video clearly.
5. Confirm the batch and upload with bounded concurrency.
6. Create draft metadata and durable ingestion jobs idempotently.
7. Show per-file upload and AI-processing state.
8. Retry only failed items and preserve progress across refreshes.
9. Use unique R2 keys, server-side type/size/count limits, content hashes where
   feasible, stable retry identities, and recoverable R2-success/D1-failure
   handling.
10. Never publish, create a final keep, set `is_active = 1`, or create a human
    ballot as a side effect of upload.

### Implementation record

- Added `src/admin/BulkIngestionWorkspace.tsx` and
  `src/admin/bulkIngestion.ts`. The Admin Add Memes workspace now supports
  multi-select and drag/drop image review, thumbnails, editable titles,
  generated stable IDs, SHA-256 identities, size/type validation, duplicate
  warnings, removal before submission, per-item upload/AI states, resume-safe
  status refresh, and retry-only-failed actions.
- Added bulk API methods to `src/lib/adminApi.ts` and mounted the workspace from
  `src/admin/AdminApp.tsx` without removing the existing single-meme editor.
- Added responsive Neo-Brutalist bulk intake styling to `src/admin/admin.css`.
  The UI limits batches to 50 images, 20 MiB per image, and 200 MiB total, and
  clearly rejects video in the first release.
- Added `tests/bulkIngestion.test.ts` and the `npm run test:ingestion` script for
  supported-image/video rejection, size validation, stable hashing, and batch
  confirmation boundaries.

### Database and configuration changes

- No existing schema or configuration was edited. Migration `025` is additive
  and is not applied to production by this implementation.
- AI processing expects existing encrypted presets for `judge4` and `judge5`;
  no credentials or secret values are stored in source or documentation.

### Verification and status

- `npm run build`: passed with the existing Vite chunk-size warning.
- `npm run test:ingestion`: passed 4/4.
- `npm run test:analytics`: passed 5/5.
- `node --test tests/curationConsensus.test.mjs`: passed 9/9.
- `npx tsc -p tsconfig.functions.json --noEmit`: still reports only the
  previously recorded baseline Functions errors; no new error was reported for
  the ingestion files.
- Local `025` SQL execution and all three new-table PRAGMA checks passed.
- Remote PRAGMA verification is blocked by missing Cloudflare credentials; no
  production D1/R2 operation, deployment, or secret-bearing action occurred.
- **Status:** Completed locally for the approved Phase 4 boundary. Production
  rollout remains gated on migration `025`, two configured advisory presets,
  and the existing remote bootstrap decision. Refresh recovery restores all
  server-side progress; an upload that had not started must be re-selected after
  a browser refresh because browsers do not persist File objects in localStorage.

## Admin Overhaul Phase 5 — Meme Vault and data access

### Objective and planned scope

Add server-side search/filtering/pagination and stable ordering, five Vault view
modes, contextual details panel, immutable normal IDs, explicit lifecycle/curation
semantics, and visible partial bulk-action results without weakening the public
final-`keep` gate.

### Implementation record

- Enhanced `GET /api/admin/memes` with parameterized query parsing for `page`,
  `per_page` (clamped between 1 and 100), search `q` (title, id, category, tags),
  `status`, `curation_status`, `nsfw`, and whitelisted sorting (`uploaded_at`,
  `title`, `id`, `likes_count`). Added a single-scan corpus statistics aggregation
  in D1 to calculate exact counts across all statuses without loading the entire
  corpus into memory. Backward compatibility for legacy callers is preserved.
- Added server-side validation in `PATCH /api/admin/memes` rejecting any modification
  where `meme.id !== originalId` with HTTP 400. In `src/admin/AdminApp.tsx`, the
  edit form locks the Meme ID field (`readOnly`/`disabled`) when editing existing memes.
- Implemented the 5 approved view modes in `src/admin/AdminApp.tsx` and
  `src/admin/admin.css`:
  1. Extra-Large Grid (`extra-large-grid`)
  2. Medium Grid (`medium-grid`)
  3. Compact Grid (`compact-grid`)
  4. List (`list`)
  5. Detailed List (`detailed-list`)
  View mode choice is persisted across sessions in `localStorage`.
- Added a Contextual Details Panel (Inspector) for inspecting single memes with
  high-res previews, immutable ID copy actions, lifecycle/curation badges,
  metadata fields, deep-link Re-Curate (`/curate#id=...`), Archive/Restore,
  and Hard Delete. Multi-select mode provides bulk action summary and controls.
- Hard delete in `functions/api/admin/memes/hard-delete.ts` checks both
  `MEMES_BUCKET` and `R2_BUCKET` bindings and returns per-item success and failure
  records.
- Added unit test suite `tests/vault.test.ts` with `npm run test:vault` script in
  `package.json`.

### Verification and status

- `npm run test:vault`: passed 5/5.
- `npm run test:ingestion`: passed 4/4.
- `npm run test:analytics`: passed 5/5.
- `node --test tests/curationConsensus.test.mjs`: passed 9/9.
- `npm run build`: passed (all 1631 modules bundled into `dist/`).
- **Status:** Completed locally. No migrations or production mutations required.

## Admin Overhaul Phase 6 — Human-judge image editor

### Objective and planned scope

Prototype a lazy-loaded Konva + React-Konva still-image editor for Judges 1–3
with crop/rotate, drawing, shapes, text, actual blur/mosaic, undo/redo,
preview/reset, and source-resolution export. Save must use a durable R2/D1
compare-and-swap media replacement saga with unique keys, revision checks, audit
records, and retryable cleanup. Editing must remain separate from votes.

### Verified history and status

- No image-editor dependency, editor route, media-operation migration, revision
  endpoint, or canonical replacement saga exists in the current repository.
- Existing destructive R2/D1 hazards are documented in the Phase 0 audit and have
  not been changed by this walkthrough task.
- **Status:** Pending; not started.

## Admin Overhaul Phase 7 — End-to-end verification and rollout

### Objective and planned scope

Run publication/curation, AI reliability, ingestion/recovery, Admin UI/access,
R2/D1, Android telemetry, notification, and editor regression checks; verify local
and staging behavior; document rollout/rollback; and only deploy with explicit
authorization.

### Verified history and status

- Existing analytics and curation tests document earlier subsystem verification,
  but the Admin Overhaul Phase 7 acceptance suite has not been created or run.
- No Admin Overhaul production migration or deployment has occurred.
- **Status:** Pending until Phases 1–6 are implemented and verified.

## Android Analytics Phase 1 Contract Freeze

- Added migration `016_android_analytics_schema_version.sql` with a non-null
  `schema_version` column defaulting to `1` on `android_analytics_events`.
- Updated `POST /api/analytics/events` to require `schema_version: 1` on every
  Android event before validation and idempotent insertion.
- Synchronized the API specification, Android collection standard, database
  reference, project state, and production rollout plan.
- Applied the migration to the remote `meme-capsule-db` database and verified
  the live column with `PRAGMA table_info(android_analytics_events)`.
- Verification: `npm run build`, `node --test tests/curationConsensus.test.mjs`,
  and the live D1 schema check passed. `git diff --check` reports only
  pre-existing trailing whitespace in the fetched canonical knowledge file.

## Android Analytics Ingestion Hardening

- The ingestion boundary now requires `application/json`, rejects bodies over
  2 MiB, bounds optional metadata and properties, and rejects nested property
  keys associated with PII or secrets.
- Added fixed-window per-IP and per-token throttling through `ANALYTICS_KV`,
  with `429` and `Retry-After` responses.
- Added expiring aggregate counters for accepted, duplicate-containing,
  unauthorized, rejected, and rate-limited requests without storing tokens,
  IP addresses, hashes, or raw payloads.

## Phase 2 Retention and Worker Protection

- The scheduled analytics worker now purges expired Android raw events in
  bounded batches, defaulting to 90 days and honoring
  `ANALYTICS_RAW_RETENTION_DAYS` from 1 through 365 days.
- The worker's manual `POST` trigger now requires `ANALYTICS_WORKER_TOKEN`;
  scheduled invocations remain internal.
- Corrected the existing rank-assignment mutation to satisfy strict worker
  type-checking without changing its behavior.

## Phase 4 Analytics Data Lifecycle

- Added migration `018_android_analytics_deletion_audit.sql` for immutable
  deletion-request auditing.
- Added superadmin-only `POST /api/analytics/deletion` to delete events for a
  verified anonymous SHA-256 user hash using a unique request reference.
- Added superadmin-only `GET /api/analytics/deletion` for audit review.
- Applied and verified the migration against the remote D1 database.

## Phase 6 Analytics Performance Controls

- Added migration `020_android_analytics_daily_summary.sql` for bounded,
  worker-maintained daily Android aggregates.
- Updated the analytics worker to refresh the last 90 days of summary rows
  after retention cleanup and report the refreshed row count.
- Added one-minute KV caching to Android overview, trends, audience, content,
  funnel, retention, and deterministic insight responses.
- Worker aggregation invalidates the Android cache namespace after completion.
- Validation: `npm run build`, `npx tsc --noEmit`, Worker dry-run bundling, and
  targeted `git diff --check` passed.

## Phase 7 Verification and Staged Release

- Added Vitest coverage for valid ingestion, consent lineage, invalid consent,
  invalid token/content type, nested PII rejection, schema rejection, and
  duplicate event accounting.
- Added `npm run test:analytics` as the repeatable contract test command.
- Added `docs/ANALYTICS_STAGING_VERIFICATION.md` with migration, synthetic
  batch, dashboard, Worker, negative-path, and release-decision checks.

This document outlines the AI-Judgement Review Workflow and the three-human majority-consensus curation flow for `/curate`.

## Overview
The `/curate` dashboard integrates pre-evaluations from offline AI models (`user-judge4` and `user-judge5`) into each human judge's independent review. Human judges 1-3 review the AI evaluations, but their own votes are not final by themselves. The three human votes determine the consensus outcome.

---

## 1. The Core AI Review States

### State A: AI Consensus (Judge 4 & Judge 5 Agree)
- **Condition:** Both AI Judge 4 and AI Judge 5 have evaluated the meme and arrived at the same `corpus_status` (e.g., both voted `keep` or both voted `excluded`).
- **UI Presentation:** High-contrast Neo-Brutalist green banner (`AI CONSENSUS: KEEP`) or red banner (`AI CONSENSUS: EXCLUDE`).
- **Curator Action:**
  - Press `Space` or `Enter` to fast-approve the consensus in a single stroke.
  - If status matches but taxonomy details differ: press `4` to adopt Judge 4, press `5` to adopt Judge 5, or press `Space`/`Enter` to adopt Judge 4 by default.
  - To disagree with both: press `O` to enter Manual Override Mode.

### State B: AI Disagreement (Conflicting Evaluations)
- **Condition:** Both AIs evaluated the meme, but their verdicts differ (e.g., Judge 4 says `keep` while Judge 5 says `excluded`).
- **UI Presentation:** High-contrast orange banner (`⚠️ AI JUDGE DISAGREEMENT`) with two side-by-side cards detailing each AI's decision, topics, tone, and humor mechanisms.
- **Curator Action:**
  - Press `4` to adopt AI Judge 4's decision.
  - Press `5` to adopt AI Judge 5's decision.
  - Press `O` to manually curate from scratch.

### State Single AI: 1 AI Evaluation Ready
- **Condition:** Only one AI (either Judge 4 or Judge 5) has processed the meme.
- **UI Presentation:** Yellow/amber banner displaying the available AI verdict with a "1 AI Ready" badge.
- **Curator Action:**
  - Press `Space` or `Enter` to instantly adopt the available AI verdict without roadmap or delay.
  - Press `O` to manually curate.

### State None: Unprocessed Meme
- **Condition:** Neither AI has evaluated the meme yet.
- **UI Presentation:** Dark card prompting the curator to open manual curation (`O`).

---

## 2. Three-Human Majority Consensus (`POST /api/curate/approve`)

Each human judge submits one independent vote for a meme. Judges 1-3 do not see each other's votes in the regular `/curate` response. A meme remains in a judge's unreviewed queue until that judge votes, even if other judges have already voted.

- With fewer than three human votes, only the submitting judge's `meme_curation` row is written. No final decision is written to `meme_curation_final` or `memes`.
- Once all three human judges vote, Layer 0 resolves by majority. Keep and excluded accept 2:1 or 3:0 outcomes; 2:1 excluded is a soft archive.
- Duplicate resolves only when the applicable majority agrees on the same `duplicate_of` target. A 1:1:1 status split or unresolved duplicate target is sent to SuperAdmin arbitration.
- Review_later is stored directly in `memes.curation_status` and remains in the secondary queue.
- Only unanimous 3:0 excluded triggers the existing Force Remove path, deleting the R2 object and related D1 rows. This is non-undoable and emits a `[force-remove]` log entry.
- `meme_curation_final` is written only for keep/excluded. Resolved topics, tone, humour mechanisms, and duplicate target are stored directly on `memes` after additive Migration 014. Existing `tags` and `category` mapping remains `tags = JSON.stringify(topics)` and `category = topics[0]` for kept memes.

The AI review UI and hotkeys remain unchanged: States A/B/C still display AI Judge 4/5 context, and the existing `Enter`/`4`/`5`/`O` flow is used to form each judge's own vote.

## 3. Destructive Action: FORCE REMOVE (`Shift+Delete` / `POST /api/curate/force-remove`)

For non-meme uploads (e.g., random photos, corrupt images, spam):
- **Hotkey:** `Shift+Delete` or `Shift+Backspace`.
- **UI Button:** Prominent red `🗑️ FORCE REMOVE [SHIFT+DEL]` button available in both AI Review and Override views.
- **Physical Deletion:**
  - Deletes the media file directly from the Cloudflare R2 bucket (`env.MEMES_BUCKET`).
  - Purges all records across D1 tables: `memes`, `meme_curation`, `meme_curation_final`, `ai_curation_predictions`, `meme_events`, `meme_analytics`, `meme_daily_stats`.
- **Safety:** This action is intentionally non-undoable.

---

## 4. Keyboard Shortcuts Summary

### AI Review Mode (Default)
| Key | Action |
|---|---|
| `Space` or `Enter` | Fast-approve AI Consensus / Instantly Adopt Single AI |
| `4` | Adopt AI Judge 4 decision |
| `5` | Adopt AI Judge 5 decision |
| `O` | Enter Manual Override Mode |
| `Shift + Delete` | **FORCE REMOVE** (Permanently delete from R2 & D1) |
| `Ctrl + Z` / `Cmd + Z` / `U` | Undo last curation decision |
| `←` / `→` | Previous / Next meme in queue |

### Manual Override Mode (`O`)
| Key | Action |
|---|---|
| `Space` or `Enter` | Confirm & Advance manual curation |
| `K` | Keep |
| `X` | Exclude & Advance |
| `D` | Mark Duplicate |
| `R` | Review Later & Advance |
| `1-9, 0, -, =` | Toggle Topics (Max 3) |
| `Q, W, E, A, S, F` | Select Tone (1 dominant) |
| `Z, C, V, B, N, M, J, P, O` | Select Humor Mechanisms (Max 2) |
| `Esc` | Return to AI Review view |
| `Shift + Delete` | **FORCE REMOVE** (Permanently delete from R2 & D1) |
| `Ctrl + Z` / `Cmd + Z` / `U` | Undo last curation decision |
| `←` / `→` | Previous / Next meme in queue |

---

## 5. Verification & Testing
- **TypeScript & Vite Build:** Verified on October 17, 2026 with `npm run build` (0 errors, 1,634 modules transformed).
- **Consensus resolver tests:** Verified with `node --experimental-strip-types --test tests/curationConsensus.test.mjs` (9 passing tests covering pending votes, keep/excluded outcomes, arbitration, duplicate targets, review_later, AI fallback, and taxonomy ordering).
- **API acceptance:** On October 17, 2026, `npx wrangler pages dev dist` ran the real Pages Functions against isolated local D1/R2 bindings. `tests/consensus-acceptance.ps1` exercised the live HTTP endpoints. It verified each judge receives a pending response until the third vote, unanimous keep/exclude/duplicate/review_later outcomes, 2:1 keep/exclude, duplicate-target agreement and disagreement at both vote distributions, and the 1:1:1 arbitration path. Secondary taxonomy checks covered majority selection, AI Judge 4 fallback on disagreement, AI agreement, maximum item counts, and canonical ordering. Queue checks confirmed judges do not see one another's votes and a judge's own queue excludes already-reviewed items. SuperAdmin unresolved-list, summary, and resolve endpoints passed against seeded conflicts. NSFW tagging and public random-meme filtering, report submission, and `/admin`, `/reports`, and `/curate` routes also passed.
- **Persisted side effects:** Direct queries against the isolated local D1 database confirmed unanimous excluded removed both the meme and its vote rows (zero rows each), 2:1 excluded persisted `corpus_status='excluded'` and `memes.curation_status='excluded'` with `is_active=0`, unanimous duplicate persisted its agreed target with inactive status, and review_later persisted directly on `memes` without a final-decision row. No duplicate or review_later entries were written to `meme_curation_final`. The HTTP report submission produced one report row. For the destructive 3:0 excluded path, an object was seeded into the isolated local R2 bucket, then its absence was confirmed through a temporary local-only HEAD probe after the real approval endpoint returned `hard_removed`. This validates the R2 side effect without involving remote resources.
- **Verification:** `node --experimental-strip-types --test tests/curationConsensus.test.mjs` passed all 9 resolver tests; `npm run build` passed. The temporary Pages config, fixture seed/script, R2 probe, and object fixture are local verification aids and are removed after the run. No production D1/R2 binding was used or mutated. The admin upload endpoint was not used because its local request was rejected as unauthorized; this does not affect the independently seeded R2 deletion-path verification.
- **Migration rationale:** Migration 014 adds persisted resolved Layer 1-3 and duplicate-target fields to `memes`; those fields were absent from the existing schema, so the consensus result otherwise could not be persisted as required.

---

## 6. NSFW Flag Integration (Safe by Default & Public Delivery)

### 6.1 Database Migration & Schema
- Added `d1/migrations/013_add_nsfw_flag.sql` adding `is_nsfw INTEGER DEFAULT 0` and `nsfw_flagged_by TEXT`, plus index `idx_memes_is_nsfw`.
- Synchronized baseline schema in `d1/schema.sql` and updated `src/types.ts`.

### 6.2 Public Delivery Contract
- Core queries in `functions/_shared/d1r2.ts` default to filtering:
  `AND (m.is_nsfw IS NULL OR m.is_nsfw = 0)`.
- Passing `?nsfw=1` or `?nsfw=true` to `GET /api/random-meme`, `GET /api/daily-meme`, or `GET /api/memes/random` relaxes this filter to include NSFW memes.
- Privacy preservation: Client-side mobile app DOB/age calculation remains on-device; backend receives only the boolean toggle flag.

### 6.3 AI & Curator Classification
- Multimodal AI vision pre-judge (`functions/api/ai-judge/classify.ts`) and Python/NIM sync (`functions/api/admin/ai-categorise.ts`) detect NSFW/adult content and set `is_nsfw = 1, nsfw_flagged_by = 'ai-judge'`.
- Curator toggle on `/curate` (via `POST /api/curate/save` with `moderation_only: true` and `src/curate/CurateApp.tsx`) allows instant non-destructive NSFW tagging, fully compliant with Cloudflare Pages publication.
- Admin dashboard (`/admin`) features an NSFW filter tab and cyber-pink badge.
- Reports moderation (`/reports`) allows non-destructive "Mark NSFW" resolution.

---

## 7. Multi-Branch Alignment & Remote Synchronization

- Merged `origin/main` (incorporating PR #26, PR #27, and PR #28 by Pratham Pandey) into `feature/majority-consensus-curation`.
- Unified D1 migration `013_add_nsfw_flag.sql` and schema `d1/schema.sql` to support both `is_nsfw CHECK (is_nsfw IN (0, 1))` and metadata `nsfw_flagged_by`.
- Unified `src/curate/curateApi.ts` and `src/curate/CurateApp.tsx` to handle NSFW toggling through `POST /api/curate/save` (`moderation_only`) to ensure Cloudflare Pages function publication safety while preserving UI responsiveness and state updates.
- Added permanent operating guidelines to `docs/AGENT_RULES.md` and `docs/AGENTS.md` enforcing remote branch synchronization (`git fetch origin`, inspect `origin/main`) before any feature planning to eliminate duplicate feature implementations and branch drift.

---

## 8. Admin Overhaul Phase 6 & Phase 7 — Human-Judge Image Editor & Verification Walkthrough

### 8.1 Human-Judge Image Editor (`/curate`)
- **Interactive Canvas with React-Konva**:
  - Implemented client-side Neo-Brutalist Image Editor for human judges (Judges 1–3) and SuperAdmin in `src/curate/editor/`:
    - `imageEditorTypes.ts`: Full state definitions, tool types (`select`, `crop`, `blur`, `mosaic`, `brush`, `rectangle`, `circle`, `text`), and undo/redo structures.
    - `pixelEffects.ts`: In-place physical pixel manipulation algorithms for true cell-averaged mosaic pixelation and 1D separable box blur. Includes coordinate mapping for source resolution scaling, cropping, and 90°/180°/270° rotation.
    - `exportCanvas.ts`: Offscreen canvas rendering engine executing full native-resolution composite exports without display-scaling blur or downsampling distortion.
    - `KonvaCanvas.tsx`: Interactive multi-layer Konva viewport with transformation controls, drag-and-drop annotation editing, crop overlays, and blur/mosaic region handlers.
    - `ImageEditorModal.tsx`: Neo-Brutalist editor modal featuring tool selectors, color swatches, brush stroke sliders, undo/redo buttons, and compare-and-swap CAS save action.
- **UI Integration in CurateApp**:
  - `src/curate/CurateApp.tsx` updated with `[🎨 EDIT IMAGE]` CTA buttons on both desktop actions toolbar and mobile quick actions bar.
  - Global hotkey `E` / `e` opens the Image Editor modal for the currently inspected meme.
  - Dynamic code splitting via `React.lazy` bundles Konva (360 kB) into an isolated chunk (`ImageEditorModal-*.js`), keeping initial load lean.

### 8.2 Backend CAS Media Replacement (`functions/api/curate/media/edit.ts`)
- **Strict Judge Authorization**:
  - Requires authenticated session (`sessionUser.role === "judge" || "superadmin"`).
  - Explicitly rejects advisory AI judges (`judge4`, `judge5`) with HTTP 403 Forbidden.
- **Compare-and-Swap (CAS) Guarantee**:
  - Receives `expected_storage_path` in multipart form data.
  - Checks if `memes.storage_path === expected_storage_path`.
  - Atomically updates `memes` pointer:
    `UPDATE memes SET storage_path = ?, image_url = ?, updated_at = ... WHERE id = ? AND storage_path = ?`.
  - If concurrent modification occurred (`meta.changes === 0`), rolls back newly uploaded R2 object and returns HTTP 409 Conflict.
- **Audit History**:
  - Records every modification in `media_operations` (`meme_id`, `actor_id`, `actor_name`, `old_storage_path`, `new_storage_path`, `operation_type`, `created_at`).

### 8.3 Verification & Automated Test Suites
- **Full Test Suite Results (27/27 Passed)**:
  - `npm run test:editor`: 4 passed (mosaic pixel downsampling, box blur convolution, source crop/rotation coordinate transforms, out-of-bounds safety).
  - `npm run test:vault`: 5 passed (server-side pagination, view modes, search predicates).
  - `npm run test:ingestion`: 4 passed (bulk batch intake, bounded concurrency, duplicate warnings).
  - `npm run test:analytics`: 5 passed (ingestion metrics, analytics event aggregation).
  - `node --test tests/curationConsensus.test.mjs`: 9 passed (3-human consensus rules, advisory AI Judge 4/5 fallbacks, arbitration splits, and duplicate reconciliation).
- **TypeScript & Vite Build**:
  - `npm run build` compiled 1,713 modules with zero errors.
  - Clean chunk splitting: `dist/assets/ImageEditorModal-COG5_ldu.js` (360 kB) loaded on demand.
