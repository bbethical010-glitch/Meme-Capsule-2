# Implementation Prompt: Multi-Judge Majority Consensus for /curate

**Target: AI coding agent working inside the Meme Capsule Serverless Edge Backend repository (`meme-capsule-eww.pages.dev`) ONLY.**

> This is a deliberate, explicitly-authorized architecture change to the Layer 0 finalization model — not a bug fix, and not something to be second-guessed against "don't fix what isn't broken." The project owner has confirmed this direction after review. Do NOT touch the mobile APK repo (`com.meme.capsule`) or the promo website repo (`memecapsule.wtf`) — this task is fully contained to this repository.

---

## 0. Mandatory Pre-Work (per AGENT\_RULES.md)

1. Read `AGENT_RULES.md` in full if you have not already in this session.
2. Fetch and read `.knowledge/MEME_CAPSULE_KNOWLEDGE.md` per the mandatory workflow in Section 9 of `AGENT_RULES.md`.
3. Confirm a clean git working tree (`git status`).
4. Create and switch to a dedicated feature branch before making any changes: `git checkout -b feature/majority-consensus-curation`. All work happens here; `main` stays untouched as a restore point. Do not merge without explicit sign-off from the project owner.
5. Read `functions/api/curate/approve.ts` (or wherever `POST /api/curate/approve` is implemented) in full — this is the endpoint whose finalization behavior changes most. Confirm exactly how it currently writes to `meme_curation`, `meme_curation_final`, and `memes` today, and confirm the claim that any single judge's action is immediately authoritative (already independently verified against live code as of this prompt's writing — re-confirm it hasn't changed since).
6. Read whatever endpoint currently serves "next meme to review" to a judge (likely `GET /api/curate/next`). Confirm exactly how it currently excludes already-decided memes from the queue — this exclusion logic is what must change.
7. Locate and read the existing `Force Remove` implementation (`POST /api/curate/force-remove` or equivalent) in full. Confirm exactly what it purges (R2 object, which D1 tables/rows) — this logic will be reused, not rebuilt, for the 3:0-exclude hard-delete case.
8. Locate the SuperAdmin arbitration dashboard and its backing query/endpoint. Since divergence-triggered arbitration does not currently fire in practice (first-judge-instant-finality bypasses it entirely), verify this code path still works correctly end-to-end — it may be stale/untested. Fix only what's needed to make it function again; do not redesign its UI unless something is actually broken.
9. Confirm the exact `user_id` values for the three human judges (`user-judge1`, `user-judge2`, `user-judge3` or whatever they actually are) and the two AI judges, against `cat_users` — do not hardcode without verifying.
10. Confirm the existing mapping logic that currently derives `memes.tags` / `memes.category` from a finalized curation decision (referenced in current docs as part of the atomic sync). Preserve this exact mapping when writing majority-computed results — do not invent a new one.

---

## 1. Goal & Scope

Replace today's first-judge-instant-finality model with a genuine 3-human-judge majority consensus model for Layer 0 (`corpus_status`) and Layers 1–3 (`topics`, `tone`, `humour_mechanisms`), while preserving the existing AI-judgement-review experience (States A/B/C, AI Judge 4/5 display) completely unchanged as the per-judge review mechanism.

**In scope:**

- Queue/assignment logic: a meme must remain visible to any human judge (1/2/3) who hasn't personally voted on it yet, even after one or two other judges have.
- Finalization logic: only finalize once all 3 human judges have voted on a given meme, using the decision table in Section 2.
- Hard-delete integration for the unanimous 3:0-exclude case, via the existing Force Remove mechanism.
- Layer 1–3 per-field majority computation, per Section 3.
- Reviving/repairing the SuperAdmin arbitration path for genuine 1:1:1 splits.

**Explicitly out of scope — do not touch:**

- The mobile APK repo or the promo website repo.
- The AI-judgement-review display itself (States A/B/C, the `Enter`/`4`/`5`/`O` keymap for reviewing AI Judge 4/5) — this stays exactly as it is. What changes is only what happens *after* a human judge submits their own decision.
- The NSFW flag system (`is_nsfw`, `/api/curate/nsfw`) — fully independent, unaffected.
- Any existing D1 migration file. **No new migration is expected for this task** — the existing `meme_curation` schema (with its `UNIQUE(meme_id, user_id)` constraint) already supports storing 3 independent human votes per meme. Confirm this is sufficient in Section 0 before assuming it; only add a migration if something genuinely requires it (e.g., a performance-driven denormalized vote-count column), and flag that decision explicitly rather than adding it silently.

