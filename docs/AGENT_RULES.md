# AGENT_RULES.md — Permanent Operating Instructions for AI Coding Agents

> **STOP. Before making any changes to this workspace, read `AGENT_RULES.md` completely and follow every applicable instruction in it throughout your entire task.**

---

## 1. Core Operating Philosophy & Golden Rules

1. **Do not fix what is not broken**: Never rewrite working code, refactor functional components, or replace established libraries simply because you prefer another design pattern or style.
2. **Strict Scope Control**: Only touch files and logic directly required for the user's requested task. Never change unrelated features while working on a specific feature.
3. **Preserve Backward Compatibility**: Existing working functionality, API contracts, and user data structures must remain fully functional.
4. **No Placeholders or Fake Code**: Every change must be functional, tested, and complete. Never leave `// TODO`, mock data replacements, or half-implemented features.
5. **The Repository is the Source of Truth**: Treat workspace files, existing migrations, and markdown documentation as the persistent project memory. Never guess when information can be verified in the codebase.
6. **Mandatory Documentation Synchronization**: Documentation is never optional. Every agent MUST update all affected Markdown documents in `docs/` and the workspace after every change, feature addition, or refactor. Never mark a task complete without keeping documentation fully synchronized.
7. **Mandatory Remote Git Coordination & Sync**: Before planning or implementing any feature, agents must check remote git state (`git fetch origin`, inspect `origin/main` / PRs) to ensure their branch is up to date and that teammates haven't already implemented or merged the feature. Never write code or propose architectures on a stale branch without verifying recent remote activity.

---

## 2. Protected Areas (MUST NOT Modify Without Explicit Authorization)

The following core architectural assets and components are protected. AI agents **MUST NOT** modify, delete, redesign, replace, or bypass them without explicit user consent:

### A. Established Architecture & Infrastructure
- **Cloudflare Pages Functions (`functions/api/`)**: The serverless API architecture using Cloudflare bindings (`env.DB` for D1 and `env.BUCKET` for R2). Do not replace this with Express, Next.js, or external servers.
- **Cloudflare D1 Database (`d1/migrations/`)**: Existing migration files (`000_complete_setup.sql` through `012_add_curation_status_to_memes.sql`) are historical database artifacts representing 14 production migrations. Never modify or delete past migration files. Add new migration files incrementally.
- **R2 Storage Integration**: The media bucket binding (`env.BUCKET`) and public asset URL resolution (`env.R2_PUBLIC_URL`).
- **Cloudflare Configuration**: `wrangler.toml`, `.dev.vars`, and environment bindings.

### B. UI/UX Identity & Design Systems
- **Neo-Brutalist Aesthetic**: Heavy black borders (`border: 2px solid ...`), hard offset box-shadows (`box-shadow: 4px 4px 0px ...`), high-contrast color palettes (yellow `#f4c300`, purple `#9b30ff`, green `#34C759`, dark `#121212`), and bold typography (`Anton`, `Oswald`).
- **Internal Neo-Brutalist Workbenches**: The operational internal interfaces for curation, administration, and moderation (`/curate`, `/admin`, `/reports`). Note that the public end-user mobile app/APK is maintained in the companion Android repository (`com.meme.capsule`), while this repository serves as the serverless edge backend, database, and internal tooling hub. The discontinued legacy landing UI has been officially removed.
- **Fallback Mechanism**: The static fallback meme system (`src/data/fallbackMemes.ts`) that guarantees zero-failure offline functionality.

### C. Authentication & Security Mechanisms
- **Admin Dashboard Token**: `ADMIN_API_TOKEN` verification in `functions/_shared/auth.ts`.
- **Judge & Curator Sessions**: SHA-256 password verification and 8-hour token session management in `functions/_shared/catAuth.ts`.
- **Admin Reset Security**: Verification code challenge for destructive admin operations (such as resetting analytics algorithms).

