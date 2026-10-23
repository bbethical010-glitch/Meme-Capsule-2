# Meme Capsule - Project Context

> **CRITICAL**: All AI coding agents must read and adhere to [`AGENT_RULES.md`](./AGENT_RULES.md) before making changes.

## Project Overview
**Meme Capsule** is an anti-algorithm meme discovery platform developed collaboratively by **Anmol Verma** ([@editorav010-dev](https://github.com/editorav010-dev)) as Lead Backend Developer, **Pratham Pandey** ([@bbethical010-glitch](https://github.com/bbethical010-glitch)) as Lead Frontend Developer & Original Ideator, and **Faraz Ahmed** as Social Media & Marketing Lead. Official App Contact: `support@memecapsule.wtf`.

The public end-user mobile experience (Android APK `com.meme.capsule` and promotional web landing `https://memecapsule.wtf/`) is maintained in a companion mobile repository.

**This repository** serves as the **Serverless Edge Backend, Curation Engine, Moderation Hub, and Administration Portal** deployed on Cloudflare Pages (`https://meme-capsule-eww.pages.dev`). The discontinued legacy root landing UI (`App.tsx`, `styles.css`) has been removed; the default root `/` and hash routes serve the internal Neo-Brutalist tool suites.

**Tech Stack:**
- **Frontend / Internal Workbenches:** React 19, TypeScript, Vite (`/curate`, `/admin`, `/reports`, `/ai-judge`, `/categorise`)
- **Styling:** Neo-Brutalist CSS (`curate.css`, `admin.css`, `cat.css`, `aiJudge.css`) with bold typography (`Anton`, `Oswald`, `Chivo`)
- **Backend/API:** Cloudflare Pages Functions (`functions/api/`, `functions/reports.ts`)
- **Database:** Cloudflare D1 (SQLite) with 14 production migrations (`000` through `012`)
- **Storage:** Cloudflare R2 for media assets
- **Hosting:** Cloudflare Pages

**Architecture Highlights:**
- **Three Decoupled Codebases:**
  1. **Public Android Mobile Application**: Capacitor 8 Android app (`com.meme.capsule`), single-tap capsule drops ("HIT ME"), 7-meme FIFO prefetch buffer, native Scoped MediaStore image saving, Mood Boards, Meme Vault, AdMob, and Google Play In-App Purchases.
  2. **Promotional & Press Web Platform**: Multi-page statically prerendered web platform at `https://memecapsule.wtf/` with live preview simulator, 3D device mockups, and Press Kit.
  3. **Developer / Internal Backend (This Repo)**: Multi-judge consensus curation (`/curate`), D1/R2 administrative management (`/admin`), token-gated user safety moderation (`/reports`), and AI-assisted pre-curation loop (`/ai-judge`).
- **Data Fallbacks:** Dual-source meme delivery (Cloudflare D1 repository + Reddit gateway), with static offline fallbacks (`src/data/fallbackMemes.ts`).

## Building and Running

**Prerequisites:** Node.js (npm). The project uses `npm.cmd` in its documentation for Windows environments.

- **Install Dependencies:**
  ```bash
  npm install
  ```

- **Run Frontend Locally (Vite):**
  ```bash
  npm run dev
  ```
  *This runs the Vite server on 127.0.0.1. Access the public app at `/` and the admin dashboard at `/admin`.*

- **Run Full Stack Locally (with Cloudflare Bindings):**
  To test D1 + R2 bindings locally via Wrangler:
  ```bash
  npm run build
  npx wrangler pages dev dist
  ```

- **Build for Production:**
  ```bash
  npm run build
  ```
  *The build output directory is `dist`.*

## Development Conventions

- **Code Style:** TypeScript with React Functional Components and Hooks. No heavy state management libraries; uses Context API and Local Storage.
- **Styling:** Vanilla CSS is preferred over complex frameworks (e.g., no Tailwind). Maintain the mobile-first, minimalist design aesthetic.
- **Documentation:** Primary project documentation is kept in the `docs/` folder. Be sure to reference `./README.md`, `./PROJECT_STRUCTURE.md`, and `./DATABASE.md` for in-depth architectural choices.
- **Environment Variables:** Backend mode for the admin dashboard requires `ADMIN_API_TOKEN` configured in Cloudflare Pages. It is not bundled into the frontend. D1 and R2 are accessed natively via bindings in `wrangler.toml`.
