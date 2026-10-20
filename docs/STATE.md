---
project: Meme Capsule — Serverless Edge Backend & Curation Engine
status: production
current_phase: Production Operations, Multi-Judge Consensus & Scaling
architecture: Cloudflare Pages + Functions + D1 (SQLite) + R2 Media CDN
deployed_url: https://meme-capsule-eww.pages.dev
mobile_companion_app: com.meme.capsule (v3.3 / versionCode 24) on Google Play
web_companion_platform: https://memecapsule.wtf
updated: 2026-10-13
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
- **Admin Collection & Database APIs (`functions/api/admin/`)**:
  - `/api/admin/memes`: Prepared-statement D1 CRUD for meme metadata.
  - `/api/admin/upload`: Multi-part media upload streaming directly to Cloudflare R2 bucket.
  - `/api/admin/sync-r2`: Two-way reconciliation scanning R2 bucket objects into D1 rows.
  - `/api/admin/sql`: Token-protected raw SQL console execution engine with safety guards.
  - `/api/admin/memes/hard-delete`: Destructive cleanup endpoint for removing invalid records.
  - `/api/admin/analytics/*`: Ranking recalculation, trend analysis, overview metrics, and algorithm reset challenges.
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
The database `meme-capsule-db` (SQLite at the edge) operates under 14 sequential migrations:
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

### C. Cloudflare R2 Media Storage
- Bucket `memes` configured with public access enabled.
- Zero egress fees for high-volume WebP image and MP4/GIF delivery.
- Media synchronization engine in `/admin` ensuring D1 metadata matches physical R2 storage objects.

- **`/curate`**: Multi-judge consensus curation dashboard with keyboard shortcuts (`K`, `X`, `D`, `R`), fast-approval of AI Consensus (`Space`/`Enter`), instant single-AI adoption, three-human majority finalization (`POST /api/curate/approve`) with arbitration on unresolved outcomes, destructive Force Remove (`Shift+Delete` / `POST /api/curate/force-remove`), Superadmin dashboard view with force removal audit, judge account management, judge-isolated AI presets, and CSV/JSON export. Deeply integrates the **AI-Judgement Review Workflow** with AI Judges 4 and 5.
  - **Mobile Curation Experience (<768px)**: Seamless, touch-first responsive curation preserving desktop experience pixel-for-pixel:
    - **Touch Gesture Engine**: Swipe Right to adopt AI Judge 4, Swipe Left to adopt AI Judge 5, Double-Tap to trigger Force Remove modal (with haptic vibration), and Swipe Up to enter Manual Override.
    - **Server-Confirmed Advancement**: Card transitions only execute after successful `POST /api/curate/approve` response, snapping back with an error toast on network failure.
    - **Dynamic Aspect Ratio**: Cards render at natural image dimensions with a safe viewport cap instead of desktop fixed 68vh boxes.
    - **Compact AI Preview Strip**: Displays consensus verdicts and directional hints above the meme stage.
    - **Role-Based AI Console Gating**: Continuous AI Judge Console is hidden from human judges (1–3) on all viewports, visible to judge4/5 operators on desktop only.
    - **Quick Action Bar & Gesture Footer**: Complete touch alternatives for non-gesture accessibility.
- **`/admin`**: Administration console with D1 SQL console, R2 media sync, 5-metric status bar, CSV/Excel export, analytics algorithm tuning, and dark mode.
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


