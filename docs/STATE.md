---
project: Meme Capsule — Serverless Edge Backend & Curation Engine
status: production
current_phase: Production Operations, Multi-Judge Consensus & Scaling
architecture: Cloudflare Pages + Functions + D1 (SQLite) + R2 Media CDN
deployed_url: https://meme-capsule-eww.pages.dev
mobile_companion_app: com.meme.capsule (v3.8 / versionCode 29; v3.7 / versionCode 28 on Google Play)
web_companion_platform: https://memecapsule.wtf
updated: 2026-11-03
---

# Project State: Meme Capsule (Serverless Edge Backend & Curation Engine)

## 1. Executive Snapshot

This repository serves as the **Serverless Edge Backend, Multi-Judge Curation Engine, Moderation Hub, and Administration Portal** for the Meme Capsule ecosystem. It is deployed on Cloudflare Pages at `https://meme-capsule-eww.pages.dev`.

The legacy prototype landing UI (`src/App.tsx`, `src/styles.css`) has been permanently discontinued and removed. The default root `/` and hash routes serve the internal Neo-Brutalist tool suites (`/curate`, `/admin`, `/reports`, `/ai-judge`, `/categorise`). The public consumer mobile application is maintained in a companion Android repository (`com.meme.capsule`), and the promotional web platform is at `https://memecapsule.wtf`.

### Engineering Leadership & Division
- **Anmol Verma** (`editorav010-dev`): **Lead Backend Developer** — Full backend engineering, serverless Cloudflare architecture, core algorithms, database migrations, security, curation systems, and all internal backend workbenches.
- **Pratham Pandey** (`bbethical010-glitch`): **Lead Frontend Developer & Original Ideator** — Founding concept, frontend landing pages, Android APK development (`com.meme.capsule`), app theme, typography, UI/UX, Java Android bridge, and client integrations.
- **Faraz Ahmed**: **Social Media & Marketing Lead** — Social media handles management, content planning, niche analysis, scripting, and marketing campaigns.

**Official App Contact:** `support@memecapsule.wtf` (with legacy fallback `memecapsule.app@gmail.com`)  
**Official Social Media:**  
- Instagram: https://www.instagram.com/capsule.meme/  
- X: https://x.com/memecapsule_  
- Threads: https://www.threads.com/@capsule.meme

---

## 2. Implemented Architecture & Current Features

### A. Edge Serverless API (`functions/api/`)
- **Public Meme Delivery**:
  - `GET /api/random-meme`: Dual-source meme delivery with fallback (`fallbackMemes.ts`).
  - `GET /api/daily-meme`: Scheduled 24-hour deterministic daily drop.
  - `POST /api/like`: Edge real-time global like counters synchronized with Cloudflare D1.
  - `GET /api/likes`: Batch likes retrieval for pre-liked client state caching.
  - `POST /api/report`: User safety reporting endpoint.
  - `POST /api/contact`: Public and advertiser inquiry endpoint with Cloudflare Pages Functions.
  - `POST /api/events`: Batched client telemetry event ingestion.
  - `POST /api/notifications/register`: Android app device-token registration for Firebase push delivery using D1 persistence.
  - `POST /api/admin/notifications/send`: Admin-only Firebase Cloud Messaging dispatch to all active devices, a topic, or one test token.
  - `GET /api/admin/notifications/stats`: Protected active-device and app-version/platform breakdown.
  - `GET/POST /api/admin/notifications/messages`: Admin-managed reusable notification message templates.
  - `GET/POST /api/admin/notifications/schedules`: Admin-managed timezone-aware recurring schedules and delivery history.
  - `GET/POST /api/admin/notifications/content-files`: Admin upload/list endpoints for persistent random notification content libraries.
  - `POST /api/analytics/events`: Authenticated, consented Android event ingestion with event-id deduplication.
  - `GET /api/analytics/overview`, `GET /api/analytics/trends`: Curator-session-protected live Android KPI reads.
  - `GET /api/analytics/retention`, `/funnel`, `/content`, `/audience`, `/ai-insights`: Aggregate dashboard analytics for the remaining live tabs.
  - Analytics dashboard surfaces use live API responses only; loading, empty, and unsupported-metric states are explicit and never replaced with mock values.
  - Phase 6 performance controls: migration 020 adds bounded daily Android summaries; the analytics worker refreshes them and invalidates one-minute KV caches for aggregate dashboard reads.
  - Phase 7 verification: `npm run test:analytics` covers ingestion contract and privacy rejection paths; staging execution is documented in `docs/ANALYTICS_STAGING_VERIFICATION.md`.
- **Admin Collection & Database APIs (`functions/api/admin/`)**:
  - `/api/admin/memes`: Prepared-statement D1 CRUD for meme metadata.
  - `/api/admin/upload`: Multi-part media upload streaming directly to Cloudflare R2 bucket.
  - `/api/admin/ingestion/batches`, `/upload`, `/process`, and `/retry`: token-protected durable image-batch intake with resumable upload and advisory AI state.
  - `/api/admin/sync-r2`: Two-way reconciliation scanning R2 bucket objects into D1 rows.
  - `/api/admin/sql`: Token-protected raw SQL console execution engine with safety guards.
  - `/api/admin/memes/hard-delete`: Destructive cleanup endpoint for removing invalid records.
  - `/api/admin/analytics/*`: Retained legacy ranking, trend, overview, and reset endpoints; the former Admin Analytics React tab was retired in Phase 3.
- **Curation & Consensus APIs (`functions/api/curate/`)**:
  - `/api/curate/list`, `/api/curate/next`, `/api/curate/save`, `/api/curate/stats`: Multi-judge voting operations.
  - `/api/curate/approve`: Atomic single-judge adoption and authoritative finalization (writes to `meme_curation_final` and `memes`).
  - `/api/curate/force-remove`: Destructive cleanup endpoint permanently purging non-memes from R2 and D1.
  - `/api/curate/account`: Self-service judge credential management.
  - `/api/curate/ai-presets`: Judge-isolated vision model configurations.
  - `/api/curate/super/*`: SuperAdmin conflict resolution, bulk resolution, and summary stats.
