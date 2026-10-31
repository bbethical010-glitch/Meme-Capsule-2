# AGENT_RULES.md — Permanent Operating Instructions for AI Coding Agents

> **STOP. Before making any changes to this workspace, read `docs/AGENT_RULES.md` completely and follow every applicable instruction in it throughout your entire task.**
> 
> The authoritative canonical operating guide is maintained at:  
> 👉 [**docs/AGENT_RULES.md**](./docs/AGENT_RULES.md)
>
> **Master AI-agent authority:** The single-source operating manual for this repository is [`docs/AI_AGENT_SINGLE_SOURCE_OF_TRUTH.md`](./docs/AI_AGENT_SINGLE_SOURCE_OF_TRUTH.md). If a rule conflicts with a supporting doc, this master guide and the repo operating rules take precedence.

---

## Quick Summary of Inviolable Rules

1. **Read First**: Always read [`docs/AGENT_RULES.md`](./docs/AGENT_RULES.md) and [`docs/MEME_CAPSULE_KNOWLEDGE.md`](./docs/MEME_CAPSULE_KNOWLEDGE.md) before modifying any code.
2. **Zero Schema Drift**: **NEVER** write or deploy edge queries selecting new or modified database columns without FIRST physically verifying the live D1 schema via `PRAGMA table_info(<table>)` or applying migration files. Presumptive column querying was the cause of the October 2026 500 error outage and is strictly prohibited.
3. **Multi-Judge Role Division**:
   - **Human Judges (Judges 1, 2, 3)**: Exclusively govern consensus (unanimous keep, unanimous exclude, duplicate agreement, split/conflicts) and SuperAdmin arbitration.
   - **AI Judges (Judges 4 and 5)**: Provide assistive pre-evaluations to improve human efficiency. **AI judges MUST NEVER push conflicts, arguments, or blockers onto the SuperAdmin console, nor trigger arbitration states.**
   - **Full Dashboard Visibility**: All 5 configured judges (3 Human + 2 AI) must always be displayed in the SuperAdmin live progress strip and in comparison matrices.
   - **Mandatory Exclude & Force-Remove Audit**: Every judge's "Exclude" votes and "Force Remove" purges must be explicitly counted and visibly rendered on the SuperAdmin dashboard.
4. **Do Not Fix What Is Not Broken**: Never refactor working components, remove existing functionality, or change architectures without explicit user consent.
5. **No Blind Completion**: Every change must be tested with `npm run build` and relevant tests.
6. **Mandatory Documentation Synchronization**: Update all affected Markdown documents in `docs/` after every task.

For full guidelines, protected areas, testing requirements, and the pre-commit checklist, consult:
[**docs/AGENT_RULES.md**](./docs/AGENT_RULES.md)