### D. Core Working Features & Consensus Rules
- **Public Meme Delivery**: `/api/memes/random`, `/api/memes/daily`, `/api/memes/reactions`.
- **Admin Dashboard (`/admin`)**: Storage sync from R2, SQL query execution, metadata editing, analytics resets, CSV/Excel exports.
- **Curator & Super Admin Portal (`/curate`)**: Multi-judge login (`cat_users`), keyboard-driven curation (`meme_curation`), conflict arbitration (`CuratorResolveModal`), batch consensus, and authoritative resolutions (`meme_curation_final`).
- **Multi-Judge Role Division (Strict Business Rule)**:
  - **Judges 1, 2, and 3 (Human)**: Exclusively govern consensus (unanimous keep, unanimous exclude, duplicate agreement, split/conflicts) and SuperAdmin arbitration.
  - **Judges 4 and 5 (AI Pre-Evaluators)**: Provide assistive pre-evaluations to improve human efficiency. **AI judges MUST NEVER push conflicts, arguments, or blockers onto the SuperAdmin console, nor trigger arbitration states.** Their votes are visible for human reference and quick adoption ("⚡ ADOPT DECISION") only.
  - **All 5 Judges Visible on Dashboard**: The SuperAdmin live progress strip and comparison matrices MUST always display all 5 configured judges (3 Human + 2 AI). Never filter out Judges 4 and 5 from progress reporting.
  - **Mandatory Exclude & Force-Remove Audit**: Every judge's "Exclude" votes (`{j.excluded}`) and "Force Remove" purges (`{j.force_removed}`) MUST be explicitly counted and visibly rendered on the SuperAdmin dashboard. All force removals must record an immutable row in `meme_force_removals`.

---

## 3. Standard Agent Workflow

Every AI coding agent must adhere to this step-by-step workflow:

```text
1. READ AGENT_RULES.md
   ↓
2. SYNC WITH REMOTE & INSPECT GIT STATE (git fetch origin, check origin/main)
   ↓
3. INSPECT WORKSPACE & DOCUMENTATION (GEMINI.md, docs/, schema)
   ↓
4. PLAN CHANGE & IDENTIFY RELEVANT FILES ONLY
   ↓
5. IMPLEMENT FOCUSED CHANGES (Follow existing patterns & styles)
   ↓
6. TEST THOROUGHLY (npm run build, runtime validation)
   ↓
7. "DON'T STOP AT THE FIRST ERROR" (Diagnose root causes, rerun tests)
   ↓
8. UPDATE RELEVANT DOCUMENTATION (README, docs, walkthrough)
   ↓
9. PRE-COMMIT CHECKLIST
   ↓
10. ATOMIC GIT COMMIT & PUSH
```

### Before Changing Code:
1. Read `AGENT_RULES.md` completely.
2. **Synchronize with Remote Repository**: Run `git fetch origin` and check for recent commits or PRs on `origin/main` (`git log HEAD..origin/main --oneline`). If the branch is behind, rebase or merge `origin/main` before designing or implementing changes.
3. **Verify Feature Non-Duplication**: Confirm that colleagues haven't already implemented, reviewed, or auto-merged the requested feature or a counterpart. Check commit messages, PRs, and schema migrations. If an overlap exists, notify the user and coordinate immediately instead of writing duplicate code that leads to painful merge conflicts.
4. Read project context in `GEMINI.md`, `CLAUDE.md`, and `docs/`.
5. Check git status to ensure working on a clean tree.
6. Locate existing utilities, middleware, and shared types before creating new ones.

### During Implementation:
- Keep changes minimal and surgically focused on the task.
- Match existing TypeScript conventions (strict typing, functional React components, hooks).
- Maintain Vanilla CSS design tokens; do not introduce external CSS frameworks like Tailwind unless explicitly asked.
- When creating D1 queries, write safe parameter bindings (`.bind(...)`) to prevent SQL injection.

---

