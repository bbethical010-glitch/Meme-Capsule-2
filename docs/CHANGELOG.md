# Changelog

## 2026-10-13

- **Single-Judge Adoption & Authoritative Finality**: Added `POST /api/curate/approve` allowing human curators to finalize decisions directly into `meme_curation_final` and update `memes` atomically, bypassing SuperAdmin arbitration for approved workflows.
- **Dual Hotkey Force Remove**: Added direct purge via `Shift+Delete` (`POST /api/curate/force-remove`) in `/curate` alongside the modal reason workflow (`Shift+X`).
- **Cross-Codebase Knowledge Sync Architecture**: Established standardized `.knowledge/` sync tooling (`fetch-knowledge` and `update-knowledge` in both PowerShell and Bash) targeting `editorav010-dev/meme-capsule-sync` with metadata tracking in `.knowledge/.knowledge_meta.json`.
- **Database & State Documentation Sync**: Updated migration catalog to 14 total migrations (including `011_force_removals.sql` and `meme_force_removals` table schema).

## 2026-10-09

- Added **Force Remove** feature across `/curate` and `/categorise` portals:
  - Enabled judge/superadmin irreversible deletion (`POST /api/cat/force-remove`) with immediate D1 deactivation (`is_active = 0, status = 'archived'`), audit logging in `meme_force_removals`, and physical R2 media object deletion.
  - Added Neo-Brutalist stage button `⚡ FORCE REMOVE [SHIFT+X]`, Layer 0 action button, global `Shift+X` keyboard shortcut, thumbnail preview confirmation modal, toast feedback, and auto-advance.
  - Added `⚡ FORCE REMOVAL AUDIT` dashboard tab in `/curate` SuperAdmin view with 1-click R2 deletion retry.
  - Added `410 Gone` guard in `/api/curate/save` for force-removed items.
  - **Fixed 171-meme queue collapse regression**: Removed incorrect `is_active = 1` filter in `/api/curate/next`, `/api/curate/list`, `/api/curate/stats`, and superadmin endpoints, restoring the entire 5,000+ unreviewed meme backlog while cleanly excluding `meme_force_removals`.
  - Created architectural context document `docs/FORCE_REMOVE_FEATURE.md`.

## 2026-09-28

- Completed full documentation audit & repository reorganization: all markdown files centralized into `/docs`.
- Synchronized `docs/STATE.md` with true production edge state (Cloudflare Pages, D1 with 13 migrations, R2 CDN, 5 internal workbenches).
- Reconfigured `fetch-knowledge.ps1` and `update-knowledge.ps1` to directly target `docs/MEME_CAPSULE_KNOWLEDGE.md`, eliminating duplicate root/nested markdown files.
- Added public `/api/contact` endpoint in Cloudflare Pages Functions for website contact form submissions.
- Consolidated multi-judge consensus curation, SuperAdmin resolution, AI judge vision loop, and AES-GCM-256 API key encryption across documentation.

## 2026-09-24

- Implemented 3-tier meme partitioning architecture in D1 via Migration 012 (`curation_status` column: `active`, `excluded`, `backlog`).
- Synchronized SuperAdmin Authoritative Resolved with Admin Active counts and live D1 database state.
- Purged removed judge accounts and enforced strict SuperAdmin session validation.

## 2026-05-24

- Verified and documented real-time meme likes feature backend architecture.
- Simplified Admin UI by making collection rows clickable (no need to click 'Edit').
- Added `likes_count` input editor inside the Admin UI edit form.

## 2026-05-04

- Backend migration: Phase 2 redirected from Supabase to Cloudflare R2 + D1.
- Rationale: zero egress bandwidth fees, native Cloudflare bindings, no external vendor dependency.
- Created `PROJECT_STRUCTURE.md` with full directory map and component interaction docs.
- Created `.planning/phases/02-cloudflare-r2-d1-backend/02-PLAN.md` with 8 migration tasks.
- Updated `ROADMAP.md`, `STATE.md`, `DATABASE.md`, and `README.md` to reflect R2+D1 backend.

## 2026-05-02

- Removed the duplicate public `Again` button.
- Renamed the single repeat CTA to `Spawn Another` after a meme is visible.
- Clarified `Daily Drop` as a separate daily curated pick, not a second random action.
- Added `/admin` dashboard for local content management.
- Added admin support for direct URLs, Google Drive links, local file upload previews, editing, deleting, and JSON export.
- Added local admin collection sync for same-browser public app testing.
- Expanded meme metadata types with title, source link, status, media type, and input method.
- Updated Supabase schema to support admin metadata and active/draft/archived status.
- Added `DATABASE.md` to document current and future storage architecture.
- Fixed save/download behavior so memes preserve their original file extension when possible instead of always downloading as `.svg`.
- Fixed public meme display and admin preview rendering so real meme aspect ratios are preserved instead of forced into square crops.
- Started Phase 2 backend work by adding admin Supabase API routes for list/create/update/archive.
- Added Supabase Storage upload API for admin image/video uploads.
- Added backend mode to `/admin` using a session-entered `ADMIN_API_TOKEN`.
- Added `.dev.vars.example` for local Cloudflare/Supabase environment setup.
- Disabled production sourcemaps to keep Cloudflare Pages uploads smaller and reduce deploy upload failures.