- **Categorization & Force Removal APIs (`functions/api/cat/`)**:
  - `/api/cat/decide`, `/api/cat/next`, `/api/cat/login`, `/api/cat/logout`, `/api/cat/me`: Taxonomy tagging operations.
  - `/api/cat/force-remove`: Irreversible purge deactivating D1, logging `meme_force_removals` audit row, and physically deleting media from R2 bucket. See [FORCE_REMOVE_FEATURE.md](file:///c:/Users/avspn/Desktop/projects/meme%20application/docs/FORCE_REMOVE_FEATURE.md).
  - `/api/cat/admin/force-removals`: Superadmin audit viewer for inspecting all force-removed media, judge attribution, and R2 deletion status.
- **AI Pre-Curator APIs (`functions/api/ai-judge/`)**:
  - `/api/ai-judge/classify`, `/api/ai-judge/run/start`, `/api/ai-judge/run/stop`, `/api/ai-judge/run/progress`: Autonomous multimodal evaluation loop.

### B. Cloudflare D1 Database & Migrations (`d1/migrations/`)
The database `meme-capsule-db` (SQLite at the edge) operates under additive migrations through 025:
1. `000_complete_setup.sql`: Core schema initialization.
2. `002_analytics.sql`: Event tracking, interactions, and ranking tables.
3. `003_categorisation.sql`: Multi-judge accounts and editorial taxonomy.
4. `004_ai_judge.sql`: AI judge operator tables and evaluation logs.
5. `004_curation.sql`: Multi-judge consensus tracking tables.
6. `005_curation_final.sql`: SuperAdmin authoritative resolution tables.
7. `006_judge_ai_presets.sql`: Private AI vision presets per judge.
8. `007_add_judge4_judge5.sql`: Expansion of judge accounts for majority consensus.
9. `008_optimize_curation_indexes.sql`: High-performance composite indexes.
10. `009_add_api_password_to_users.sql`: SHA-256 hashed API passwords for judge sessions.
11. `010_enforce_superadmin_active_and_cleanup_judges.sql`: Session cleanup and active role enforcement.
12. `011_force_removals.sql`: Audit table `meme_force_removals` and indexes for irreversible media purges.
13. `011_reconcile_active_and_curation_sync.sql`: Synchronization of active counts between Admin and Curation portals.
14. `012_add_curation_status_to_memes.sql`: 3-tier partitioning architecture introducing `curation_status` (`active`, `excluded`, `backlog`).
15. `013_add_nsfw_flag.sql`, `014_add_resolved_curation_fields.sql`, `015_android_analytics_events.sql`, `016_android_analytics_schema_version.sql`, `017_android_analytics_query_indexes.sql`, and `018_android_analytics_deletion_audit.sql`: NSFW metadata, resolved curation fields, isolated consented Android telemetry, versioned analytics payloads, KPI indexes, and deletion auditing.
16. `021_create_device_tokens.sql` and `022_rename_device_tokens_to_notification_tokens.sql`: FCM device registration storage and the canonical `notification_tokens` table name.
17. `023_scheduled_notifications.sql`: Reusable notification messages, recurring schedules, and idempotent delivery-run audit records.
18. `024_notification_content_files.sql`: Persistent R2-backed JSON/CSV content libraries attachable to schedules.
19. `025_durable_meme_ingestion.sql`: Idempotent bulk image batches, upload/retry leases, independent Judge 4/5 evaluations, and the human-ready gate.

### C. Cloudflare R2 Media Storage
- Bucket `memes` configured with public access enabled.
- Zero egress fees for high-volume WebP image and MP4/GIF delivery.
- Media synchronization engine in `/admin` ensuring D1 metadata matches physical R2 storage objects.

- **`/curate`**: Multi-judge consensus curation dashboard with keyboard shortcuts (`K`, `X`, `D`, `R`), fast-approval of AI Consensus (`Space`/`Enter`), instant single-AI adoption, three-human majority finalization (`POST /api/curate/approve`) with arbitration on unresolved outcomes, destructive Force Remove (`Shift+Delete` / `POST /api/curate/force-remove`), Superadmin dashboard view with force removal audit, judge account management, judge-isolated AI presets, and CSV/JSON export. Deeply integrates the **AI-Judgement Review Workflow** with AI Judges 4 and 5.
  - **Majority Consensus Batch Resolution**: Superadmin dashboard includes `[⚡ INSTANT RESOLVE MAJORITY KEEPS]` and `[⚡ INSTANT RESOLVE MAJORITY EXCLUDES]` CTA buttons calling `/api/curate/super/bulk-resolve` with `majority_keep` and `majority_exclude` actions to batch-resolve 2:1 human consensus memes without individual manual arbitration.
  - **Cumulative Judge Actions Preservation**: Lifetime judge actions aggregate active votes and purged memes (`active_reviewed + force_removed`), ensuring reviewed counts remain accurate and never regress when non-memes are purged.
  - **Manual Refresh & Ctrl+R Interception**: Background auto-refresh intervals completely removed from both Curate Super Dashboard and Admin Portal; replaced with instant `[🔄 REFRESH (Ctrl+R)]` manual trigger that intercepts browser refresh commands.
  - **Already Curated Detection & "Re-curate" Overlay**: When navigating through history, already-curated memes display a neon lock overlay showing the curator's saved decision, topics, and tone, with `[✏️ RE-CURATE THIS MEME]` and `[SKIP TO UNREVIEWED ➔]` actions; mutation hotkeys and swipe gestures are locked to prevent accidental overwrites.
  - **Mobile Curation Experience (<768px)**: Seamless, touch-first responsive curation preserving desktop experience pixel-for-pixel:
    - **APK-Style Stacked Card Deck**: Active card interacts with swipe gestures while preloaded next card (`prefetchQueueRef.current[0]`) sits visible behind it (scaling up from 0.94 to 1 and opacity from 0.65 to 1 dynamically as the user drags).
    - **Touch Gesture Engine**: Swipe Right to adopt AI Judge 4, Swipe Left to adopt AI Judge 5, Double-Tap to trigger Force Remove modal (with haptic vibration). Vertical swipe-up hijacking removed to allow smooth, native scrolling.
    - **Server-Confirmed Advancement**: Card transitions only execute after successful `POST /api/curate/approve` response, snapping back with an error toast on network failure.
    - **Dynamic Aspect Ratio**: Cards render at natural image dimensions with a safe viewport cap instead of desktop fixed 68vh boxes.
    - **Compact AI Preview Strip**: Displays consensus verdicts and directional hints above the meme stage.
    - **Role-Based AI Console Gating**: Continuous AI Judge Console is hidden from human judges (1–3) on all viewports, visible to judge4/5 operators on desktop only.
    - **Quick Action Bar & Gesture Footer**: Complete touch alternatives for non-gesture accessibility; 3-column layout featuring `[✏️ MANUAL OVERRIDE]`, `[🔞 TAG NSFW]` (toggling client-gated 18+ tag matching desktop logic with real-time neon active state), and `[🗑️ FORCE REMOVE]`.
- **`/admin`**: Administration console with grouped Collection/Curation/Operations navigation, D1 SQL console, R2 media sync, 5-metric status bar, local/backend meme editing, durable bulk image intake, manual `[🔄 REFRESH (Ctrl+R)]` control, and dark mode. The legacy Admin Analytics and Admin AI Categorisation views are retired; their uncertain/external backend routes remain preserved.
  - **Decoupled Bulk Intake & Telemetry**: Add Memes workflow strictly decouples Stage 1 file ingestion (uploading media to Cloudflare R2 and creating D1 `memes` draft rows) from Stage 2 AI advisory evaluations (Judges 4 & 5). Upload completion is officially established the instant all file bytes reach R2 and D1 draft rows are created, immediately freeing admin controls and enabling `[Start new batch]` and `[Open Drafts in Meme Vault ↗]`.
  - **Sticky Telemetry & Progress Bar**: Real-time upload speed is smoothed using a sliding-window Exponential Moving Average ($\alpha = 0.25$) with real-time ETA and a graphical progress track ($0\%$ to $100\%$). Telemetry remains sticky after upload completion with a solid green summary confirmation instead of unmounting prematurely.
  - **Isolated Retry Controls & Badges**: Media rows maintain two distinct badge indicators: Primary Upload Status (`UPLOADED (DRAFT)` in emerald vs `UPLOAD FAILED` in coral) and Secondary AI Advisory Status (`AI READY`, `AI PREPROCESSING`, `AI OFFLINE / RETRY`). AI evaluation errors never turn the upload badge or the batch status red. Discrete retry triggers allow retrying failed network uploads independently from failed AI vision prompts.
- **Analytics route**: The Super Admin CTA opens `#/curate/analytics`, where the KPI cards and engagement trend read live consented Android analytics through curator-session-protected APIs. Secondary design panels remain preview-only until their backend contracts are implemented.
- **Live Android analytics path**: Migration 015 adds `android_analytics_events`; `POST /api/analytics/events` accepts authenticated, consented Android batches, and curator-session-protected `/api/analytics/overview` plus `/api/analytics/trends` provide low-latency KPI reads. The analytics route refreshes these values every 30 seconds. Configure `ANALYTICS_APP_TOKEN` before enabling ingestion.
- **Phase 1 contract freeze**: Migration 016 adds required `schema_version = 1` validation to Android event ingestion. The Android client must include this field on every event before production telemetry is enabled.
- **Analytics ingestion hardening**: The Android ingestion endpoint now enforces JSON content type, a 2 MiB body limit, bounded optional fields/properties, nested PII/secret-key rejection, fixed-window per-IP/per-token rate limits through `ANALYTICS_KV`, `Retry-After` responses, and aggregate operational counters that exclude payloads, hashes, IPs, and tokens.
- **Raw-event retention**: The scheduled analytics worker purges up to 10,000 expired Android events per run. Retention defaults to 90 days and can be configured with `ANALYTICS_RAW_RETENTION_DAYS` (clamped to 1–365 days).
- **Worker trigger protection**: Manual analytics-worker `POST` execution now requires the separate `ANALYTICS_WORKER_TOKEN`; scheduled execution remains internal.
- **Scheduled notifications**: `workers/notificationScheduler.ts` runs every minute, evaluates D1 schedules in their configured IANA timezones, claims each occurrence once, dispatches through FCM, deactivates unregistered tokens, and records delivery outcomes. It is independent of the admin page.
- **Scheduler diagnostics**: Failed runs are retried safely within a short delayed-cron window, and the admin Scheduled Drops panel displays attempted/sent counts and stored FCM or configuration errors.
- **Random content libraries**: Admins can upload validated JSON/CSV libraries to R2, or the sectioned catalog TXT format, attach one to a schedule, and have the Worker randomly choose one valid title/body entry for each delivery. Library-backed schedules require only timing plus a file; an internal fallback message satisfies the legacy schedule foreign key but is never used when a library ID is attached. The Worker resolves the R2 path from D1 when needed and fails the run instead of sending placeholder content if the library link is broken. JSON accepts a flat entry array, an `entries` wrapper, or the original `sections[].entries[]` catalog shape, including UTF-8 BOMs. Catalog section names become the limited title pool; all formats enforce message length limits.
- **Phase 3 query performance**: Migration 017 adds composite indexes for time-bounded Android KPI queries. Overview and trends responses now include explicit freshness and empty-state metadata.
- **Phase 4 deletion lifecycle**: Migration 018 adds `android_analytics_deletion_audit`; superadmins can process verified anonymous-hash deletion requests through `POST /api/analytics/deletion`, with audit listing through the protected `GET` route.
- **Phase 4 consent lineage**: Migration 019 stores `consent_version` with each Android event, defaulting legacy clients to `v1`. Consent denial/revocation remains local and must not emit behavioral telemetry.
- **Production rollout plan**: The remaining work is tracked phase-by-phase in [ANALYTICS_PRODUCTION_IMPLEMENTATION_PLAN.md](./ANALYTICS_PRODUCTION_IMPLEMENTATION_PLAN.md), covering Android instrumentation, delivery reliability, ingestion hardening, lifecycle controls, dashboard completion, scale testing, and staged release gates.
 - **`/admin`**: Administration console with grouped navigation, D1 SQL console, R2 media sync, 5-metric status bar, meme collection editing, dark mode, and manual refresh controls. Android telemetry, notification delivery, scheduled workers, and retained backend analytics contracts remain outside the retired UI.
 - **Random meme repetition controls**: `/api/random-meme` accepts up to 50 excluded meme IDs, samples from up to five candidates near a random key with wrap-around candidates, falls back safely when every eligible meme is excluded, and explicitly disables response caching. `POST /api/admin/rebalance-random-keys` redistributes active meme keys for maintenance.
- **`/categorise`**: Multi-topic taxonomy tagging, tone labeling, and humor mechanism tagging.
- **`/ai-judge`**: Multimodal AI pre-curator loop powered by NVIDIA NIM Llama 3.2 Vision and universal vision models.
- **`/reports`**: Token-gated content safety moderation desk.

---

## 3. Active Cross-Codebase Synchronization

The single source of truth across all 3 codebases lives in `docs/MEME_CAPSULE_KNOWLEDGE.md`, synchronized through `editorav010-dev/meme-capsule-sync`.
- **Fetch Script**: `powershell -ExecutionPolicy Bypass -File .knowledge/fetch-knowledge.ps1` (or `bash .knowledge/fetch-knowledge.sh` on macOS/Linux).
- **Update Script**: `powershell -ExecutionPolicy Bypass -File .knowledge/update-knowledge.ps1` (or `bash .knowledge/update-knowledge.sh` on macOS/Linux).
- Local sync metadata is tracked in `.knowledge/.knowledge_meta.json`.
- All sync scripts and metadata are cleanly organized in `.knowledge/`.

---

## 4. Current Verification & Build Status

- **Build Command**: `npm run build` (`tsc && vite build`).
- **Build Output**: Passes with 0 errors (all 1634 modules bundled into `dist/`).
- **Consensus Test Suite**: `node --test tests/curationConsensus.test.mjs` (9/9 tests pass).
- **Production Hosting**: Cloudflare Pages (`https://meme-capsule-eww.pages.dev`).

---

## 5. October 2026 Incident Resolution & Hardening (Option B Executed)

### Root Cause Analysis:
1. **500 Error Outage on `/api/curate/next`**: Edge code referenced `m.nsfw_flagged_by` from `013_add_nsfw_flag.sql`. The live D1 production database only had `is_nsfw` applied, missing `nsfw_flagged_by`. This crashed the endpoint with `D1_ERROR: no such column: m.nsfw_flagged_by`, prevented memes from loading, and displayed `0/4485 (0%)`.
2. **SuperAdmin Missing AI Judges**: Query was filtering `WHERE u.username IN ('judge1', 'judge2', 'judge3')` in `summary.ts` and `memes.ts`, hiding Judge 4 and Judge 5 from progress reporting.
3. **Data Integrity Confirmed**: All 7,183 reviews in `meme_curation` and 1,343 authoritative records in `meme_curation_final` remained 100% intact throughout.

### Implemented Hardening & Option B Fixes:
1. **Live D1 Schema Repair**: Applied `ALTER TABLE memes ADD COLUMN nsfw_flagged_by TEXT;` on live production D1. Verified column presence with `PRAGMA table_info(memes);`.
2. **Full 5-Judge Visibility**: Updated `summary.ts` and `memes.ts` to query all 5 configured judges (`judge1` through `judge5`) using `LEFT JOIN cat_users u`, guaranteeing all judges appear with their review stats.
3. **Strict Human Consensus Separation**: Consensus metrics (conflicts, unanimous keep, unanimous exclude, arbitration queue) are strictly calculated among human judges (`judge1`, `judge2`, `judge3`). AI Judges (4 & 5) provide reference votes only and **NEVER push conflicts or trigger arbitration**.
4. **Guaranteed Exclude & Force-Remove Auditing**: All 5 judges have their Exclude votes (`{j.excluded}`) and Force Remove purges (`{j.force_removed}`) counted and visibly displayed. Total Exclude Votes and Total Force Removals are added as top-level KPI cards. `hardRemoveMeme` writes immutable audit entries to `meme_force_removals`.
5. **Zero-Tolerance Schema Drift Rule**: Inscribed into `AGENT_RULES.md`, `AGENTS.md`, and `MEME_CAPSULE_KNOWLEDGE.md`, prohibiting agents from querying unverified columns.

---

## 6. SuperAdmin Curation Logic & Live Auto-Refresh (October 2026)

1. **2:1 Majority vs 1:1:1 Conflict Separation**:
   - Fixed `functions/api/curate/super/memes.ts` to properly differentiate between 2:1 human majority votes (`majority_keep`, `majority_exclude`, `majority_duplicate`, `majority_review_later`) and true 1:1:1 splits.
   - Updated SuperAdmin UI with dedicated badges: `2:1 MAJORITY KEEP` (blue `#007AFF`), `2:1 MAJORITY EXCLUDE` (orange `#FF9500`), and reserved `⚠️ 1:1:1 CONFLICT` (red `#FF453A`) only for genuine 3-way deadlocks.
2. **Dedicated "FINAL EXCLUDED" KPI Metric**:
   - Separated the `917 EXCL` badge out of the `ACTIVE RESOLVED` card into its own dedicated `FINAL EXCLUDED: {summary.resolved_excluded_count}` card.
3. **GitHub Actions-Style Silent Auto-Refresh Control**:
   - Implemented `AutoRefreshControl.tsx` matching GitHub Actions' workflow dropdown.
   - Configurable intervals (`Every 10 seconds`, `Every 30 seconds`, `Every minute`, `Every 5 minutes`, `Off`, plus `🔄 Refresh now`).
   - Integrated into both `/curate` SuperAdmin Command Center and `/admin` Administration Console.
   - Performs silent background data fetching without reloading the browser tab or disrupting active input.

---

## 7. Zero-Cost D1 Read Optimization (October 2026)

1. **Elimination of Per-Swipe Full-Table Scans**:
   - Replaced un-cached per-swipe `COUNT(*)` and correlated subqueries in [`functions/api/curate/next.ts`](file:///c:/Users/avspn/Desktop/projects/meme%20application/functions/api/curate/next.ts) with an in-memory isolate cache (15-minute TTL).
   - Heavy table scans are now completely bypassed when `include_stats=false`.
2. **Client-Side Optimistic Progress Incrementation**:
   - [`src/curate/CurateApp.tsx`](file:///c:/Users/avspn/Desktop/projects/meme%20application/src/curate/CurateApp.tsx) and [`src/curate/curateApi.ts`](file:///c:/Users/avspn/Desktop/projects/meme%20application/src/curate/curateApi.ts) updated to fetch next memes with `include_stats=false` during continuous swiping.
---

## 8. High-Performance Instant Curation Engine & Zero-Scan Edge Architecture (October 2026)

1. **Total Elimination of D1 Limit Exhaustion**:
   - **Guarded DDL Operations**: `ensureCurationTables`, `ensureAIPredictionTable`, and `ensureForceRemovalsTable` are guarded by module-level isolate flags (`tablesEnsured`), preventing redundant SQLite schema reads on every request.
   - **Zero-Scan Swiping**: `GET /api/curate/next` completely skips `COUNT(*)` calculations when `include_stats` is false, dropping row reads per swipe to **0 rows for stats**.
   - **Indexed Point Queries**: When `include_stats=true` (initial load/queue switch), replaced the 25,000-row correlated `WHERE EXISTS (...)` subquery with an indexed point scan on `meme_curation WHERE user_id = ?` (~200 rows read).
   - **Indexed Anti-Join**: Replaced `NOT IN (SELECT meme_id FROM meme_force_removals)` with an indexed `LEFT JOIN meme_force_removals fr ON m.id = fr.meme_id WHERE fr.meme_id IS NULL`.
2. **Instant 0ms Curation Latency with Prefetch Buffer**:
   - Implemented client-side **Prefetch Queue Buffer (3–5 memes)** in [`src/curate/CurateApp.tsx`](file:///c:/Users/avspn/Desktop/projects/meme%20application/src/curate/CurateApp.tsx).
   - Buffered memes automatically preload image assets in browser memory (`new Image().src = meme.image_url`).
   - Every swipe or button click instantly transitions to the next meme (0ms perceived latency).
   - `POST /api/curate/approve` and `POST /api/curate/force-remove` run asynchronously in the background without locking buttons.
3. **Fully Functional `← PREV` & `NEXT →` Navigation**:
   - Implemented in-memory `historyStack` and `historyIndex` in [`src/curate/CurateApp.tsx`](file:///c:/Users/avspn/Desktop/projects/meme%20application/src/curate/CurateApp.tsx).
   - `← PREV` and `NEXT →` buttons (and `ArrowLeft` / `ArrowRight` keyboard shortcuts) instantly traverse previously reviewed memes with 0ms delay.
   - Backend `direction=prev` in [`functions/api/curate/next.ts`](file:///c:/Users/avspn/Desktop/projects/meme%20application/functions/api/curate/next.ts) fixed to accurately query reviewed memes from `meme_curation`.
4. **Reliable Real-Time Reviewed Count**:
   - Fixed count overwriting bug: local counter increments on every action and is no longer overwritten by stale cache data from `next.ts`.
5. **AI Advisor Exclude Styling (Desktop & Mobile)**:
   - When AI pre-judge advises `excluded`, the container borders (`#FF3B30`), glow shadow (`#FF3B30`), status badges, and Adopt CTA buttons render in vibrant `#FF3B30` red with white text across desktop single AI, consensus differing details, and mobile cards.
6. **Clean Mobile Quick Action Layout**:
   - Removed distracting and redundant `ADOPT J4` and `ADOPT J5` buttons from mobile view (gestures already handle them).
   - Upgraded `.curate-mobile-quick-actions` to a 2-column grid (`grid-template-columns: repeat(2, 1fr)`) with enlarged 54px touch targets for `[✏️ MANUAL OVERRIDE]` and `[🗑️ FORCE REMOVE]`.


   - The UI optimistically advances the judge's reviewed counter (`reviewed + 1`, `remaining - 1`), eliminating wait times and dropping per-swipe D1 reads from **~10,000 to ~2 rows (99.97% drop)**.
   - Increases daily curation capacity from **166 memes/day to over 25,000 memes/day** under Cloudflare's Free tier with 0 cost.

---

## 9. Admin Overhaul Phase 4 — Durable Bulk Intake (November 3, 2026)

- Migration `025_durable_meme_ingestion.sql` adds durable batch, item, and
  independent advisory-evaluation state without changing publication or human
  consensus tables.
- `/admin` Add Memes now supports image-only multi-select/drag-drop review,
  stable SHA-256 intake IDs, editable titles, duplicate warnings, bounded
  concurrency, persisted progress, and failed-item retry.
- New uploads create archived/inactive D1 metadata and cannot publish, activate,
  create a final keep, or create a human vote. Curation routes expose a new
  intake item only after both Judge 4 and Judge 5 evaluations reach `succeeded`
  and the job transitions to `human_ready`.
- The processor uses the existing encrypted `cat_judge_ai_presets` rows keyed by
  `judge4` and `judge5`; it remains advisory and never writes `meme_curation`.
- Local migration execution, schema PRAGMA checks, frontend build, ingestion
  tests, analytics tests, and consensus tests passed. Remote PRAGMA verification
  and production migration remain blocked by missing Cloudflare credentials.


---

## 10. Admin Overhaul Phase 5 — Meme Vault, Details Panel & Data Access (November 3, 2026)

- **Server-Side Data Access & Bounded Query Contracts**:
  - `GET /api/admin/memes` enhanced with parameterized SQL query parsing supporting `page`, `per_page` (clamped 1–100), `q` (searching across title, ID, category, and tags), `status` (`all`, `active`, `draft`, `archived`), `curation_status` (`all`, `keep`, `excluded`, `review_later`, `unreviewed`), `nsfw` (`all`, `safe`, `nsfw`), and whitelisted sorting (`uploaded_at`, `title`, `id`, `likes_count`).
  - Single-scan corpus statistics aggregation in D1 calculates global counts for `total`, `active`, `drafts`, `archived`, `excluded`, and `nsfw` without requiring the client to load or scan the entire corpus in memory.
  - Backward compatibility preserved: unbounded legacy requests without pagination parameters continue to return the full array as expected.
- **Five Approved Vault View Modes**:
  - Implemented the 5 view modes specified in the Master Implementation Plan:
    1. **Extra-Large Grid (`extra-large-grid`)**: Prominent 240px card previews with media focus and quick action bar.
    2. **Medium Grid (`medium-grid`)**: Balanced card grid (160px thumbs) with status badges and quick actions.
    3. **Compact Grid (`compact-grid`)**: High-density 110px square grid with badge overlays.
    4. **List (`list`)**: Single-line compact tabular rows with inline thumbnail, ID, title, and actions.
    5. **Detailed List (`detailed-list`)**: Expanded row cards featuring full metadata, tags, rarity, and action buttons.
  - View mode state persisted in `localStorage` under `mc_admin_vault_view_mode`.
- **Contextual Details Panel (Inspector)**:
  - Slide-out / docked inspector panel accessible on click of any meme in the vault.
  - Displays high-resolution preview, immutable Meme ID with one-click copy, lifecycle status, curation status, NSFW flag, category, rarity, likes, media type, and storage path.
  - Integrated quick actions: Edit Metadata, deep-link Re-Curate (`/curate#id=...`), Archive / Restore toggle, and permanent Hard Delete with confirmation dialog.
  - Multi-select mode displays a Bulk Actions summary showing count of selected items, bulk archive, and bulk hard delete.
- **Immutable Meme ID Enforcement**:
  - Server-side validation in `PATCH /api/admin/memes` rejects any modification where `meme.id !== originalId` with HTTP 400.
  - Admin edit form locks the Meme ID field (`readOnly` / `disabled`) when editing existing memes, preventing accidental ID tampering.
- **Transparent Hard Delete Reporting**:
  - `functions/api/admin/memes/hard-delete.ts` checks both `env.MEMES_BUCKET` and `env.R2_BUCKET` bindings and returns structured results reporting deleted count, affected IDs, and any per-item R2 deletion errors.
- **Verification**: `npm run test:vault` (5/5 tests passing), `npm run test:ingestion` (4/4 tests passing), `npm run test:analytics` (5/5 tests passing), `node --test tests/curationConsensus.test.mjs` (9/9 tests passing), and `npm run build` pass with 0 errors.

---

## 11. Phase 0.5 — Pre-Flight Verification & Advisory Boundary Security Fix (November 3, 2026)

- **Bug 1 Resolved (AI Loop Advisory Boundary Enforcement)**:
  - Verified that `useAiJudgeLoop` in `src/curate/CurateApp.tsx` was previously wired to `onAdvance: async (decision) => handleApproveAndAdvance("manual", undefined, decision)`, which caused background AI processing to submit votes through `/api/curate/approve` and forge human ballots under the logged-in curator's identity in `meme_curation`.
  - Severed the link: implemented `handleAiAdvisoryAdvance` via `aiAdvanceRef` which cleanly advances the queue pointer and buffers the next meme without ever calling `approveCuration`, `handleApproveAndAdvance`, or modifying `meme_curation`.
  - Human curators retain full ability to manually adopt AI recommendations via the explicit "ADOPT J4" (`4`) or "ADOPT J5" (`5`) actions.
- **Bug 2 Resolved (Local Migration 008 Bootstrap)**:
  - Verified that running `npx wrangler d1 migrations apply meme-capsule-db --local` failed at `008_optimize_curation_indexes.sql` with `SQLITE_ERROR: no such table: main.ai_curation_predictions`.
  - Resolved via new additive migration `007b_create_ai_curation_predictions.sql` (sorting immediately before `008` in Wrangler without editing historical migration `008`), creating `ai_curation_predictions` and `ai_cat_decisions` tables with `IF NOT EXISTS`.
  - Successfully executed local migration chain through `025_durable_meme_ingestion.sql`.
  - Physically verified the schema with `PRAGMA table_info(ingestion_batches)`, `PRAGMA table_info(ingestion_jobs)`, and `PRAGMA table_info(ingestion_ai_evaluations)`.
- **Git Coordination & Sync**:
  - Rebased cleanly over merged PR #51 (`1dc0845`) and pushed commit `4e35bfe` to `origin/main`.
- **Verification**: `npm run build` passed with zero errors; all 23 unit tests passed across `test:vault`, `test:ingestion`, `test:analytics`, and `curationConsensus`.

---

## 12. Admin Overhaul Phase 6 & Phase 7 — Human-Judge Image Editor & End-to-End Verification (November 3, 2026)

- **Phase 6: Human-Judge Image Editor (`/curate`)**:
  - Implemented client-side Neo-Brutalist Image Editor for human judges (Judges 1–3 and SuperAdmin) with tools for:
    - Region-specific in-place Mosaic/Pixelation (`applyMosaicToImageData`) with true cell-averaged pixel downsampling.
    - Region-specific in-place 1D separable box blur (`applyBlurToImageData`) with true canvas pixel modification.
    - Source-resolution crop and 90°/180°/270° rotations (`calculateTransformedDimensions`).
    - Freehand drawing brush with configurable stroke color palette and brush width slider.
    - Geometric shapes (rectangles, ellipses) with configurable stroke color and thickness.
    - Text overlay with high-contrast font and positioning.
    - Full undo/redo history stack for all drawing and annotation operations.
    - Live export preview dialog displaying modified image dimensions and file size.
  - Offscreen Canvas rendering engine (`exportCanvas.ts`): renders source image at native full-resolution, applies crop/rotation, paints blur/mosaic layers directly onto ImageData, composites Konva stage vector layers, and outputs high-fidelity WebP/PNG Blob without display-scaling blur or quality degradation.
  - UI Integration in `src/curate/CurateApp.tsx`:
    - Responsive accessibility: `[🎨 EDIT IMAGE]` CTA button integrated into both the desktop curator actions strip and the mobile quick-action bar.
    - Global keyboard shortcut: pressing `E` / `e` opens the editor directly for the currently inspected meme.
    - Code splitting: Dynamic `React.lazy` loading ensures `konva` and `react-konva` (360 kB) are only loaded on-demand when the editor is opened.
  - Backend CAS Protocol (`functions/api/curate/media/edit.ts`):
    - Strict authorization: Authenticates session and permits only human judges or superadmins; explicitly rejects advisory AI judges (`judge4`, `judge5`) with HTTP 403.
    - Compare-and-Swap (CAS) revision check: Validates `expected_storage_path` against current D1 `memes.storage_path`. If stale or concurrently modified, rejects with HTTP 409 Conflict.
    - Uploads edited media under unique key (`memes/edited-${memeId}-${timestamp}-${uuid}.${ext}`).
    - Updates `memes` pointer atomically: `UPDATE memes SET storage_path = ?, image_url = ?, updated_at = ... WHERE id = ? AND storage_path = ?`.
    - If atomic update changes 0 rows, rolls back the uploaded R2 object and returns 409.
    - Audit logging: Logs edit history into `media_operations` (`id`, `meme_id`, `actor_id`, `actor_name`, `old_storage_path`, `new_storage_path`, `operation_type`, `created_at`).
    - Recovers old storage objects safely without breaking active sessions.
  - **Same-Origin Media Proxy (`functions/api/curate/media/proxy.ts`)**:
    - Resolves browser CORS restrictions when fetching remote R2 / custom-domain media for canvas pixel manipulation (`getImageData`, `toBlob`).
    - Multi-tier loader in `ImageEditorModal.tsx` fetches through the same-origin proxy (reading directly from `env.MEMES_BUCKET` or edge upstream fetch), converts to local `Blob` / `objectURL`, and draws to canvas without canvas tainting.
- **Phase 7: End-to-End Verification & Rollout**:
  - Full automated test suite passing (27/27 tests across 5 test suites):
    - `npm run test:editor` (4/4 tests): tests mosaic pixelation, box blur convolution, source rotation/crop coordinate transforms, and out-of-bounds safety.
    - `npm run test:vault` (5/5 tests): tests vault view modes, pagination clamping, and filter predicates.
    - `npm run test:ingestion` (4/4 tests): tests batch creation, upload concurrency, duplicate warnings, and job states.
    - `npm run test:analytics` (5/5 tests): tests ingestion analytics, queue depth, and metrics aggregation.
    - `node --test tests/curationConsensus.test.mjs` (9/9 tests): verifies 3-human consensus rules, advisory AI Judge 4/5 fallbacks, arbitration splits, and duplicate reconciliation.
  - Production build: `tsc && vite build` succeeded with zero TypeScript errors and bundle chunks properly code-split (`ImageEditorModal-COG5_ldu.js` 360 kB).
  - Ingestion & Add Memes Status:
    - Local D1 schema verified against migration `025_durable_meme_ingestion.sql` (`ingestion_batches`, `ingestion_jobs`, `ingestion_ai_evaluations`).
    - Live Cloudflare Pages production environment gracefully returns 503 on ingestion endpoints due to `hasIngestionSchema` safety guard pending production `wrangler d1 migrations apply meme-capsule-db --remote` execution with user Cloudflare credentials.

---

## 13. Admin Overhaul Phase 1 Corrections, Telemetry & Drive Intake Automation (November 4, 2026)

- **Archived-at-Intake Fix**:
  - `functions/api/admin/ingestion/upload.ts`: Changed initial intake insertion from `status = 'archived'` to `status = 'draft'`. Newly uploaded records remain drafts with `is_active = 0` and `curation_status = NULL`.
  - `functions/api/admin/ingestion/process.ts`: Promotes meme record to `status = 'archived'` ONLY when both AI Judge 4 and Judge 5 advisory evaluations succeed (`allSucceeded = true`). Failed or unreviewed batches never appear under the Vault's "Archived" filter.
- **Legacy Upload Portal Removal (`src/admin/AdminApp.tsx`)**:
  - `Add Memes` tab: Rendered strictly with `BulkIngestionWorkspace` full-width; subordinate single-item upload portal removed.
  - `Meme Vault` tab: Removed legacy creation portal (`<label>Media Asset</label>`, `DROP FILE HERE`, `Media URL` inputs) from right pane. When not editing a meme (`!editingOriginalId`), Vault operates in full width. When editing an existing meme (`editingOriginalId`), right pane renders an "Edit Meme" metadata editor with a read-only preview of the current canonical media.
- **Client-Side Real-Time Upload Telemetry**:
  - `src/lib/adminApi.ts`: Updated `uploadIngestionItem` using `XMLHttpRequest.upload.onprogress` to emit progress events.
  - `src/admin/BulkIngestionWorkspace.tsx`: Real-time telemetry bar tracks upload speed (`MB/s` or `KB/s`), cumulative bandwidth transferred (`MB/total MB`), and dynamic Estimated Time Remaining (`ETA`).
- **D1 R2 Space Utilization Running Total**:
  - Evaluates total uploaded storage size from D1 `ingestion_jobs` (`upload_state = 'uploaded'`) in `functions/_shared/ingestion.ts` (`getBatchStatus`).
  - Displays persistent R2 storage usage badge in the Bulk Intake limits strip.
- **Phase 1.5: Automated Google Drive Intake**:
  - `functions/_shared/googleDriveAuth.ts`: Pure Web Crypto RSASSA-PKCS1-v1_5 JWT signing for Google Drive API v3 OAuth2 token exchange with `https://www.googleapis.com/auth/drive.readonly` scope.
  - `functions/api/admin/ingestion/drive-cron.ts`: Incremental scheduled intake endpoint for Cloudflare Cron Triggers (`[triggers] crons = ["*/15 * * * *"]`). Polls `GOOGLE_DRIVE_FOLDER_ID`, deduplicates via `gdrive-{file.id}`, streams into R2, and registers intake batches/jobs. Dispatches persistent admin alerts on auth failure.
- **Verification & Status**:
  - All 27 automated tests passing across `test:editor`, `test:vault`, `test:ingestion`, `test:analytics`, and `curationConsensus`.
  - `npm run build` compiled 1,713 modules cleanly with zero errors.

---

## 14. Admin Overhaul: Decoupled Intake, Resizable Meme Vault & Google Drive Multi-Bot Quarantine Relocation (November 4, 2026)

- **1. Decoupled Fast Ingestion Pipeline (`BulkIngestionWorkspace.tsx`, `batches.ts`, `ingestion.ts`)**:
  - **Capacity Expansion**: Raised limits to 1,000 items and 2,000 MiB (2 GB) total batch payload.
  - **D1 Parameter & Statement Chunking**: Added `chunkArray(..., 50)` lookups and `STATEMENT_CHUNK_SIZE = 40` execution chunking to prevent SQLite parameter limits.
  - **Decoupled Two-Stage Ingestion**: Separated R2 uploads from AI evaluations.
    - Stage 1 (Fast Uploads): Runs with `UPLOAD_CONCURRENCY = 6`, immediately streaming images to R2 and creating private D1 rows with `status='draft'`.
    - Stage 2 (Background Advisory AI): Runs with `AI_CONCURRENCY = 3` in the background without blocking upload completion.
  - **Smoothed Real-Time Telemetry**: Real-time upload speed and ETA computed with Exponential Moving Average (EMA) to prevent jumpy estimates.
  - **Concurrent Web Hashing**: Browser `crypto.subtle` SHA-256 operations executed concurrently across CPU threads via `Promise.all`.
  - **Durable Batch Purge**: Added `deleteIngestionBatch` endpoint (`DELETE /api/admin/ingestion/batches?id=...`) and `[🗑️ Purge Batch]` UI button to safely purge failed or abandoned batches and uncurated draft rows.

- **2. Meme Vault Redesign & Instant In-Panel Curation Dashboard (`AdminApp.tsx`, `admin.css`)**:
  - **Relocated Details Panel**: Removed misplaced inspector from bottom of the left list; relocated into a dedicated right-side resizable drawer.
  - **Draggable Splitter Handle**: Added vertical `.vault-splitter-handle` (`cursor: col-resize`) on the left edge of the details panel. Width adjusts fluidly from 320px to 750px and persists across sessions via `localStorage` (`mc_admin_vault_panel_width`). Responsive drawer on mobile/tablet (<1024px).
  - **Instant In-Panel Curation Dashboard**:
    - `[🔞 NSFW / SAFE]` quick button: Toggles persisted NSFW moderation flag via `POST /api/curate/nsfw`, updating D1 and local UI state immediately.
    - `[🗑️ FORCE REMOVE]` quick button: Permanently removes meme via `POST /api/curate/force-remove` with admin bearer auth; physically deletes media from R2 bucket, sets `is_active=0`, writes `meme_force_removals` audit record, and updates UI collections immediately.
    - `[🎨 EDIT IMAGE]` quick button: Launches `ImageEditorModal` canvas editor directly from the panel, supporting crop, blur, mosaic, and text modifications.
    - **Layer 0 — Editorial Action**: `[KEEP]`, `[EXCLUDED]`, `[DUPLICATE]`, `[REVIEW LATER]` buttons with duplicate target input.
    - **Layers 1–3 Taxonomy**: Topic pills (`CURATION_TOPICS`, max 3), Dominant Tone pills (`CURATION_TONES`, 1 tone), Humour Mechanism pills (`CURATION_MECHANISMS`, max 2).
    - **Curator Notes**: Direct textarea input.
    - **Database Commit**: `[💾 Commit Curation to Database]` button commits curation decisions directly to D1 via `POST /api/curate/save` without leaving the Vault.
  - **Rarity Check Constraint Fix**: Removed invalid `<option value="Mythic">Mythic</option>` to match D1 schema `CHECK (rarity IN ('Common', 'Rare', 'Legendary'))`.
  - **Purged Legacy Form Residuals**: Obsolete single-item intake form completely eliminated from Meme Vault.

- **3. Google Drive Multi-Bot Script Team with 2-Folder Quarantine Relocation (`drive-cron.ts`, `googleDriveAuth.ts`)**:
  - **Drive Scope Expansion**: Expanded Google OAuth2 service account scope to `https://www.googleapis.com/auth/drive` to allow folder creation and file relocation.
  - **`driveFolderResolverBot`**: Ensures the root folder exists, then finds or automatically creates an `_Uploaded_Memes` subfolder inside the root.
  - **`driveFetcherBot`**: Scans the root directory for image files, ignoring subfolders.
  - **`dedupSecurityBot`**: Extracts filename shortcodes via regex `/(?:\[|\b)([A-Z0-9_-]{4,16})(?:\]|\b)/i` and checks D1 (`memes` and `ingestion_jobs`) before downloading any bytes (zero egress cost).
  - **`ingestionUploaderBot`**: Validates MIME/bytes, computes SHA-256 hash, uploads to R2, and registers D1 draft rows.
  - **`driveRelocatorBot`**: Moves completed files from root to `_Uploaded_Memes` via Drive API `addParents`/`removeParents`.
  - **Inviolable Safety Rule**: Any file that fails processing is NEVER recorded in D1 and NEVER moved to `_Uploaded_Memes`. It remains untouched in the root directory for human review, and detailed error logs with ISO timestamps are recorded.

- **4. Verification & Status**:
  - All 27 automated tests passing:
    - `npm run test:vault` (5 tests passing)
    - `npm run test:ingestion` (4 tests passing)
    - `npm run test:editor` (4 tests passing)
    - `npm run test:analytics` (5 tests passing)
    - `node --test tests/curationConsensus.test.mjs` (9 tests passing)
  - Production build: `tsc && vite build` compiled 1,713 modules in 15s with code-split `ImageEditorModal` and zero errors.

---

## 15. Bulk Ingestion Scaling, Multi-Format HEIC Support & UI Layout Overhaul (November 4, 2026)

- **1. SQLite Parameter Limit Fix (`functions/_shared/ingestion.ts`, `functions/api/admin/ingestion/batches.ts`)**:
  - **The Bug**: When creating or reading batches with 100+ items (e.g. 190 items), `getBatchStatus` built `SELECT * FROM ingestion_ai_evaluations WHERE job_id IN (?, ?, ...)` binding 190 parameters, exceeding Cloudflare D1's limit of 100 bound parameters per query and crashing with `D1_ERROR: too many SQL variables at offset 256: SQLITE_ERROR`.
  - **The Fix**: Replaced unbounded `IN (${placeholders})` list with a single-parameter indexed JOIN:
    ```sql
    SELECT e.*
    FROM ingestion_ai_evaluations e
    JOIN ingestion_jobs j ON e.job_id = j.job_id
    WHERE j.batch_id = ?
    ORDER BY e.judge_key ASC
    ```
  - Bounded statement chunk sizes to `STATEMENT_CHUNK_SIZE = 25` in `batches.ts` to ensure multi-statement D1 transactions remain strictly within engine parameter limits.

- **2. Universal Modern Image Format Support (`src/admin/bulkIngestion.ts`, `functions/_shared/ingestion.ts`, `functions/api/admin/ingestion/upload.ts`)**:
  - Added full support for **HEIC / HEIF** (`image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence`), as well as BMP (`image/bmp`).
  - **Client-Side Magic Byte Sniffing**: Implemented `sniffImageMime` in `bulkIngestion.ts` reading header bytes (0-32). If a browser reports `application/octet-stream` or an empty MIME type (common on Windows/Chrome for mobile photos and Instagram/WhatsApp exports like `t51.82787-15_...`), the system inspects magic bytes (e.g. `ftypheic`, `ftypmif1`, `ftypmsf1`, `\xFF\xD8\xFF`, `\x89PNG`) and assigns the genuine MIME type before validation, eliminating false rejection errors.
  - **Server-Side Compatibility**: Updated `detectImageMime` in `functions/_shared/ingestion.ts` to sniff HEIC/HEIF brands (`heic`, `heix`, `hevc`, `hevx`, `mif1`, `msf1`) and BMP (`BM`). Normalized MIME variants (`image/heif` ↔ `image/heic`, `image/jpg` ↔ `image/jpeg`) in `upload.ts` so compatible formats match smoothly.

- **3. Review Table Layout Overhaul & Anti-Overlap Isolation (`src/admin/admin.css`, `src/admin/BulkIngestionWorkspace.tsx`)**:
  - **The Bug**: Long unbroken filenames (e.g. Instagram CDN hashes) expanded flex children without `min-width: 0`, forcing the filename text past its column track and causing the Title input box to visually overlap and obscure the filename.
  - **The Fix**:
    - Wrapped filename and hash in a dedicated flex column `.bulk-file-cell-info` with `min-width: 0; flex: 1 1 auto; overflow: hidden;`.
    - Set `display: block; min-width: 0; width: 100%;` on `.bulk-title-cell` and its child input.
    - Added strict text truncation (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`) with full tooltip inspection on hover (`title={item.fileName}`).
    - Expanded CSS grid column tracks to `minmax(280px, 1.8fr) minmax(220px, 1.4fr) minmax(120px, 0.8fr) minmax(260px, 1.6fr) 80px` with a minimum table width of `980px` inside a horizontal scroll container (`overflow-x: auto;`), guaranteeing ample space for each column without compression or collision.

- **4. Browser Preview Fallback for Non-Native Formats (`src/admin/BulkIngestionWorkspace.tsx`)**:
  - Added `onError` fallback on preview images with a `brokenPreviews` state tracker.
  - Formats without native browser `<img>` decoding (such as HEIC in Chrome on Windows) render a stylized, high-contrast Neo-Brutalist format badge (`HEIC`) instead of a broken browser icon.

- **5. Strict Decoupling of Upload Completion vs AI Curation**:
  - Upload status shows `✓ UPLOADED (DRAFT)` in emerald green once media is confirmed in R2 and D1.
  - Background advisory evaluation for AI Judges 4 & 5 runs downstream without turning upload badges red or blocking batch completion.

- **6. Verification & Automated Tests**:
  - Extended `tests/bulkIngestion.test.ts` to 6 comprehensive tests, verifying HEIC/HEIF acceptance, magic byte sniffing across PNG, JPEG, GIF, WebP, AVIF, HEIC, HEIF, and recovery from `application/octet-stream`.
  - All automated test suites passing:
    - `npm run test:ingestion` (6 tests passing)
    - `npm run test:vault` (5 tests passing)
    - `npm run test:editor` (4 tests passing)
    - `npm run test:analytics` (5 tests passing)
  - Production build: `tsc && vite build` compiled 1,713 modules cleanly in 10.28s.

---

## 16. Total Intake Purge Fix, Zero-Collision Idempotency Keys & Stale Batch Cleanup (November 5, 2026)

- **1. Total Database & Storage Purge Overhaul (`functions/api/admin/ingestion/batches.ts`)**:
  - **The Root Cause**: In Cloudflare D1 serverless sessions, SQLite's `PRAGMA foreign_keys = ON;` is not active by default. Previously, calling `DELETE FROM ingestion_batches WHERE id = ?` only deleted the single row in `ingestion_batches`; it **never cascaded** to delete `ingestion_jobs` or `ingestion_ai_evaluations`. These abandoned jobs remained permanently trapped in D1 with their original `idempotency_key` and `meme_id` intact.
  - **The Fix**: `onRequestDelete` now explicitly executes complete, ordered cascade deletions across:
    1. Uncurated draft records in `memes` (`status = 'draft' AND is_active = 0`).
    2. Physical R2 media objects in `MEMES_BUCKET`.
    3. `ingestion_ai_evaluations` records (`WHERE job_id IN (SELECT job_id FROM ingestion_jobs WHERE batch_id = ?)`).
    4. `ingestion_jobs` records (`WHERE batch_id = ?`).
    5. `ingestion_batches` records (`WHERE id = ?`).
  - Added support for `id=all_stale` to clean up any historical orphaned jobs or abandoned test sessions across the entire D1 database in one atomic admin sweep.

- **2. Tri-Tier Idempotency Collision Elimination (Options 1 + 2 + 3 Implemented)**:
  - **Option 1 (Client Scoping)**: In `src/admin/bulkIngestion.ts`, `createBulkDraftItem` assigns batch-scoped unique identifiers (`clientItemId: item-${contentHash.slice(0, 20)}-${randomSuffix.slice(0, 8)}` and `memeId: intake-${randomSuffix}`), while strictly preserving `contentHash` for SHA-256 duplicate detection.
  - **Option 2 (Backend Auto-Scoping Defense)**: In `functions/api/admin/ingestion/batches.ts`, `onRequestPost` checks if any submitted `idempotencyKey` or `memeId` is already in D1. If found, instead of blocking the entire batch with a `409 Conflict`, it automatically namespaces the key to the current `batchId` (`${batchId.slice(0, 10)}-${item.idempotencyKey}`) and assigns a fresh intake ID. Duplicate files are still accurately recorded in D1 as `duplicate_of_job_id` and flagged in the review table.
  - **Option 3 (UI Admin Purge Control)**: Added a visible `[🧹 Wipe Stale Intake]` button in `BulkIngestionWorkspace.tsx` alongside `[Start Fresh Batch]`, allowing admins to instantly clean up all stale/abandoned intake sessions from D1 and R2 at any time.

- **3. Verification & Automated Tests**:
  - `tests/bulkIngestion.test.ts` updated with 7 automated tests, verifying unique batch scoping across identical content files.
  - All test suites passing (`test:ingestion`, `test:vault`, `test:editor`, `test:analytics`).
  - Production build: `tsc && vite build` compiled 1,713 modules in 11.51s with zero errors.