## 4. Testing & Verification Requirements

No task is complete until verified. Agents **MUST NOT** proclaim completion without testing:

1. **Build Verification**: Run `npm run build` to verify TypeScript types, Vite bundling, and asset integrity.
2. **Zero Uncaught Errors**: Ensure no syntax errors, missing imports, or unhandled promise rejections exist in console logs.
3. **Database & API Integrity**: Verify that SQL queries, column names, and API parameters match the actual D1 schema.
4. **Zero-Tolerance Schema Drift Rule (CRITICAL)**:
   - **NEVER** write or deploy edge queries selecting new or modified database columns without FIRST physically verifying the live D1 schema via `PRAGMA table_info(<table>)` or applying migration files.
   - Presumptive querying of columns before live migration is strictly prohibited (this was the root cause of the October 2026 outage where `m.nsfw_flagged_by` crashed `/api/curate/next` with 500, locking all judges out and falsely showing 0% progress).
   - If querying newly added metadata columns, write defensive fallbacks (e.g. `try { ... } catch { ... }` or column presence checks) to protect production availability during deployment rollouts.

---

## 5. The "Don't Stop at the First Error" Rule

If a test, build, or command fails:
1. **Identify the exact error message and line number**.
2. **Understand why it failed**: Do not apply superficial band-aids or suppress errors. Look for the true root cause (e.g. missing table, mismatched column name, unhandled null, stale closure).
3. **Fix the underlying issue cleanly**.
4. **Re-run the build/test**: Ensure the fix works and did not introduce secondary regressions.
5. If an external blocker cannot be resolved safely (e.g. missing Cloudflare remote permissions), document the blocker clearly and provide exact copy-paste scripts for the user.

---

## 6. Mandatory Markdown Documentation Synchronization

> **CRITICAL RULE:** Documentation is a first-class deliverable. Every AI coding agent **MUST** keep all affected Markdown documentation files completely synchronized and accurate after **every change, feature addition, refactoring, or bugfix** in the codebase. Never leave a task marked complete without updating the documentation.

### The Canonical Documentation Inventory to Keep Updated:
1. **`./MEME_CAPSULE_KNOWLEDGE.md`**: Master architectural & product knowledge reference. Update whenever features, concepts, workflows, or ecosystem responsibilities change.
2. **`./PRIVACY_COOKIES_AND_DATA_FLOWS.md`**: Telemetry, cookies, analytics, subprocessors, and privacy compliance. Update whenever new third-party services, forms, cookies, SDKs, or data pipelines are modified.
3. **`./DATABASE.md`**: Cloudflare D1 SQLite schemas, table migrations, column structures, and R2 media bucket configurations.
4. **`./PROJECT_STRUCTURE.md`**: Directory maps, file layouts, component boundaries, and dependency mappings.
5. **`./README.md` & root `README.md`**: High-level repository guides, active routes, and setup instructions.
6. **`GEMINI.md` / `CLAUDE.md`**: AI context files, runtime configurations, and developer operating guidelines.
7. **`AGENT_RULES.md`**: The permanent operating guide itself — update if workflow policies or protected areas evolve.
8. **`walkthrough.md`**: Comprehensive record of changes made, files touched, testing commands executed, and verification results.

### Rules for Documentation Maintenance:
- **Never Claim Unverified Functionality:** The documentation must never state that a feature exists or works unless it was physically verified via code inspection, testing, or build validation.
- **Surgical Accuracy:** Do not blindly copy-paste stale summaries. Update the specific tables, lists, and sections affected by the code change.
- **Maintain Clear Separation:** Always preserve the distinction between **Public Mass-Audience Product** (Android APK `com.meme.capsule`, `memecapsule.wtf`) and **Developer / Internal Systems** (Cloudflare Edge, `/curate`, `/admin`, `/reports`).

---

## 7. Pre-Commit Checklist

