# Coding Agent Guidelines

> **CRITICAL MANDATE**: Before modifying any code or configuration in this repository, **you MUST read and adhere to [`AGENT_RULES.md`](./AGENT_RULES.md)** and [`docs/AGENT_RULES.md`](./docs/AGENT_RULES.md).

## Workflow Overview
1. **First Step**: Review [`AGENT_RULES.md`](./AGENT_RULES.md) and [`docs/AGENT_RULES.md`](./docs/AGENT_RULES.md) for protected areas and operating rules.
2. **Sync with Remote**: Run `git fetch origin` and verify `origin/main` commits to ensure no colleague has already implemented or auto-merged the feature.
3. **Current State**: Check [`docs/STATE.md`](./docs/STATE.md) for actual current implementation status and live endpoints.
4. **Project Context**: Check [`GEMINI.md`](./GEMINI.md) and [`docs/MEME_CAPSULE_KNOWLEDGE.md`](./docs/MEME_CAPSULE_KNOWLEDGE.md) for master architecture.
5. **Zero Schema Drift**: Never query new columns in edge code without physically verifying the live D1 schema first (`PRAGMA table_info(<table>)`).
6. **Multi-Judge Rules**: Human judges (1, 2, 3) strictly govern consensus and arbitration. AI judges (4, 5) provide reference votes only and must NEVER push conflicts or arbitration to SuperAdmin.
7. **Audit Completeness**: All 5 judges must remain visible on the dashboard, with Exclude votes and Force Remove / Purge actions tracked and displayed.
8. **Execution**: Make focused changes without refactoring unrelated features.
9. **Testing**: Run `npm run build` and tests to verify TypeScript and bundling.
10. **Documentation**: Update relevant Markdown docs in `docs/` and synchronize knowledge.