**Critical principle — judges vote blind to each other:** Judge 2 and Judge 3 must never see what another human judge has already decided for a meme they're reviewing. Showing a prior human vote would reintroduce the same automation-bias risk already identified and deliberately avoided in the AI-judgement-review design — it would make the 3 "independent" votes correlated rather than genuine signals, defeating the entire purpose of majority consensus. The AI Judge 4/5 display is the only context a human reviewer sees; this does not change.

---

## 2. Layer 0 — Finalization Decision Table

Once a judge submits their vote (writes/updates their own row in `meme_curation` for that `meme_id`), check how many of the 3 human judges have now voted on it:

- **Fewer than 3 votes exist:** do nothing further. Write the judge's `meme_curation` row as normal. Do NOT write to `meme_curation_final` or `memes`. The meme simply leaves *this judge's* queue (per Section 4) and nothing is finalized yet.
- **All 3 human judges have voted:** compute the outcome per this table and act immediately:

| Pattern | Outcome |
| --- | --- |
| 3:0 keep | Auto-finalize: write `meme_curation_final` (`corpus_status='keep'`), sync `memes` (`status='active'`, `is_active=1`, `curation_status='keep'`, plus tags/category per Section 0 step 10). No arbitration. |
| **3:0 excluded** | Auto-finalize as excluded, **then immediately trigger the existing Force Remove logic** (Section 0 step 7) to hard-delete the R2 object and purge all related D1 rows (`memes`, `meme_curation`, `meme_curation_final`, any AI prediction tables). Non-undoable — confirm this is logged clearly (e.g. in whatever audit/console logging Force Remove already does) before executing. |
| 3:0 duplicate, all 3 agree on the same `duplicate_of` target | Auto-finalize: `memes.curation_status='duplicate'`, `duplicate_of` set, `status='archived'`, `is_active=0`. Does NOT write to `meme_curation_final` (its schema only accepts keep/excluded). |
| 3:0 duplicate, but `duplicate_of` targets differ between judges | Treat as unresolved — route to SuperAdmin arbitration (Section 6) despite status agreement, since the actionable target hasn't converged. |
| 3:0 review\_later | Auto-finalize: `memes.curation_status='review_later'`, moved into the existing secondary review-later queue. No `meme_curation_final` write. |
| 2:1 keep | Majority wins. Same `memes`/`meme_curation_final` sync as 3:0 keep. No arbitration. The minority judge's vote stays recorded in `meme_curation` for audit — do not overwrite or discard it. |
| 2:1 excluded | Majority wins. Auto-finalize as excluded via the **normal soft-archive path** (`status='archived'`, `is_active=0`, `curation_status='excluded'`) — **do NOT hard-delete.** Hard-delete is reserved strictly for unanimous 3:0. |
| 2:1 duplicate, the majority pair agrees on `duplicate_of` | Auto-finalize as duplicate using the majority pair's target. |
| 2:1 duplicate, the majority pair's `duplicate_of` targets differ from each other | Route to arbitration — status majority exists but the target doesn't. |
| 2:1 review\_later | Majority wins, same handling as 3:0 review\_later. |
| 1:1:1 (three distinct `corpus_status` values among the three judges) | Route to SuperAdmin arbitration (Section 6). Do not auto-resolve. |

---

## 3. Layers 1–3 — Secondary Field Consensus

Applies only once Layer 0 has reached a finalizing outcome (3:0 or 2:1 on `corpus_status`) — secondary fields are irrelevant for memes routed to arbitration, since a human will resolve everything there manually.

- **`tone` (single-select):** if 2 or more of the 3 judges picked the same tone, that value wins. If all 3 differ (no majority), fall back to AI Judge 4 and AI Judge 5's own tone value — use it if they agree with each other; if they also differ or either is missing, default to AI Judge 4's value (consistent with the existing tie-break convention already used in the AI-judgement-review workflow).
- **`topics` (multi-select, max 3) and `humour_mechanisms` (multi-select, max 2):** treat each taxonomy option as an independent mini-vote. Any option chosen by 2 or more of the 3 judges is included in the final set, up to the field's existing max. If more options reach 2+ votes than the max allows, keep the highest vote-count options (ties broken by canonical taxonomy order). If zero options reach 2+ votes for a field, fall back to AI Judge 4/5 agreement the same way as `tone`.
- Write the resolved `topics`/`tone`/`humour_mechanisms` values into the finalized `memes` row alongside the Layer 0 outcome, using the existing tags/category mapping confirmed in Section 0, step 10.

---

## 4. Queue / Assignment Logic Change

This is the structural core of the task. Modify the "next meme to review" endpoint so that for a given human judge:

