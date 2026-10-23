# CLAUDE.md

> **CRITICAL**: Before modifying this repository, read and follow [`AGENT_RULES.md`](./AGENT_RULES.md).

This file provides guidance to Claude Code when working with code in this repository.

## Development Setup

1. **Install Dependencies**:
   `npm install` - Installs all dependencies (Vite 6, React 19, TypeScript 5.7, Cloudflare Workers Types).

2. **Start Development Server**:
   `npm run dev` - Launches the Vite development server on `127.0.0.1:5173`. Serves the internal tool suites (`/curate`, `/admin`, `/reports`, `/ai-judge`, `/categorise`).

3. **Build Production Bundle**:
   `npm run build` - Executes `tsc && vite build` to compile TypeScript and generate production assets in `dist/`.

4. **Preview Production Build**:
   `npm run preview` - Previews the production build locally via Vite preview server.

5. **Run with Cloudflare Bindings (Wrangler)**:
   ```bash
   npm run build
   npx wrangler pages dev dist
   ```
   Tests D1 database (`DB`) and R2 storage (`MEMES_BUCKET`) bindings locally.

6. **Documentation Synchronization**:
   `npm run docs:sync` - Synchronizes project directory maps in `docs/PROJECT_STRUCTURE.md`.

## Code Architecture

### Tech Stack
- **Frontend / Internal Workbenches**: React 19, TypeScript, Vite 6
- **Serverless API**: Cloudflare Pages Functions (`functions/api/`, `functions/reports.ts`)
- **Database**: Cloudflare D1 (SQLite) with 14 production migrations (`d1/migrations/`)
- **Object Storage**: Cloudflare R2 bucket (`memes`)
- **Styling**: Neo-Brutalist Vanilla CSS (`curate.css`, `admin.css`, `cat.css`, `aiJudge.css`)

### Key Directories
- `src/`: Internal Neo-Brutalist workbenches (`curate/`, `admin/`, `cat/`, `ai/`) and shared utilities
- `functions/`: Cloudflare Pages Functions API endpoints
  - `functions/api/`: Public delivery (`random-meme.ts`, `daily-meme.ts`, `like.ts`, `contact.ts`) and Admin APIs
  - `functions/_shared/`: Native D1/R2 database helpers (`d1r2.ts`), auth (`auth.ts`, `catAuth.ts`), and types
- `d1/`: D1 schema definitions and migrations (`000` through `012`)
- `docs/`: Comprehensive project documentation
- `public/`: Static web assets and manifest

## Development Rules
- Follow all permanent instructions in [`AGENT_RULES.md`](./AGENT_RULES.md).
- Do not modify past database migrations (`000_complete_setup.sql` through `012_add_curation_status_to_memes.sql`).
- Always verify changes with `npm run build` before considering any task complete.