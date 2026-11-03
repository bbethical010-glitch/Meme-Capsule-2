# Meme Capsule Admin Overhaul — Phase 0 Audit

## Audit status

| Field | Result |
|---|---|
| Audit phase | Phase 0 — audit and scope lock |
| Audit date | 2026-11-02 |
| Repository | `editorav010-dev/Meme-Capsule` |
| Branch | `main` |
| HEAD | `2cafbe8d7070c7c00ab295bd48a9716e032511e7` |
| `origin/main` | Same commit as HEAD |
| Production URL | `https://meme-capsule-eww.pages.dev` |
| Phase 0 functional changes | None |
| Phase 3 implementation status | Authorized and implemented locally at the recorded baseline |
| Phase 4 implementation status | Phase 1/2 prerequisites and Phase 4 implemented locally on 2026-11-03 |
| Documentation changes | Audit and affected project documentation updated |
| Production deployment or migration | None |

This document records the Phase 0 architecture and workflow audit at the baseline
above, including gaps between older documentation, migrations, and current code.
The Phase 3 implementation record at the end documents the separately authorized
Admin Console UI change. No Phase 1 or Phase 2 schema, ingestion, or queue changes
are included.

## Executive findings

1. **The repository is synchronized with `origin/main`.** `git fetch origin`
   completed successfully, `git log HEAD..origin/main --oneline` is empty, and
   both revisions resolve to `2cafbe8d...`.
2. **There is pre-existing uncommitted operator work.** The working tree already
   contains changes in `.gitignore`, `.knowledge/.knowledge_meta.json`,
   `docs/MEME_CAPSULE_KNOWLEDGE.md`, and `docs/STATE.md`. Those files were not
   reset or overwritten.
3. **The next migration prefix is correctly unused.** The repository contains
   migrations through `024_notification_content_files.sql`; no `025_` file exists.
   The intentional duplicate prefixes `004`, `011`, and `021` are present with
   their exact filenames.
4. **A clean local migration run currently cannot reach migration 009.** The
   disposable/local Wrangler D1 run applies `000` through `007`, then fails at
   `008_optimize_curation_indexes.sql` with `no such table:
   main.ai_curation_predictions`. The table is dynamically created by
   `functions/_shared/curateDb.ts`, but it is not created by a historical SQL
   migration before the index is declared. This must be resolved deliberately in
   a future additive migration or compatibility procedure; historical files must
   not be rewritten.
5. **The public D1 query has the authoritative final-keep join, but the direct
   force-removal anti-join is absent.** `functions/_shared/d1r2.ts:134-179`
   requires `m.is_active = 1`, `m.status = 'active'`, and
   `meme_curation_final.corpus_status = 'keep'`, with the existing NSFW filter.
   It relies on force-removal paths deleting or deactivating rows rather than
   explicitly excluding `meme_force_removals` records. This is a future hardening
   item, not a Phase 0 change.
6. **The current AI implementation does not satisfy the approved advisory-only
   rule.** The visible manual AI panels require a human click to adopt a result,
   but `src/curate/ai-judge/useAiJudgeLoop.ts:234-263` automatically invokes
   `CurateApp`'s `handleApproveAndAdvance`, which calls
   `POST /api/curate/approve` with the AI-generated decision. That writes the
   decision as the current human judge's `meme_curation` row. In addition,
   `functions/api/curate/next.ts:355-369` reads Judge 4 and Judge 5 rows from
   `meme_curation`, which is a human-ballot table. This is the highest-priority
   governance finding for the approved implementation.
7. **There are three different AI result models.** The `/curate` advisory join
   uses `ai_curation_predictions`; the separate operator console uses
   `ai_judge_processed`; and the older numeric `/categorise` / Admin AI feature
   uses `memes.ai_*` and `cat_consensus` contracts. They must not be merged by
   assumption.
8. **Admin Vault access is currently client-side and unbounded.**
   `GET /api/admin/memes` returns every row and the React Admin Console performs
   search, filters, counts, and page slicing in memory. The endpoint has no query,
   filter, or pagination contract. This is the primary Phase 5 data-access gap.
9. **R2 and D1 operations are not currently a recoverable saga.** Uploads write
   R2 before any metadata row; hard delete uses `env.R2_BUCKET` even though the
   configured binding/type is `MEMES_BUCKET`; the shared force-remove helper marks
   R2 deletion successful even when no delete was confirmed; and R2 sync can delete
   D1 rows when an object is absent without a durable reconciliation record.
10. **The Admin Analytics tab is not the same system as Android analytics.** The
    Admin tab uses the legacy `meme_events`/`meme_analytics` pipeline. Android
    telemetry uses `android_analytics_events`, live rollups, retention/deletion
    APIs, and separate curator-protected readers. Removing the Admin Analytics UI
    can be isolated if those APIs, tables, and workers remain intact.
11. **Several project references are stale or missing.** The root `README.md` and
    `docs/AI_AGENT_SINGLE_SOURCE_OF_TRUTH.md` referenced by repository guidance are
    absent from the workspace. `docs/STATE.md` contains committed merge-conflict
    markers at lines 194 and 226. Older AI-prejudge documentation describes a
    producer and `ai_cat_decisions` flow that current code does not implement.

## 1. Repository instructions, branch state, and scope

### Instructions read

The following available instructions and project context were read before this
audit:

- `AGENT_RULES.md`
- `docs/AGENT_RULES.md`
- `AGENTS.md`
- `docs/AGENTS.md`
- `docs/GEMINI.md`
- `docs/CLAUDE.md`
- `docs/STATE.md`
- `docs/MEME_CAPSULE_KNOWLEDGE.md`
- `docs/DATABASE.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/README.md`
- `docs/README_ANALYTICS.md`
- `docs/ANALYTICS_STAGING_VERIFICATION.md`
- `docs/FORCE_REMOVE_FEATURE.md`
- `docs/AI_PREJUDGE_CURATE_ANALYSIS.md`
- `docs/walkthrough.md`
- `package.json`, `wrangler.toml`, TypeScript configuration, and test files

The guidance references `README.md` at the repository root and
`docs/AI_AGENT_SINGLE_SOURCE_OF_TRUTH.md`, but neither file exists in the current
workspace. `docs/README.md` and the other available operating documents were used
instead. This should be repaired or explicitly retired by the operator separately
from the Admin overhaul.

### Git state

The initial `git status --short` was:

```text
 M .gitignore
 M .knowledge/.knowledge_meta.json
 M docs/MEME_CAPSULE_KNOWLEDGE.md
 M docs/STATE.md
```

