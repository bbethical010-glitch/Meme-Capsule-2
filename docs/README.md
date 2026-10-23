# Meme Capsule — Ultimate Minimalist Meme PWA

A high-performance, minimalist curated meme platform built with **Vite + React + TypeScript** and powered by **Cloudflare R2 + D1**.

**GitHub Repo:** [https://github.com/editorav010-dev/Meme-Capsule](https://github.com/editorav010-dev/Meme-Capsule)

## Development Team & Engineering Division

Meme Capsule is a collaborative project developed by three individuals with distinct and complementary ownership areas:

- **Anmol Verma** (Lead Backend Developer — GitHub: [`editorav010-dev`](https://github.com/editorav010-dev)):
  Full backend engineering, Cloudflare serverless architecture, core algorithms, AI tools implementation, security, curation pipelines, and all internal backend workbenches (/admin, /curate, /reports, /ai-judge).

- **Pratham Pandey** (Lead Frontend Developer & Original Ideator — GitHub: [`bbethical010-glitch`](https://github.com/bbethical010-glitch)):
  Original concept and founding idea behind Meme Capsule. Leads frontend landing pages, Android APK development (com.meme.capsule), app theme and typography, UI/UX, Java Android bridge, MediaStore integrations, and consumer-facing client setup.

- **Faraz Ahmed** (Social Media & Marketing Lead):
  Manages all official social media handles, content planning, niche analysis, scripting, quality control, and marketing campaigns.

**Official App Email (User Support & Marketing):** `support@memecapsule.wtf`

**Official Social Media:**
- Instagram: https://www.instagram.com/capsule.meme/
- X: https://x.com/memecapsule_
- Threads: https://www.threads.com/@capsule.meme

## Ecosystem Overview: Three Decoupled Codebases

Meme Capsule operates across three decoupled codebases:
1. **Public Android Mobile Application (`com.meme.capsule`)**: Maintained in a companion Android repository. Features Capacitor 8 Android app, `HIT ME` single-item drops, 7-meme FIFO prefetch buffer, native Android Scoped MediaStore image saving, Mood Boards, Meme Vault, AdMob monetization, and Google Play In-App Purchases.
2. **Promotional, Press & Web Platform (`memecapsule.wtf`)**: Multi-page, statically prerendered web platform featuring live interactive drop preview simulator, 3D device mockups, Section 04.5 Under the Hood technical transparency, Press Kit, and Google AdSense (`meme1`).
3. **Developer / Serverless Edge Backend (This Repository)**: Deployed on Cloudflare Pages (`https://meme-capsule-eww.pages.dev`). Serves the serverless API (`functions/api/`), Cloudflare D1/R2 storage, and the internal Neo-Brutalist workbenches (`/curate`, `/admin`, `/reports`, `/ai-judge`, `/categorise`). The discontinued legacy root landing UI has been completely removed.

## Core Documentation Index (All Documentation Lives in `/docs`)

- [`STATE.md`](./STATE.md) — Current implementation snapshot, active production status, and live endpoints.
- [`AGENT_RULES.md`](./AGENT_RULES.md) — Mandatory operating guidelines, protected areas, and testing protocols.
- [`MEME_CAPSULE_KNOWLEDGE.md`](./MEME_CAPSULE_KNOWLEDGE.md) — Master product & technical specification, core product FAQs, and multi-codebase architecture.
- [`PRIVACY_COOKIES_AND_DATA_FLOWS.md`](./PRIVACY_COOKIES_AND_DATA_FLOWS.md) — Exhaustive audit of website cookies, Formspree contact form, GA4 telemetry, AdMob integration, and Google Play Data Safety declarations.
- [`DATABASE.md`](./DATABASE.md) — Cloudflare D1 SQLite database schemas, 14 migrations, and R2 media bucket architecture.
- [`majority-consensus-curation-walkthrough.md`](./majority-consensus-curation-walkthrough.md) — detailed walkthrough of the three-judge consensus implementation, architecture diagrams, changed-file inventory, and acceptance evidence.
- [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — Detailed directory mapping, route mappings, and component hierarchy.
- [`README_ANALYTICS.md`](./README_ANALYTICS.md) — Analytics tracking SDK, ingestion API, and worker aggregation pipeline.
- [`report.md`](./report.md) — Google Lighthouse audit analysis, Core Web Vitals, accessibility, and backend caching remediation report.
- [`CHANGELOG.md`](./CHANGELOG.md) — Release history and migration milestones.
- [`CLAUDE.md`](./CLAUDE.md) — Local development, Wrangler commands, and environment settings.
- [`AGENTS.md`](./AGENTS.md) — AI agent workflow summary.
- [`GEMINI.md`](./GEMINI.md) — Project context for Gemini models.
- [`planning/`](./planning/) — Architecture planning documents, roadmaps, and specifications.
- [`scripts/`](./scripts/) — Setup and utility guide documentation.

## What Is Implemented In This Repository

- **Curation & Categorization Engine (`/curate`, `/categorise`)**:
  - Multi-judge consensus system with token authentication (`cat_users`).
  - Layer 0 editorial keyboard shortcuts (`K` keep, `E` exclude, `D` duplicate, `L` review later).
  - Three-human majority consensus (`POST /api/curate/approve`) with blind independent votes, 2:1/3:0 finalization, and SuperAdmin arbitration for unresolved splits.
  - Permanent Force Remove hotkeys (`Shift+Delete` instant purge, `Shift+X` modal with reason) purging D1 metadata, R2 objects, and logging to `meme_force_removals`.
  - Multi-topic taxonomy tagging, tone labeling, and humour mechanism tagging.
  - Superadmin resolution dashboard for arbitrating conflicting judge votes.
- **AI Pre-Judge Assisted Loop (`/ai-judge`)**:
  - LLM-assisted batch evaluation of unreviewed memes.
  - Automatic confidence-scored recommendation generation for human approval.
- **Admin Dashboard (`/admin`)**:
  - Cloudflare D1 database management and R2 storage sync.
  - Raw SQL query runner with safe execution guards.
  - Event telemetry recalculation engine and CSV/Excel exports.
- **Moderation Dashboard (`/reports`)**:
  - Token-protected review interface for user-reported content.
  - One-click meme archiving and addition to `content_blacklist`.
- **Edge Serverless API (`functions/api/`)**:
  - `GET /api/random-meme` & `GET /api/daily-meme` (dual-source delivery with fallback).
  - `POST /api/events` (telemetry queue flusher).
  - `POST /api/report` (user safety reporting).
  - Admin analytics endpoints (`/api/admin/analytics/*`).

## Admin Dashboard

Open:

```text
http://127.0.0.1:5173/admin
```

The admin dashboard supports:

- `Add Meme to Collection`
- `View Meme Collection`
- `Edit Meme Details`
- `Delete Meme`
- Direct URL input
- Google Drive link input
- Local image/video upload for draft preview
- Exporting the local collection as JSON

Important: the current admin dashboard stores collection drafts in browser `localStorage`. Active local admin memes are used by the public app in the same browser for testing. This is intentionally a zero-cost Phase 1.5 workflow, not the final production storage layer.

For production, `/admin` connects to Cloudflare Pages Functions backed by R2 (file storage) and D1 (meme metadata database) as described in [DATABASE.md](./DATABASE.md).

Backend mode requires this server-side environment variable:

- `ADMIN_API_TOKEN`

D1 and R2 are accessed via native Cloudflare bindings defined in `wrangler.toml` — no additional URL or key variables needed.

Admin backend routes:

- `GET /api/admin/memes` - list all meme records
- `POST /api/admin/memes` - create meme metadata
- `PATCH /api/admin/memes` - update meme metadata, including safe ID edits
- `DELETE /api/admin/memes` - archive a meme by setting `status = archived` and `is_active = 0`
- `POST /api/admin/upload` - upload image/video files to R2

The admin token is not bundled into the frontend. Type it into the `/admin` backend panel when you want to manage R2/D1 content.

## Run Locally

```bash
npm.cmd install
npm.cmd run dev
```

Open the printed localhost URL.

To open the admin dashboard, go to `/admin` on the same local server.

To test with D1 + R2 bindings locally:

```bash
npx wrangler pages dev dist
```

## Build

```bash
npm.cmd run build
```

## Deploy To Cloudflare Pages

Build command:

```bash
npm.cmd run build
```

Build output directory:

```text
dist
```

Add the admin token in Cloudflare Pages environment settings:

- `ADMIN_API_TOKEN`

D1 database and R2 bucket bindings are configured in `wrangler.toml` and applied automatically during deployment.

## Current Storage Reality

Right now there are three storage layers:

1. Static starter memes in `src/data/fallbackMemes.ts`.
2. Admin draft memes in browser `localStorage`.
3. Production memes in Cloudflare R2 (files) + D1 (metadata).

The live app retrieval order is:

1. Active local admin memes, for local testing.
2. Cloudflare D1/R2 API, when deployed and configured.
3. Static fallback starter memes.