- **Exclude** any meme that judge has personally already submitted a `meme_curation` row for (they should never be asked to vote twice on the same meme).
- **Include** any meme that has 0, 1, or 2 existing human votes from *other* judges, as long as this judge hasn't voted yet — do not exclude a meme just because someone else already voted on it.
- A meme naturally drops out of circulation for everyone only once it reaches 3 human votes and gets finalized (Section 2) or routed to arbitration (Section 6, where it moves to the SuperAdmin queue instead of the regular judge queue).
- The existing AI-judgement-review display (what a judge sees when they open a meme — AI Judge 4/5's analysis, States A/B/C) is computed and shown exactly as it is today, regardless of how many *other human* judges have already voted. Per Section 1's blind-voting principle, do not surface any other human judge's vote in this view.

---

## 5. Hard-Delete Integration (3:0 Exclude Only)

Do not write new deletion logic. When Section 2's table calls for hard-delete, call into the existing Force Remove code path identified in Section 0, step 7, passing the relevant `meme_id`. Confirm its existing behavior (R2 purge + full D1 row purge, non-undoable) is exactly what fires, and that it is logged the same way manual Force Remove actions already are today.

---

## 6. SuperAdmin Arbitration — Revival

For the three table rows marked "route to arbitration" in Section 2, the meme must actually surface in the SuperAdmin Command Center, exactly as `MEME_CAPSULE_KNOWLEDGE.md` §5.5 describes but which does not currently fire. Confirm (per Section 0, step 8) that the dashboard's query for "divergent, unresolved memes" still correctly identifies these cases once they start occurring again, and that the existing resolution flow (SuperAdmin picks the authoritative outcome, writes `meme_curation_final`) still functions. Do not redesign this UI — only repair what's actually broken from disuse.

---

## 7. Testing & Verification

1. `npm run build` — zero TypeScript/Vite errors.
2. `npx wrangler pages dev dist` — verify with seeded test data covering every row of the Section 2 table:
   - 3:0 keep, 3:0 excluded (confirm R2 file and all D1 rows are actually gone afterward), 3:0 duplicate (same target), 3:0 duplicate (differing targets → arbitration), 3:0 review\_later.
   - 2:1 keep, 2:1 excluded (confirm the meme/file still exist, soft-archived only), 2:1 duplicate (both sub-cases), 2:1 review\_later.
   - 1:1:1 full split → confirm it appears correctly in the SuperAdmin arbitration queue and resolves correctly from there.
   - A meme with only 1 or 2 votes so far — confirm it still appears in the remaining judges' queues and does NOT appear finalized anywhere.
   - Confirm Judge 2 reviewing a meme Judge 1 already voted on sees no trace of Judge 1's decision — only the unchanged AI Judge 4/5 review context.
   - A `topics`/`tone`/`humour_mechanisms` 2:1 split and a full 3-way split on secondary fields, confirming the AI-tiebreak fallback fires correctly.
3. Confirm zero regressions to the AI-judgement-review display itself, to `/admin`, `/reports`, the NSFW system, and public delivery.

---

## 8. Mandatory Documentation Sync

- **`docs/MEME_CAPSULE_KNOWLEDGE.md`** — rewrite §5.4's "Authoritative Single-Judge Finality" bullet (it will no longer be accurate) and §5.5 (arbitration) to describe the real, now-functioning majority-consensus model — this is the discrepancy this prompt was written to resolve, so closing it in the docs matters.
- **`docs/DATABASE.md`** — note (even without a migration) that `meme_curation` now expects up to 3 independent human rows per `meme_id` before finalization, and that `meme_curation_final` is keep/excluded-only while `memes.curation_status` carries duplicate/review\_later outcomes directly.
- **`walkthrough.md`** — record exactly what changed, files touched, build/test commands run, and their results.

---

## 9. Pre-Commit Checklist

- [ ] No existing migration altered; new migration added only if genuinely justified and explicitly called out.
- [ ] No changes to the mobile APK or promo website repos.
- [ ] AI-judgement-review display (States A/B/C, AI Judge 4/5 keymap) is byte-for-byte unchanged.
- [ ] Judges never see another human judge's prior vote on the same meme.
- [ ] 3:0 exclude hard-deletes via the existing Force Remove path; 2:1 exclude never hard-deletes.
- [ ] `meme_curation_final` is only written for keep/excluded outcomes.
- [ ] SuperAdmin arbitration verified working end-to-end for genuine 1:1:1 splits.
- [ ] `npm run build` passes with 0 errors.
- [ ] All documentation in Section 8 updated.
- [ ] Commit message follows conventional commits (e.g. `feat: replace single-judge finality with 3-judge majority consensus`).