The changes include an Android v3.8/versionCode 29 update and knowledge-sync
content. They are treated as pre-existing work. No reset, checkout, clean, rebase,
push, or migration deployment was performed.

The remote branch has no commits ahead of the local branch. Recent history is
notification-focused through merge commit `2cafbe8`; no Admin-overhaul,
ingestion-job, or image-editor implementation was found in the current remote
history.

## 2. Migration and schema audit

### Migration inventory

Wrangler's local migration listing confirms lexicographical execution order and
the following repository inventory:

| Prefix/files | Repository meaning |
|---|---|
| `000_complete_setup.sql` | Initial users, sessions, curation tables, final table, indexes, and seed accounts |
| `002_analytics.sql` | Legacy web event, analytics, daily stats, and global stats tables |
| `003_categorisation.sql` | Older numeric seven-category `cat_*` workflow |
| `004_ai_judge.sql` | Separate AI operator accounts, config, runs, and `ai_judge_processed` |
| `004_curation.sql` | Intentional duplicate prefix; rebuilds the multi-dimensional raw curation table |
| `005_curation_final.sql` | Authoritative curation resolution table |
| `006_judge_ai_presets.sql` | Encrypted-per-judge provider preset storage contract |
| `007_add_judge4_judge5.sql` | Adds the two advisory judge identities to `cat_users` |
| `008_optimize_curation_indexes.sql` | Adds curation/random indexes and an index on `ai_curation_predictions` |
| `009_add_api_password_to_users.sql` | Adds `cat_users.api_password_hash` |
| `010_enforce_superadmin_active_and_cleanup_judges.sql` | Historical cleanup and active-state reconciliation |
| `011_force_removals.sql` | Intentional duplicate prefix; force-removal audit table |
| `011_reconcile_active_and_curation_sync.sql` | Intentional duplicate prefix; status synchronization |
| `012_add_curation_status_to_memes.sql` | Adds `memes.curation_status` |
| `013_add_nsfw_flag.sql` | Adds NSFW flag/source and index |
| `014_add_resolved_curation_fields.sql` | Adds duplicate/topic/tone/mechanism fields to `memes` |
| `015`–`020` | Android event contract, schema/consent versions, query indexes, deletion audit, and daily summaries |
| `021_android_live_analytics.sql` | Android live rollups, presence, and pipeline health |
| `021_create_device_tokens.sql` | Intentional duplicate prefix; initial device-token table |
| `022_rename_device_tokens_to_notification_tokens.sql` | Canonical notification-token table name |
| `023_scheduled_notifications.sql` | Reusable messages, schedules, and delivery runs |
| `024_notification_content_files.sql` | R2-backed notification content library metadata |

No migration after `024` exists. The next approved migration must use a unique
`025_...sql` prefix. None of the historical files may be renamed, reordered, or
edited.

### Local migration verification

The following commands were run against Wrangler's local D1 state only:

```text
npx --yes wrangler@latest d1 migrations list meme-capsule-db --local
npx --yes wrangler@latest d1 migrations apply meme-capsule-db --local
```

The apply command executed `000` through `007`, then failed at
`008_optimize_curation_indexes.sql`:

```text
no such table: main.ai_curation_predictions: SQLITE_ERROR
```

`functions/_shared/curateDb.ts:133-153` and `171-205` dynamically create
`ai_curation_predictions` when a curation request runs. That runtime self-healing
behavior does not make the historical migration chain valid on a clean database,
and the table is absent from the historical migration files before the index in
migration 008. The clean-database procedure needs an operator decision before
Phase 1 implementation.

Remote migration history was **not** queried. The read-only command was attempted:

```text
npx --yes wrangler@latest d1 migrations list meme-capsule-db --remote
```

Wrangler 4.156.2 stopped because `CLOUDFLARE_API_TOKEN` is not configured in this
non-interactive environment. No temporary account claim flow was used and no
production command was run. Remote migration history remains an explicit rollout
blocker before any production migration.

### Schema source discrepancies

`d1/schema.sql` is only a 30-line `memes` table definition plus three indexes. It
does not contain the curation, AI, force-removal, analytics, Android, or
notification tables and does not include all later `memes` columns such as
`curation_status`, `duplicate_of`, `topics`, `tone`, and
`humour_mechanisms`. It cannot be treated as a complete clean-production schema.

The repository has three overlapping schema mechanisms:

1. historical D1 migrations;
2. the incomplete `d1/schema.sql`/seed fixtures; and
3. request-time self-healing DDL in `functions/_shared/curateDb.ts`.

Phase 1 must choose and document the supported clean-database bootstrap path and
must not silently rely on request-time DDL for new durable ingestion tables.

### Verified table families

| Table family | Current source/evidence | Role in the overhaul |
|---|---|---|
| `memes` | `d1/schema.sql`, migrations `012`–`014`, admin/curation APIs | Existing metadata and lifecycle row; keep IDs stable and new intake private |
| `meme_curation` | `000`, `004`, `curateDb.ts` | Raw per-user rows; human Judges 1–3 are authoritative votes; current code also uses Judge 4/5 rows |
| `meme_curation_final` | `000`, `005` | Authoritative resolution record; public keep gate |
| `meme_force_removals` | `011`, `curateDb.ts` | Permanent purge audit and R2 result fields |
| `ai_curation_predictions` | runtime DDL only plus migration 008 index | `/curate` advisory prediction join; no current durable migration/producer found |
| `ai_judge_processed` and `ai_judge_runs` | `004_ai_judge.sql` | Separate legacy AI operator console result/run records |
| `cat_decisions` and `cat_consensus` | `003_categorisation.sql` | Older numeric `/categorise` workflow; separate from `/curate` taxonomy |
| `meme_events`, `meme_analytics`, `meme_daily_stats`, `app_global_stats` | `002_analytics.sql` | Legacy analytics Admin tab and aggregation worker |
| `android_analytics_*`, `android_live_*`, `android_pipeline_health` | migrations `015`–`021` | Android telemetry, live dashboard, retention, and privacy deletion |
| `notification_tokens`, `notification_messages`, `notification_schedules`, `notification_delivery_runs`, `notification_content_files` | migrations `021`–`024` | FCM registration, manual/scheduled delivery, and R2 content libraries |

The operator-supplied production snapshot is treated as point-in-time context,
not as a value to hard-code: 4,564 raw `memes` rows, 2,746 force-removal rows,
1,818 active review-corpus rows, 724 final keeps, 1,030 final excludes, and 64
unresolved items. This audit did not query production data.

## 3. Admin Analytics dependency map

### Current Admin Analytics UI

`src/admin/AdminApp.tsx:34,169,649-751` imports
`src/admin/analytics-dashboard/AnalyticsDashboard.tsx`, exposes an `analytics`
tab, and mounts the dashboard. The dashboard components call:

- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/trends`
- `GET /api/admin/analytics/rankings`
- `GET /api/admin/analytics/insights`
- `GET /api/admin/analytics/meme/:memeId`
- `POST /api/admin/analytics/recalculate`
- `POST /api/admin/analytics/reset`

These routes read or mutate the legacy `meme_events`, `meme_analytics`,
`meme_daily_stats`, and `app_global_stats` data. They are protected by
`requireAdmin` in the route implementations. `workers/analyticsAggregator.ts`
also reads and writes this legacy pipeline, while additionally processing Android
summary/live/retention data.

### Android telemetry that must remain

The Admin Analytics tab is not the owner of Android telemetry. The following
separate path must survive any UI cleanup:

```text
Android client src/analytics/ and native v3.8 client
  -> POST /api/analytics/events
  -> android_analytics_events
  -> android_live_minute / android_live_presence / pipeline health
  -> workers/analyticsAggregator.ts every 30 minutes
  -> Android dashboard readers under /api/analytics/*
  -> /curate/analytics preview UI
```

Verified retained contracts include:

- `POST /api/analytics/events` validates token, JSON, consent, event schema,
  rate limits, batch size, request size, and duplicate event IDs
  (`functions/api/analytics/events.ts:162-345`).
- `POST /api/analytics/deletion` and `GET /api/analytics/deletion` perform
  superadmin-authorized data deletion and audit review
  (`functions/api/analytics/deletion.ts:47-134`).
- `GET /api/analytics/overview` and `GET /api/analytics/trends` are
  superadmin-protected aggregate readers.
- `GET /api/analytics/live/summary`, `/feed`, and `/insights` are consumed by
  `src/curate/analytics-preview/AnalyticsPreviewPage.tsx:223-269`.
- `workers/analyticsAggregator.ts` handles Android raw-event retention, daily
  summaries, live hourly rollups, pipeline health, and the legacy aggregation
  path. Its cron configuration is `workers/wrangler.analytics.toml`.

**Retirement boundary:** remove the Admin Console's legacy Analytics tab and its
UI-only imports only after confirming whether the legacy admin endpoints and
worker calculations are still operationally needed. Do not delete Android APIs,
privacy/deletion handlers, analytics migrations, live readers, or the worker as
collateral cleanup.

## 4. Legacy AI Categorisation and separate AI Judge map

### Older numeric `/categorise` system

The `/categorise` route is wired by `src/main.tsx:55-56` to `src/categorise/CatApp.tsx`.
It uses:

- `POST /api/cat/login`, `/logout`, `/decide`, `/force-remove`;
- `GET /api/cat/next`, `/me`, `/meme/:memeId`;
- `GET /api/cat/analytics/overview`, `/memes`;
- `POST /api/cat/analytics/confirm`; and
- superadmin user/reset/force-removal routes under `/api/cat/admin/*`.

This path uses `cat_decisions` and `cat_consensus`, numeric category IDs 1–7,
and active/NSFW filtering. It is distinct from the `/curate` multi-dimensional
human consensus flow.

### Admin legacy AI tab and routes

`src/admin/AdminApp.tsx:34,657-660,758-764` mounts `src/admin/ai/AiTab.tsx`.
The tab calls `GET /api/admin/ai-stats`, `GET /api/admin/ai-comparison`, and
`POST /api/admin/ai/override`. `POST /api/admin/ai-categorise` is an external
write endpoint but has no current frontend caller found in this repository.

The routes read/write `memes.ai_category`, `ai_confidence`, `ai_reasoning`,
`ai_categorised_at`, and `ai_model`. Those columns are not defined in the
repository's `d1/schema.sql` or any migration inspected here. The comparison and
override routes also use `cat_consensus`, which is part of the older numeric
workflow. This makes the Admin AI tab a legacy/uncertain surface, not a safe
alias for the AI Judges 4/5 advisory workflow.

| Area | Classification | Evidence | Phase 3 handling |
|---|---|---|---|
| `src/admin/ai/*` and Admin `AI Categorisation` tab | Exclusive to retired Admin view | `AdminApp.tsx:34,657-660,758-764`; `AiTab.tsx` calls legacy numeric APIs | Removed in Phase 3; backend contracts retained |
| `functions/api/admin/ai-stats.ts`, `ai-comparison.ts`, `admin/ai/override.ts` | Exclusive/legacy, but schema contract is uncertain | Numeric `memes.ai_*` and `cat_consensus` references | Do not remove until route usage and production tables are confirmed |
| `functions/api/admin/ai-categorise.ts` | External legacy producer; uncertain | Admin-token endpoint writes numeric `memes.ai_*` fields | Preserve or retire only after producer/job inventory and operator approval |
| `/categorise` UI and `/api/cat/*` | Separate legacy workbench | `src/main.tsx`, `src/categorise/*`, `functions/api/cat/*` | Not part of Admin Analytics removal; decision required before deleting |
| `/curate` `ai_curation_predictions` join | Separate advisory display path | `functions/api/curate/next.ts:138-148,355-361` | Preserve and formalize its producer/store in later phases |
| `/ai-judge` operator console | Separate AI run path | `functions/api/ai-judge/*`, `src/ai-judge/*` | Preserve unless explicitly retired; it does not implement the new two-judge intake gate |
| `/curate/ai-proxy` and browser continuous AI loop | Shared and currently governance-sensitive | `src/curate/ai-judge/useAiJudgeLoop.ts:234-263`; `CurateApp.tsx:116-125` | Must be redesigned so AI cannot submit a human ballot automatically |

### AI result stores and current writers/readers

| Store | Current writer | Current reader | Authority status |
|---|---|---|---|
| `ai_curation_predictions` | No durable producer found; runtime DDL creates the table | `/api/curate/next` read-only `LEFT JOIN` | Intended advisory display, but migration and producer are incomplete |
| `meme_curation` rows for `user-judge4`/`user-judge5` | Existing data/API flows can insert rows; `approve.ts` queries them | `/api/curate/next` and `approve.ts` | Wrong store for AI advisory results under the approved plan |
| `ai_judge_processed` | `/api/ai-judge/classify` | `/api/ai-judge/run/progress` | Separate operator result history; not a human ballot |
| `memes.ai_*` | legacy `/api/admin/ai-categorise` and override | legacy Admin AI UI | Numeric legacy workflow; schema is not present in migration definitions |
| browser React state | `analyzeMemeWithAi` in `aiJudgeClient.ts` | `useAiJudgeLoop`/`CurateApp` | Current automatic path can be persisted through human approval; must be stopped or converted to explicit human action |

## 5. Intake → AI → human curation → finalization → public flow

### Current legacy intake flow

The current production-compatible path is split across requests rather than a
durable job:

```text
Admin selects one file
  -> POST /api/admin/upload
  -> R2 put(unique UUID + sanitized filename)
  -> returns storage_path/public URL

Admin separately submits metadata
  -> POST /api/admin/memes
  -> INSERT memes row
  -> status defaults to draft unless supplied; is_active follows status

Human queue
  -> GET /api/curate/next
  -> selects rows by curation fields and force-removal anti-join
  -> currently has no ingestion-job gate

Judge action
  -> POST /api/curate/approve (main UI) or POST /api/curate/save (legacy route)
  -> meme_curation raw row
  -> after all three human identities vote, resolveHumanConsensus()

Finalization
  -> meme_curation_final for keep/excluded
  -> memes.curation_status/status/is_active update
  -> Superadmin resolution/bulk-resolution for applicable cases

Public delivery
  -> /api/random-meme, /api/daily-meme, /api/memes/random
  -> final keep + active/status + NSFW checks
```

The current upload endpoint does not create a batch, item job, AI evaluation
records, or a D1 metadata row. A browser refresh cannot recover the relationship
between a successful R2 upload and a failed metadata request.

### Intended new intake boundary

The approved plan requires this separate state machine for newly ingested items:

```text
batch created (actor + idempotency)
  -> item/job queued (stable meme_id, R2/D1 references)
  -> AI judge 4 evaluation pending/processing/retry/failure/success
  -> AI judge 5 evaluation pending/processing/retry/failure/success
  -> validate and persist both results
  -> job human_ready, while memes remains archived and is_active = 0
  -> existing human Judges 1–3 queue
  -> existing human consensus/finalization
  -> only final keep can publish
```

AI success, a metadata edit, or a UI action must not independently write a final
keep or make the meme public.

### Current human-item retrieval routes

These routes can return a meme to an internal review/curation surface and must be
considered when Phase 2 adds backend human-ready gating:

| Route | Current selection | Auth | AI/job gate today |
|---|---|---|---|
| `GET /api/curate/next` | Main multi-dimensional queue; unreviewed/review-later/keep/etc. filters | `validateSession`, but defaults to `user-judge1` when absent | No ingestion-job check; joins `ai_curation_predictions` and reads J4/J5 `meme_curation` rows |
| `GET /api/curate/list` | Paginated browse list with `meme_curation` status | No explicit auth in handler | No ingestion-job check |
| `GET /api/curate/super/memes` | Superadmin paginated search/comparison matrix | Superadmin session | No ingestion-job check; current `ai_judge` response is hard-coded `null` |
| `GET /api/cat/next` | Older numeric categorisation queue, only `is_active = 1` and non-NSFW | Authenticated cat user | Legacy queue; final/job semantics are not applied |
| `GET /api/cat/meme/:memeId` | Older numeric detail view | Authenticated cat user | Legacy route |
| `GET /api/ai-judge/next-meme` | Separate AI operator run, only `is_active = 1` and not processed in run | AI Judge session | Not a new intake gate; it currently excludes all archived new intake |

Phase 2 must update every applicable new-intake route, not only the frontend. The
legacy behavior for rows with no ingestion-job record must remain unchanged unless
the operator approves a separate migration.

## 6. Curation, consensus, and publication invariants

### Human consensus implementation

`functions/_shared/curationConsensus.ts:91-139` uses unique human vote IDs,
requires three unique human votes, resolves 2:1/3:0 status majorities, routes
true three-way splits to arbitration, and requires compatible duplicate targets.
The tests cover these cases and passed 9/9.

`functions/api/curate/approve.ts:81-195` identifies human Judges 1–3 by
username, filters them into the consensus input, and reads Judge 4/5 rows only
for secondary-field fallback. It writes the submitting row and computes a
consensus result in a D1 batch. `functions/api/curate/super/resolve.ts` and
`bulk-resolve.ts` perform Superadmin resolution.

The implementation still has important boundary details:

- `POST /api/curate/save` can be called without a validated session and defaults
  to `user-judge1` if no identity is supplied (`save.ts:27-74`). It also changes
  `memes.is_active` from one raw vote (`save.ts:121-125`). The public final-keep
  join prevents that row from being publicly delivered, but the intermediate
  state is not authoritative.
- `POST /api/curate/approve` also permits a missing session to supply a human
  identity in the request body (`approve.ts:96-105`). The later phase should
  decide whether this compatibility behavior is removed or strictly constrained.
- `GET /api/curate/next` permits an absent session and uses a default judge ID
  (`next.ts:160-162`). This is not sufficient for a new ingestion gate that must
  be tied to an authenticated judge.
- The current continuous AI loop uses the human approval endpoint automatically,
  so its output can become a human ballot even though the displayed advisory panel
  says AI is not a human vote.

### Public delivery gate

All three public D1 entry points use `getRandomMeme`/`getDailyMeme` in
`functions/_shared/d1r2.ts`:

```sql
SELECT m.*
FROM memes m
INNER JOIN meme_curation_final f ON m.id = f.meme_id
WHERE m.is_active = 1
  AND m.status = 'active'
  AND f.corpus_status = 'keep'
  AND (m.category IS NULL OR LOWER(m.category) != 'archived')
  -- default: m.is_nsfw IS NULL OR m.is_nsfw = 0
```

The random route seeks by `random_key` and wraps to the lowest key; the daily
route selects deterministically from the latest 50 eligible rows. No personalized
ordering or engagement-ranked feed is present. On a D1 error or empty eligible
pool, the helpers return static fallback memes from `src/data/fallbackMemes.ts`.
The fallback behavior is a separate product reliability path and should not be
mistaken for publication of an uncurated D1 row.

`?nsfw=1`/`true` intentionally relaxes the NSFW clause, while the final-keep,
active/status, and media URL requirements remain. A direct
`meme_force_removals` exclusion is not present in this SQL; later hardening should
make force-removal audit state an explicit eligibility condition as well as relying
on deactivation/deletion side effects.

## 7. API and authorization map

### Authentication primitives

| Primitive | Implementation | Current behavior |
|---|---|---|
| Admin token | `functions/_shared/d1r2.ts:81-95` | Bearer or `X-Admin-Token` must equal `ADMIN_API_TOKEN`; returns 503 if unset |
| Admin UI gate | `src/admin/AdminGate.tsx:13-36` | Client-side `VITE_ADMIN_PIN`; falls back to literal `123456` if unset; separate from backend token |
| Curator session | `functions/_shared/catAuth.ts:37-79` | SHA-256 password comparison, bearer session, 8-hour expiry, active user check |
| AI operator session | `functions/_shared/aiJudgeAuth.ts:21-44` | Separate `ai_judge_sessions`, 12-hour login expiry |
| Superadmin | `requireAuth(..., 'superadmin')` | Role check on `cat_users` |
| Public | Public Functions | No admin/curator auth; only query-level publication filters |

The repository instructions describe salted SHA-256, but the current password
helper hashes the password directly with SHA-256 and no salt. `ensureCurationTables`
also inserts default accounts with the known `changeme123` hash if absent. This is
an existing security/operations fact to preserve in the audit, not a Phase 0 fix.

### Relevant endpoint contracts

| Endpoint family | Current contract | Authorization |
|---|---|---|
| `GET /api/random-meme`, `/api/daily-meme`, `/api/memes/random` | `{ meme }`, daily additionally `{ date }`; fallback on D1 failure/empty | Public |
| `GET /api/admin/memes` | `{ memes, config }`; all rows, final status joined | Admin token |
| `POST /api/admin/memes` | `{ meme }`; creates one row; active requires final keep | Admin token |
| `PATCH /api/admin/memes` | `{ meme }`; requires `originalId`; currently permits ordinary ID changes | Admin token |
| `DELETE /api/admin/memes` | `{ meme }`; archives and moves final keep to `review_later` | Admin token |
| `POST /api/admin/upload` | `{ url, storage_path, source_link, media_type }`; R2 only | Admin token |
| `POST /api/admin/memes/hard-delete` | `{ success, deletedCount, message }`; D1 deletes after attempted R2 delete | Admin token |
| `POST /api/admin/sync-r2` | Counts plus added/removed key arrays; two-way auto-reconciliation | Admin token |
| `GET/POST /api/curate/next` family | Main curation payload with `meme`, `memes`, optional `stats`, AI context | Curator session is currently optional on `next`; other routes vary |
| `POST /api/curate/approve` | Human vote result: pending/arbitration/finalized/hard_removed | Intended Judges 1–3; body fallback currently exists |
| `POST /api/curate/save` | Raw curation or NSFW mutation | Session optional/current fallback behavior |
| `POST /api/curate/force-remove` | Shared hard purge, always reports success if helper returns | Any validated curator session |
| `POST /api/cat/force-remove` | Deactivate + audit + R2 retry result; distinct implementation | Any authenticated cat user |
| `GET/POST /api/ai-judge/*` | Operator config, run, progress, and `ai_judge_processed` classification | AI Judge session |
| `POST /api/curate/ai-proxy` | Relays external completion response | Current origin/bearer checks are permissive; uses preset decryption when available |
| `POST /api/analytics/events` | Validated batch `{ success, accepted, rejected }` | Analytics app token + KV rate limit |
| `POST /api/notifications/register` | `{ success, message }` | Public token registration |
| `POST /api/admin/notifications/send` and schedules/content files | FCM dispatch/schedule/library contracts | Admin token |
| `/reports` HTML/JSON/PATCH | Moderation dashboard, report search, archive/blacklist/NSFW actions | Admin token for data/mutations |

### R2/D1 binding names

`wrangler.toml` defines `DB`, `MEMES_BUCKET`, and `ANALYTICS_KV`. The Pages
environment type in `functions/_shared/d1r2.ts` also defines `MEMES_BUCKET`.
`functions/api/admin/memes/hard-delete.ts` instead references `env.R2_BUCKET`,
which is not configured or typed. This is a verified contract mismatch.

## 8. Current query/search/pagination behavior

| Surface | Search/filter/pagination now | Contract/data-access concern |
|---|---|---|
| Admin Vault | `GET /api/admin/memes` returns all rows; `AdminApp.tsx:205-220` filters title/ID/category/tags in React and slices to `PAGE_SIZE = 25` | No server-side bounded query, count, stable cursor/order, or filter contract |
| `/api/curate/list` | `page`, `per_page` up to 100, filter values; count and rows from a left join to `meme_curation` | No search; no ingestion gate; no authenticated judge context |
| `/api/curate/super/memes` | `page`, `per_page` up to 50, ID/title search, `resolved`/`unresolved` filter, count | Parameterized search; human consensus derived from three usernames; no ingestion gate |
| Reports | Server-side status/query/limit up to 250, then HTML filters again | Separate moderation surface; not part of Admin Vault |
| Legacy Admin analytics rankings | Server-side sort/page/min views | Legacy analytics contract only |

Current Admin view modes are a single row/list layout with client pagination. No
five-mode Vault preference model, contextual details panel, bulk status workflow,
or server-side selection semantics exists yet. The form exposes the ID field under
Advanced Options (`src/admin/AdminApp.tsx:1040-1054`), and ordinary PATCH permits
changing the ID without reference migration.

## 9. R2/D1 failure-mode analysis

| Operation | Current sequence | Failure or integrity risk | Required later control |
|---|---|---|---|
| Single upload | R2 `put` then return path; D1 metadata is a separate request | R2 orphan if browser/D1 request fails; no operation record or retry identity | Durable item/job and media operation state; idempotency key; private lifecycle defaults |
| Metadata create | D1 `INSERT`; status/is_active derived from requested status | Client can request archived/draft but no intake job; duplicate request is not idempotent | Unique stable item key and `INSERT ... ON CONFLICT` policy |
| Metadata edit | D1 pointer/metadata update, including `id` | ID change does not update curation, final, analytics, reports, or force-removal references | Immutable normal ID; separately audited migration operation only |
| Hard delete | Reads `storage_path`; attempts `env.R2_BUCKET.delete`; batches D1 deletes | R2 binding mismatch means media may remain; no per-item result/audit; deletes only selected tables | New-key/revision saga and explicit per-item outcome; no false success |
| Shared `/api/curate/force-remove` | `hardRemoveMeme` attempts R2, inserts audit row marked `r2_deleted=1`, then deletes related D1 rows | Delete errors are logged but audit can claim success; audit row can be deleted relationship-wise; cleanup fallback is partial | Durable force-removal state, confirmed operation result, retry endpoint |
| `/api/cat/force-remove` | D1 deactivation + audit batch, then R2 delete; stores `r2_error` on failure | Better retry shape, but key gets a leading slash and “no R2 key” is marked deleted; separate semantics from shared path | One shared state machine and documented object-key/confirmation rules |
| R2 sync | Lists R2, inserts missing D1 rows, deletes D1 rows whose R2 object is absent | Uncertain/missing object can cause irreversible D1 deletion; no audit, no dependency cleanup, no quarantine | Reconciliation report/quarantine; no automatic purge of uncertain mismatches |
| Notification content upload | R2 put then D1 insert | R2 orphan if D1 insert fails; no cleanup record | Separate notification media cleanup or generalized media operation |
| Canonical image replacement | No current image editor/revision endpoint | Pointer changes and old-object deletion are not compare-and-swap or recoverable | Phase 6 media-operation saga with unique new key and revision check |

`functions/_shared/forceRemove.ts:35-41` treats a non-throwing `bucket.delete()`
call as enough, but does not record a per-key confirmed read/check. The approved
implementation must define what “confirmed deletion” means for R2 and preserve
retry information when confirmation is unavailable.

## 10. Candidate Phase 1 durable model

This is a proposed design for operator review, not an implementation decision. It
is intentionally separate from `memes.status`, `meme_curation`, and the existing
AI stores.

### Candidate tables

#### `ingestion_batches`

```text
id                 TEXT PRIMARY KEY                 -- stable batch ID
idempotency_key    TEXT UNIQUE NOT NULL             -- retry-safe client/batch key
actor_id           TEXT NOT NULL                    -- admin identity/session subject
actor_name         TEXT
status             TEXT NOT NULL                    -- derived or queued/processing/finished/partial/failed
created_at         TEXT NOT NULL
updated_at         TEXT NOT NULL
completed_at       TEXT
```

Candidate indexes: `(created_at DESC)`, `(status, updated_at)`, and the unique
idempotency key. Batch status should be derived from item states where possible,
so counts cannot drift from durable item rows.

#### `ingestion_jobs`

```text
idempotency_key    TEXT PRIMARY KEY                 -- stable per-file retry identity
job_id             TEXT UNIQUE NOT NULL
batch_id           TEXT NOT NULL REFERENCES ingestion_batches(id)
meme_id            TEXT UNIQUE NOT NULL REFERENCES memes(id)
state              TEXT NOT NULL                    -- queued/processing/retry_wait/failed/human_ready
attempt_count      INTEGER NOT NULL DEFAULT 0
lease_owner        TEXT
lease_expires_at   TEXT
next_attempt_at    TEXT
error_code         TEXT
error_message      TEXT
created_at         TEXT NOT NULL
updated_at         TEXT NOT NULL
last_attempt_at    TEXT
completed_at       TEXT
```

Candidate indexes: `(state, next_attempt_at)`, `(state, lease_expires_at)`,
`(batch_id, state)`, and `(meme_id)`. State transitions must be enforced by a
shared server-side helper and compare-and-swap claim/update statements. Error
messages must be bounded and sanitized.

#### `ingestion_ai_evaluations`

```text
id                 TEXT PRIMARY KEY
job_id             TEXT NOT NULL REFERENCES ingestion_jobs(job_id)
meme_id            TEXT NOT NULL REFERENCES memes(id)
judge_key          TEXT NOT NULL                    -- stable configured judge/provider key
provider_key       TEXT NOT NULL
state              TEXT NOT NULL                    -- pending/processing/succeeded/retry_wait/failed
attempt_count      INTEGER NOT NULL DEFAULT 0
result_reference   TEXT                              -- persisted result ID or blob reference
error_code         TEXT
error_message      TEXT
started_at         TEXT
finished_at        TEXT
next_attempt_at    TEXT
created_at         TEXT NOT NULL
updated_at         TEXT NOT NULL
UNIQUE(job_id, judge_key)
```

Candidate indexes: `(job_id, state)`, `(state, next_attempt_at)`, and
`(meme_id, judge_key)`. A job may become `human_ready` only after every required
configured evaluation has state `succeeded` and its validated result reference
exists. An AI result must remain an advisory record and never be inserted into
`meme_curation`.

#### `media_operations` (Phase 1 or Phase 6 decision)

```text
id                 TEXT PRIMARY KEY
actor_id           TEXT NOT NULL
meme_id            TEXT NOT NULL REFERENCES memes(id)
operation_type     TEXT NOT NULL                    -- replace_canonical / cleanup / reconcile
old_r2_key         TEXT
new_r2_key         TEXT
expected_revision  INTEGER NOT NULL
new_revision       INTEGER
state              TEXT NOT NULL                    -- queued/uploaded/switched/cleanup_pending/completed/failed
attempt_count      INTEGER NOT NULL DEFAULT 0
error_code         TEXT
error_message      TEXT
created_at         TEXT NOT NULL
updated_at         TEXT NOT NULL
completed_at       TEXT
```

Candidate indexes: `(meme_id, created_at)`, `(state, updated_at)`, and a unique
active-operation guard per meme where supported. The pointer switch must be a D1
compare-and-swap against the expected revision. R2 upload and D1 pointer update
are separate saga steps; neither may be represented as a cross-system
transaction.

### Candidate invariants

- New intake inserts `memes` with `status = 'archived'`, `is_active = 0`, and no
  final keep.
- Retrying a batch/item request reuses the stable idempotency key and does not
  create a second meme/job/evaluation.
- `human_ready` is derived from successful, persisted, validated required AI
  evaluations, not from `memes.status` or the existence of an unverified processed
  row.
- Missing ingestion-job rows mean legacy behavior during the compatibility
  window; presence of a row activates the new gate.
- Force-removal state wins over retries and cannot be reactivated by AI completion
  or metadata updates.
- SQL values remain parameterized; only fixed internal table/state identifiers may
  be interpolated.

### Open schema decision

The operator must decide whether the existing advisory `ai_curation_predictions`
table is formally migrated in `025_...sql`, replaced by a new result table for
ingestion evaluations, or retained only for legacy display. The audit recommends
not overloading it without first checking its deployed columns and producer
contract. `ai_judge_processed` has a different run/operator semantics and should
not be used as the per-job two-judge readiness source.

## 11. Backward-compatibility strategy

1. **Legacy memes without an ingestion job:** remain eligible under the current
   curation queue and human consensus behavior until explicitly resolved. Do not
   backfill jobs from point-in-time counts without an agreed migration rule.
2. **New intake memes with an ingestion job:** remain archived and inactive even
   when upload or one AI judge succeeds. The queue can return them only after the
   durable `human_ready` transition.
3. **Existing human ballots and final records:** remain untouched. No AI result is
   converted into a human ballot, and no automatic re-resolution is performed.
4. **Existing public keep records:** continue to require the final keep join and
   active-state checks. New ingestion code must not weaken or bypass this.
5. **Existing Admin API clients:** preserve current response fields while adding
   narrow batch/status/retry contracts. Do not turn the existing generic metadata
   PATCH into an arbitrary state-transition endpoint.
6. **Existing notifications and Android telemetry:** remain independent of Admin
   Analytics UI removal and remain backed by migrations `015`–`024`.

## 12. Required tests and verification plan

### Baseline commands actually run

| Command | Result |
|---|---|
| `git fetch origin` | Passed; no remote divergence |
| `npm ci` | Passed; restored 90 packages without tracked-file changes |
| `npm run build` | Passed; 1,639 modules transformed; existing >500 kB chunk warning |
| `npm run test:analytics` | Passed after `npm ci`; 5/5 tests |
| `node --test tests/curationConsensus.test.mjs` | Passed; 9/9 tests |
| `npx tsc -p tsconfig.functions.json --noEmit` | Failed on existing Functions errors: duplicate `is_nsfw`, `R2_BUCKET` not in `Env`, several `unknown` body/data errors, and WebCrypto type errors |
| `npm test` | Not configured; npm reports missing script |
| `git diff --check` | Failed on pre-existing dirty knowledge-file trailing whitespace/blank EOF |
| Local D1 migration apply | Failed at migration 008 because `ai_curation_predictions` is missing |
| Remote D1 migration listing | Blocked; `CLOUDFLARE_API_TOKEN` unavailable; no remote mutation attempted |

### Required future tests before Phase 1 acceptance

#### Publication and curation

- Draft, archived, unfinalized, excluded, duplicate, review-later, NSFW, and
  force-removed rows do not appear in public D1 delivery.
- Public random/daily routes require final keep plus existing active/status/NSFW
  conditions, including a direct force-removal exclusion.
- Legacy rows without ingestion jobs retain current queue eligibility.
- New rows with jobs stay out of human queues until `human_ready`.
- AI completion and `human_ready` never set `is_active = 1` or create final keep.
- Three-human majority and arbitration behavior remains unchanged.

#### AI reliability and separation

- Both required judge evaluations must be persisted successfully before readiness.
- One success plus one failure remains non-ready.
- Timeout, rate limit, provider error, malformed output, and result-persistence
  failure produce bounded retry/terminal states.
- Expired claims are reclaimable and repeated worker invocation is idempotent.
- AI workers never call human approval endpoints and never write `meme_curation`.
- An explicit human click may adopt advisory context only through the existing
  authenticated human workflow.

#### Ingestion and R2/D1 recovery

- Duplicate batch/item requests do not create duplicate rows or objects.
- Server-side type/size/count validation rejects unsupported first-release video
  and oversized files as specified by the approved release.
- R2 success followed by D1 failure creates a visible recoverable state.
- D1 success followed by AI failure remains private and retryable.
- R2 delete/pointer-switch/cleanup failures retain operation state and never claim
  confirmed success.
- Force-removed IDs cannot re-enter through retry or reconciliation.

#### Admin UI/API and access

- Server-side filters, bounded page size, stable ordering, and total counts agree.
- Normal forms cannot edit IDs; exceptional migrations require a separate audited
  operation.
- Admin, Superadmin, Judges 1–3, AI sessions, and public routes enforce their
  intended authorization independently of frontend visibility.
- Removing the Admin Analytics tab does not break Android event ingestion,
  deletion, notification registration, scheduled delivery, or workers.

## 13. Open questions and blockers for operator review

1. **Remote migration history:** Provide an authorized read-only Cloudflare token
   or an operator-run migration-history export before any production migration
   decision. No production migration was applied in Phase 0.
2. **Clean bootstrap:** Decide how the existing migration 008 missing-table issue
   is documented/resolved without rewriting historical migrations.
3. **AI judge identity:** Define the two required intake judges/providers and their
   stable keys. Decide whether existing Judge 4/5 `meme_curation` rows are legacy
   data to display, migrate, or leave untouched.
4. **AI governance correction:** Approve removal of the continuous automatic path
   that invokes `/api/curate/approve`, or define an explicit human-confirmation
   interaction that preserves the current manual UX.
5. **Legacy AI retirement boundary:** Confirm whether `/categorise`, the Admin AI
   tab, and numeric legacy endpoints are still used by an operator or external
   producer. Current repository schema does not define the `memes.ai_*` columns
   those Admin routes query.
6. **Ingestion media policy:** Confirm first-release image-only limits, maximum
   file count/bytes, exact content sniffing requirements, and whether media
   operation records begin in `025` or Phase 6.
7. **Batch idempotency source:** Choose the client item identity/idempotency-key
   contract for retries across browser refreshes and partial uploads.
8. **R2 deletion confirmation:** Define the acceptable confirmation probe and
   retry/repair operator surface. “No thrown error from delete” is insufficient
   for the approved audit semantics.
9. **Admin Analytics endpoint retirement:** Decide whether legacy Admin analytics
   APIs and calculations remain operationally available after the tab is removed,
   or whether a separate deprecation plan is needed.
10. **Documentation repair:** Decide who owns restoring the missing canonical
    single-source file, root README reference, and committed conflict markers in
    `docs/STATE.md`. Those repairs should not be mixed into the first schema
    migration without approval.

## 14. Phase 0 approval gate

Phase 0 is complete when the operator reviews this document and explicitly
approves the scope/design decisions needed for Phase 1. In particular, approval
should cover:

- the candidate ingestion tables and state transitions;
- the required AI result-store separation and governance correction;
- the clean-migration/bootstrap strategy;
- the legacy Admin AI and Analytics retirement boundaries; and
- the R2/D1 saga and deletion-confirmation approach.

Until that approval, no `025_` migration, ingestion worker, queue gate, Admin tab
removal, or media editor implementation should be added.

## Phase 3 implementation record

The operator authorized a direct jump to Phase 3 while holding Phases 1 and 2.
The implementation is intentionally limited to the Admin Console presentation
layer and its exclusive frontend modules:

- `src/admin/AdminApp.tsx` now has grouped Collection, Curation, and Operations
  navigation. Collection contains Meme Vault and Add Memes; Curation links to
  `/curate`, `/ai-judge`, and `/reports`; Operations retains Push Notifications,
  SQL Playground, local drafts, and R2 sync.
- `src/admin/admin.css` adds keyboard-focus states, a collapsible desktop icon
  rail with hover/focus expansion, an accessible pin/toggle control, and a
  responsive mobile drawer/backdrop.
- The Admin Analytics and legacy Admin AI Categorisation tabs and their exclusive
  frontend modules were removed. The Android telemetry APIs, analytics workers,
  notification APIs/workers, `/categorise`, `/curate`, `/ai-judge`, and legacy
  Admin analytics/AI backend endpoints were retained.
- No D1 migration, schema query, public publication gate, curation consensus
  implementation, or AI result store was changed.

### Phase 3 report

1. **Phase and branch:** Phase 3 implemented on `main` at baseline
   `2cafbe8d...`; Phases 1 and 2 remain held.
2. **Files changed:** UI in `src/admin/AdminApp.tsx` and
   `src/admin/admin.css`; deleted exclusive Admin Analytics and Admin AI UI
   modules under `src/admin/analytics-dashboard/` and `src/admin/ai/`; generated
   project structure and updated affected documentation.
3. **Behavior:** Added grouped responsive Admin navigation and direct links to
   retained workbenches; removed the two retired Admin tabs and their frontend
   modules; retained backend/API and worker contracts.
4. **Verification:** `npm run build` passed with the existing Vite chunk-size
   warning; `npm run test:analytics` passed 5/5; `node --test
   tests/curationConsensus.test.mjs` passed 9/9; targeted reference and
   documentation checks passed.
5. **Integrity/security:** No migration, D1 query, public final-keep gate,
   human consensus, AI result store, Android telemetry, notification, or auth
   implementation was changed. Existing Admin token and SQL authorization remain
   in place.
6. **Migration status:** No migration created or applied locally, in preview, or
   in production.
7. **Remaining limitations:** Backend legacy analytics/AI endpoints remain
   intentionally preserved pending a separate deprecation decision. The existing
   Phase 0 baseline typecheck and clean migration-chain issues remain open.
8. **Next phase:** Phase 1 and Phase 2 prerequisites were authorized and
   implemented locally with Phase 4; production rollout remains gated by the
   migration and credential checks recorded below.

## Phase report

1. **Phase completed:** Phase 0 audit and scope lock prepared on `main` at
   `2cafbe8d...`; no functional changes.
2. **Files changed:** Added `docs/ADMIN_OVERHAUL_AUDIT.md` only. Pre-existing
   changes in the four files listed in Section 1 were preserved.
3. **Behavior added/removed:** None.
4. **Verification:** See Section 12; build and both available test suites pass
   after dependency restoration; Functions typecheck and clean migration apply
   expose existing baseline failures.
5. **Integrity/security checks:** Reviewed final-keep publication gate, human
   consensus separation, AI stores, authentication boundaries, SQL parameter use,
   R2/D1 ordering, deletion failure handling, and ID/reference behavior.
6. **Migration status:** No migration applied to preview or production. Local
   disposable D1 migration verification stopped at historical migration 008.
7. **Remaining risks:** AI auto-vote path, missing formal AI prediction migration,
   incomplete clean bootstrap, R2/D1 non-atomic operations, Admin client-side
   corpus loading, inconsistent auth compatibility paths, and legacy documentation
   drift remain open by design for approved later phases.
8. **Next phase:** Phase 1 and Phase 2 foundations were authorized and implemented
   locally as part of Phase 4. Production rollout remains gated by migration
   `025`, remote schema verification, and advisory provider configuration.

## Phase 1/2 and Phase 4 implementation record

The operator authorized the previously held Phase 1/2 prerequisites together with
Phase 4 on 2026-11-03. The implementation remains additive and keeps public
final-`keep` gating, human consensus, and AI advisory separation unchanged.

### Durable schema and state

- `d1/migrations/025_durable_meme_ingestion.sql` adds `ingestion_batches`,
  `ingestion_jobs`, and `ingestion_ai_evaluations`. The tables store stable batch
  and item idempotency keys, generated intake IDs, content hashes, upload state,
  processing leases, bounded errors, retry timing, and independent Judge 4/5
  structured results.
- New intake jobs are created before the `memes` row because the browser first
  confirms metadata and then uploads media. After R2 success, the upload route
  creates an archived/inactive `memes` row. No new job has a foreign key that
  would require a pre-upload meme row.
- `functions/_shared/ingestion.ts` centralizes image-only limits and signatures,
  SHA-256 hashing, durable status derivation, migration availability checks, and
  the compatibility lookup used by the human queue.

### API and workflow

- `functions/api/admin/ingestion/batches.ts` creates or reads idempotent batches,
  validates count/size/type/IDs, initializes both advisory evaluation rows, and
  reports duplicate content warnings.
- `functions/api/admin/ingestion/upload.ts` validates actual image bytes,
  recomputes the content hash, writes a unique R2 key, persists private metadata,
  and retains a recoverable uploaded state when a later D1 write fails.
- `functions/api/admin/ingestion/process.ts` claims one uploaded job with a
  lease, evaluates configured `judge4` and `judge5` presets, validates taxonomy
  output, retries transient failures up to three attempts, and transitions to
  `human_ready` only when both evaluations succeed. It never writes
  `meme_curation`, calls a human approval endpoint, activates a meme, or creates
  a final keep. `functions/api/admin/ingestion/retry.ts` resets only selected
  failed jobs/evaluations.
- `functions/api/curate/next.ts`, `list.ts`, and `super/memes.ts` hide new intake
  rows until `human_ready`; `approve.ts` and `save.ts` reject direct editorial
  writes before that state. Legacy rows without an ingestion job retain the
  compatibility behavior.
- `src/admin/BulkIngestionWorkspace.tsx`, `src/admin/bulkIngestion.ts`,
  `src/lib/adminApi.ts`, `src/admin/AdminApp.tsx`, and `src/admin/admin.css`
  implement the review grid, drag/drop, stable IDs, local draft validation,
  bounded three-item concurrency, server progress restore, and failed-item
  retry controls. The existing single-meme editor remains available.

### Decisions and limitations

- The first release accepts PNG, JPEG, GIF, WebP, and AVIF images only, with a
  20 MiB item limit, 50-item batch limit, and 200 MiB total descriptor limit.
  Video is rejected at both client and server boundaries.
- AI configuration uses the existing encrypted `cat_judge_ai_presets` rows keyed
  by the stable `judge4` and `judge5` usernames. No secret values are committed.
- Processing is an authenticated, request-driven bounded endpoint rather than a
  newly deployed scheduled Worker. Leases and retry state preserve the data
  contract for a later scheduler without requiring a second deployment now.
- Browser `localStorage` preserves batch metadata and server progress, but cannot
  persist a `File` object. An upload that had not started must be selected again
  after refresh; already uploaded and processing items resume from D1 state.

### Verification and rollout boundary

- Local execution of migration 025 succeeded, and `PRAGMA table_info` verified all
  three new tables. `npm run build`, `npm run test:ingestion`,
  `npm run test:analytics`, and the 9-case consensus test suite passed.
- Functions typecheck still reports the baseline unrelated errors documented in
  Section 12; the new ingestion files introduced no additional reported errors.
- Remote `PRAGMA` verification was attempted read-only and blocked by missing
  `CLOUDFLARE_API_TOKEN`. No production migration, deployment, R2 write, or
  secret operation was performed.