Before committing and pushing to git, confirm:
- [ ] Did I verify against `origin/main` that no remote commits conflict with or duplicate my changes?
- [ ] Did I implement exactly what was requested without touching unrelated features?
- [ ] Are existing working features (Public app, Admin, Curator, Reports, API) unaffected?
- [ ] **Did I verify that all SQL column references physically exist in the live D1 schema (Zero Schema Drift)?**
- [ ] **Are AI Judges (4 & 5) restricted to advisory pre-evaluations without pushing conflicts or arbitration to SuperAdmin?**
- [ ] **Are all 5 configured judges visible on the SuperAdmin live progress dashboard?**
- [ ] **Are Exclude votes and Force Remove / Purge actions counted and visible for every judge?**
- [ ] Did `npm run build` and tests pass with 0 errors?
- [ ] Did I remove all debug `console.log` statements, scratch files, and temporary artifacts?
- [ ] **Are all affected Markdown documentation files updated and synchronized?**
- [ ] Is the git commit message clear, descriptive, and formatted with conventional commits (e.g. `feat: ...`, `fix: ...`, `docs: ...`)?

---

## 8. Summary Reminder

> **Read First → Change Only What Is Needed → Protect Established Architecture → Build & Test → Keep All Markdown Docs Synced → Commit & Push.**

---

## 9. Shared Project Knowledge — MEME_CAPSULE_KNOWLEDGE.md

The single source of truth for all project-wide context, architecture, decisions, and cross-codebase knowledge lives in `docs/MEME_CAPSULE_KNOWLEDGE.md`.
It is NOT part of this repository — it syncs via a separate GitHub repository (`editorav010-dev/meme-capsule-sync`).

### Mandatory Workflow:

**BEFORE starting any task:**
1. Always fetch the latest version first:
   - Windows: `powershell -ExecutionPolicy Bypass -File .knowledge/fetch-knowledge.ps1`
   - Mac/Linux: `bash .knowledge/fetch-knowledge.sh`
2. Read `docs/MEME_CAPSULE_KNOWLEDGE.md` fully before writing any code or changing configuration.

**AFTER any meaningful change:**
(new feature, architecture decision, bug fix, workflow change, new dependency, table migration):
1. Update `docs/MEME_CAPSULE_KNOWLEDGE.md` with the new relevant notes.
2. Push the updated knowledge file back to the shared repository:
   - Windows: `powershell -ExecutionPolicy Bypass -File .knowledge/update-knowledge.ps1`
   - Mac/Linux: `bash .knowledge/update-knowledge.sh`
3. If a **CONFLICT** is reported — stop, run `.knowledge/fetch-knowledge.ps1` (or `bash .knowledge/fetch-knowledge.sh`) fresh, manually merge your new notes into the fresh file, then run the update script again. Never force-push or skip the fetch before pushing.

---

## 10. Canonical Project Team & Ownership Division

All agents must respect and accurately attribute project ownership:
- **Anmol Verma** (Lead Backend Developer — GitHub: [`editorav010-dev`](https://github.com/editorav010-dev)): Full backend engineering, serverless architecture, core algorithms, AI tools implementation, security, curation systems, and all internal backend workbenches.
- **Pratham Pandey** (Lead Frontend Developer & Original Ideator — GitHub: [`bbethical010-glitch`](https://github.com/bbethical010-glitch)): Original concept and founding idea, frontend landing pages, Android APK development (`com.meme.capsule`), app theme, typography, UI/UX, Java Android bridge, and client integrations.
- **Faraz Ahmed** (Social Media & Marketing Lead): Social media handles management, content planning, niche analysis, scripting, and marketing campaigns.

**Official App Email (User Support & Marketing):** `support@memecapsule.wtf` (with `memecapsule.app@gmail.com` as backup)  
**Official Social Media:**  
- Instagram: https://www.instagram.com/capsule.meme/  
- X: https://x.com/memecapsule_  
- Threads: https://www.threads.com/@capsule.meme