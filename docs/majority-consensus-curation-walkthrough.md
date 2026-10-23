# Three-Judge Majority Consensus Curation: Implementation Walkthrough

**Scope:** `POST /api/curate/approve`, the judge work queue, Layer 0 decision resolution, Layer 1–3 taxonomy consensus, SuperAdmin arbitration, and unanimous-exclude hard removal.
**Implementation branch:** `feature/majority-consensus-curation`
**Implementation date:** October 17, 2026
**Source requirements:** [`planning/Multi-Judge Majority Consensus — curate Implementation Prompt.md`](planning/Multi-Judge%20Majority%20Consensus%20%E2%80%94%20curate%20Implementation%20Prompt.md)

## 1. What changed

The curation backend previously treated a single human judge's submission as authoritative. This implementation changes that boundary: Judges 1, 2, and 3 each submit and retain an independent vote. A result is finalized only after all three configured human judges have voted. The endpoint then applies the Layer 0 decision rules, computes the applicable secondary-field consensus, and either persists the result, routes the case to SuperAdmin arbitration, or invokes the existing Force Remove behavior for a unanimous exclusion.

The regular judge experience remains blind to other human votes. A judge who has not voted can still receive the meme even if another judge has voted. AI Judge 4 and Judge 5 remain read-only review context and are used as fallback inputs for secondary metadata when human field votes do not produce a majority.

The work also makes resolved metadata persistable on `memes`. Migration 014 adds the resolved duplicate target and secondary taxonomy fields, which were not part of the existing `memes` schema. Existing migrations were not edited.

## 2. Workflow architecture

```mermaid
flowchart TD
    A[Judge 1, 2, or 3 opens /curate] --> B[GET /api/curate/next]
    B --> C{Has this judge already voted?}
    C -- Yes --> D[Exclude from this judge's unreviewed queue]
    C -- No --> E[Return meme plus AI Judge 4/5 context]
    E --> F[Human submits independent vote]
    F --> G[POST /api/curate/approve]
    G --> H[Upsert this judge's meme_curation row]
    H --> I[Read configured human votes and AI fallback rows]
    I --> J{Three unique human votes?}
    J -- No --> K[Return pending; do not finalize]
    J -- Yes --> L[Resolve Layer 0 and secondary fields]
    L --> M{Consensus result}
    M -- 1:1:1 or unresolved duplicate target --> N[Return arbitration outcome]
    N --> O[SuperAdmin unresolved queue]
    O --> P[POST /api/curate/super/resolve]
    M -- Unanimous excluded --> Q[Write decision, then call shared hardRemoveMeme]
    Q --> R[Delete R2 object and purge related D1 rows]
    M -- Keep, 2:1 excluded, agreed duplicate, review_later --> S[Persist outcome to appropriate D1 table(s)]
    P --> S
    S --> T[Return finalized result]
```

### Request-to-result sequence

```mermaid
sequenceDiagram
    actor Judge
    participant Queue as GET /api/curate/next
    participant Approve as POST /api/curate/approve
    participant Resolver as curationConsensus.ts
    participant D1 as D1
    participant Super as SuperAdmin endpoints
    participant Remove as hardRemoveMeme()
    participant R2 as R2

    Judge->>Queue: Request next meme for own session
    Queue->>D1: Exclude own prior vote; retain items voted by others
    Queue-->>Judge: Meme and AI4/AI5 context, no other human vote
    Judge->>Approve: Submit vote
    Approve->>D1: Upsert own vote and read current vote set in ordered batch
    alt Fewer than three unique human votes
        Approve-->>Judge: pending, is_final=false
    else All three judges voted
        Approve->>Resolver: Resolve Layer 0 and Layers 1-3
        alt Split status or duplicate target conflict
            Approve-->>Judge: arbitration
            Super->>D1: Find unresolved conflict and display judge comparison
            Super->>D1: Save authoritative resolution
        else Unanimous excluded
            Approve->>D1: Record exclusion decision and archive state
            Approve->>Remove: hardRemoveMeme(meme_id, reason)
            Remove->>R2: Delete object key
            Remove->>D1: Purge meme and related rows
            Approve-->>Judge: hard_removed
        else Other resolvable outcome
            Approve->>D1: Persist final or direct meme fields
            Approve-->>Judge: finalized
        end
    end
```

## 3. Implementation walkthrough

### 3.1 Separate the pure consensus rules from HTTP and persistence

[`functions/_shared/curationConsensus.ts`](../functions/_shared/curationConsensus.ts) contains the deterministic resolver. It accepts typed human-vote objects and optional Judge 4/5 fallback values, and returns one of four outcomes:

- `pending`: fewer than three unique human judges have voted.
- `arbitration`: Layer 0 has no 2-vote majority, or the duplicate target is unresolved.
- `hard_remove`: all three votes are `excluded`.
- `finalize`: the status has a 2-vote majority, including keep, non-unanimous excluded, duplicate with an agreed target, or review_later.

The resolver deduplicates by `user_id` before counting votes. For topics and humour mechanisms, every distinct option in each judge's vote contributes one count; options with at least two votes are ranked by count, then canonical taxonomy order, and truncated to the existing maxima of three topics and two mechanisms. Tone is a single-select field and needs two matching values. Where the relevant human field has no majority, the resolver uses the existing AI Judge 4/5 fallback convention, preferring Judge 4 when the AI values do not agree or Judge 5 is absent.

Keeping these rules in a pure module lets unit tests exercise the decision table without depending on Pages runtime, storage, auth, or D1 setup.

### 3.2 Store votes independently, then make a single final decision

[`functions/api/curate/approve.ts`](../functions/api/curate/approve.ts) is the request orchestrator. It:

1. Ensures curation tables exist and validates the session.
2. Resolves configured judge identities from `cat_users`. Only Judges 1–3 can submit a human vote.
3. Normalizes the submitted status, duplicate target, topics, tone, mechanisms, and note.
4. Upserts only the submitting judge's row in `meme_curation`, using the existing `(meme_id, user_id)` uniqueness rule.
5. Batches that upsert with the read of human and AI rows, in order. This minimizes a race in which two final votes could each observe only two votes.
6. Returns `{ outcome: "pending", is_final: false }` when fewer than three human votes are present.
7. Calls the pure resolver when all three configured human judges have voted.
8. Persists the appropriate result, calls the shared hard-removal service when required, and returns a final outcome.

AI Judge 4 and Judge 5 rows can inform fallback values, but are filtered out of the three-human vote count. The final decision's `resolved_by` label records the three-judge majority.

### 3.3 Keep each judge's queue personal and blind

[`functions/api/curate/next.ts`](../functions/api/curate/next.ts) was changed so the unreviewed queue checks the current judge's own vote rather than treating any existing human vote as a reason to hide a meme. This allows Judge 2 or Judge 3 to assess an item after Judge 1 has voted, while preventing a judge from being asked to vote on the same meme again.

The response continues to expose AI Judge 4/5 context, but not another human judge's decision. A meme is no longer an ordinary unreviewed item after it is finalized or routed to arbitration.

### 3.4 Persist results according to the existing data contract

For keep and excluded, the endpoint writes `meme_curation_final`, whose schema supports those statuses, and synchronizes the resolved status and metadata to `memes`. A kept item becomes active. When topics are present, the existing public taxonomy mapping is preserved: `tags` is the serialized topic array and `category` is its first topic.

Other outcomes are represented directly on `memes` because `meme_curation_final` is keep/excluded-only:

| Consensus result | Persistence and activity behavior |
|---|---|
| Keep, 3:0 or 2:1 | Write final decision; sync fields to `memes`; set active and `status='active'`. |
| Excluded, 2:1 | Write final decision; set `curation_status='excluded'`, archived and inactive. Do not hard-delete. |
| Excluded, 3:0 | Enter the unanimous-exclude branch, then invoke the shared hard-remove path. Meme and related rows are purged. |
| Duplicate with agreed target | Store `curation_status='duplicate'` and `duplicate_of` on `memes`; archive and deactivate. No unsupported final-table status is written. |
| Review later | Store `curation_status='review_later'` on `memes`; leave it available to the review-later workflow. No final-table status is written. |
| Unresolved status/target | Do not finalize; expose through SuperAdmin's unresolved queue. |

Migration [`d1/migrations/014_add_resolved_curation_fields.sql`](../d1/migrations/014_add_resolved_curation_fields.sql) adds `duplicate_of`, `topics`, `tone`, and `humour_mechanisms` to `memes`. The migration is additive and is reflected in [`d1/schema.sql`](../d1/schema.sql). It was needed because those resolved fields had no columns on the `memes` table; it does not replace the per-judge rows in `meme_curation`.

### 3.5 Reuse the existing destructive path for unanimous exclusion

[`functions/_shared/forceRemove.ts`](../functions/_shared/forceRemove.ts) extracts the shared `hardRemoveMeme` service. It is used by both the consensus endpoint and the manual [`functions/api/curate/force-remove.ts`](../functions/api/curate/force-remove.ts) route, avoiding separate implementations of physical and database deletion.

The service obtains the stored object key from the meme row, attempts to delete the R2 object, purges the meme's curation, final decision, AI prediction, event, analytics, daily-stat, and meme rows, and emits a `[force-remove]` log. R2 delete exceptions are logged and do not prevent the D1 cleanup attempt. This is intentionally non-undoable. The approval route calls it only for a unanimous 3:0 excluded result. A 2:1 excluded result follows the soft-archive path.

### 3.6 Surface conflicts to SuperAdmin

[`functions/api/curate/super/memes.ts`](../functions/api/curate/super/memes.ts) now builds the unresolved queue from completed, unresolved human vote sets. It recognizes three different Layer 0 statuses and duplicate-majority cases whose targets do not converge (including missing targets). It returns the judge comparison data needed for arbitration.

[`functions/api/curate/super/resolve.ts`](../functions/api/curate/super/resolve.ts) remains the authoritative SuperAdmin action. Keep/excluded resolutions go to `meme_curation_final`; duplicate and review_later remain directly on `memes`, matching the table contract. Activity state and taxonomy fields are updated consistently.

[`functions/api/curate/super/summary.ts`](../functions/api/curate/super/summary.ts) now calculates consensus metrics from the human judges' rows, including completed conflicts and duplicate target disagreement. The UI itself was not redesigned as part of this backend change.

## 4. Complete file inventory

The feature implementation commit (`01dfcb8`) changed or added the following 16 files:

| File | Change |
|---|---|
| `functions/_shared/curationConsensus.ts` | **Added.** Typed, pure resolver for vote thresholds, Layer 0 results, duplicate target agreement, secondary-field majority, fallback and taxonomy ordering. |
| `functions/_shared/forceRemove.ts` | **Added.** Shared Force Remove service used by both manual and unanimous-consensus removal. |
| `functions/api/curate/approve.ts` | **Updated.** Records an individual vote and finalizes only after all three human judges vote. |
| `functions/api/curate/next.ts` | **Updated.** Enables per-judge queues for items others have voted on, while retaining vote blinding. |
| `functions/api/curate/force-remove.ts` | **Updated.** Delegates destructive work to the shared service. |
| `functions/api/curate/super/memes.ts` | **Updated.** Finds Layer 0 and duplicate-target conflicts for arbitration. |
| `functions/api/curate/super/resolve.ts` | **Updated.** Persists authoritative SuperAdmin decisions according to the final-table contract. |
| `functions/api/curate/super/summary.ts` | **Updated.** Reports human consensus and conflict metrics. |
| `d1/migrations/014_add_resolved_curation_fields.sql` | **Added.** Additive persistence fields for resolved metadata on memes. |
| `d1/schema.sql` | **Updated.** Keeps baseline schema in sync with migration 014. |
| `tests/curationConsensus.test.mjs` | **Added.** Unit tests for the pure consensus resolver. |
| `docs/DATABASE.md` | **Updated.** Documents vote and final-result storage semantics. |
| `docs/MEME_CAPSULE_KNOWLEDGE.md` | **Updated.** Replaces the old single-judge-finality description with the majority and arbitration model. |
| `docs/README.md` | **Updated.** Updates documentation navigation. |
| `docs/STATE.md` | **Updated.** Records the current implementation state. |
| `docs/walkthrough.md` | **Updated.** Records implementation and verification notes. |

No mobile APK or promo-website repository files were changed. The regular AI review presentation and its hotkey flow were outside this backend scope.

### Follow-up documentation files

The walkthrough itself was added after the feature implementation, and `docs/README.md` was updated to link to it from the documentation index. These two documentation-only follow-up files are not included in the 16-file feature-implementation inventory above.

### Verification-only artifacts

The full HTTP acceptance exercise used temporary local-only items: a separate Wrangler config, a seeded isolated local D1 fixture, a PowerShell acceptance script, an SVG test object, and a temporary Pages Function to inspect R2 object existence. These were removed after verification and are **not** part of the committed implementation. They were not production resources. The permanent resolver unit test remains in `tests/curationConsensus.test.mjs`.

## 5. Test and acceptance evidence

Verification was completed on October 17, 2026:

- `node --experimental-strip-types --test tests/curationConsensus.test.mjs`: **9 passed, 0 failed**.
- `npm run build`: TypeScript check and Vite production build succeeded, transforming 1,634 modules.
- `git diff --check`: succeeded.
- Real local Pages Functions were run via `wrangler pages dev` with isolated local D1/R2 bindings. The HTTP matrix covered all Layer 0 result families: 3:0 keep, excluded, duplicate target agreement/disagreement and review_later; 2:1 keep, excluded, duplicate target agreement/disagreement and review_later; and a 1:1:1 split. Tests also checked pending responses before the third vote.
- Secondary-field acceptance checked field majorities, AI fallback/agreement, canonical ordering, and field limits. Queue acceptance checked vote blinding and judge-specific queue behavior.
- SuperAdmin unresolved listing, summary, and resolution endpoints, NSFW tagging/public filtering, report submission, and `/admin`, `/reports`, and `/curate` routes were checked over local HTTP.
- Direct isolated D1 queries confirmed hard-excluded meme and vote rows were gone; 2:1 excluded was archived/inactive; agreed duplicate target and review_later state were stored on `memes`; and duplicate/review_later were not inserted into `meme_curation_final`.
- For R2 deletion, a disposable object was inserted in the isolated local bucket, the real unanimous-exclusion approval endpoint returned `hard_removed`, and a temporary local-only HEAD probe confirmed the object was absent afterward.

### Requirement-to-check traceability

| Requirement / changed public behavior | Concrete check on the real local Pages interface or integration boundary | Observed result |
|---|---|---|
| A single vote must not finalize; each judge contributes one independent vote | `POST /api/curate/approve` submitted first and second votes for every Layer 0 fixture, then submitted the third | First two responses were `pending` with `is_final=false`; third response matched that case's expected result. |
| 3:0 and 2:1 status decisions | Same approval endpoint, with 3:0 and 2:1 fixtures for keep, excluded, duplicate, and review_later | Keep and agreed duplicate finalized; unanimous excluded returned `hard_removed`; 2:1 excluded finalized without hard deletion; review_later finalized directly; unresolved cases returned `arbitration`. |
| Duplicate target must agree among the controlling duplicate votes | Approval endpoint with unanimous target disagreement and a 2:1 duplicate pair with disagreeing targets, then SuperAdmin unresolved-list endpoint | Both returned `arbitration`; both appeared in the unresolved list. Matching 3:0 and 2:1 duplicate targets finalized with the expected target. |
| A 1:1:1 split must be deferred to SuperAdmin | Approval endpoint, then `GET /api/curate/super/memes?filter=unresolved`, `/api/curate/super/summary`, and `POST /api/curate/super/resolve` | Split returned `arbitration`; queue contained the fixture; summary counted the conflict; resolve returned success. |
| Secondary fields use human majorities, AI fallback, canonical taxonomy order, and caps | Approval endpoint with field-majority fixture, three-way field disagreement with seeded Judge 4/5 values, and AI4/AI5 agreement fixture | Returned expected topic/tone/mechanism majorities; returned Judge 4 values on disagreement and agreed values on AI agreement; topics/mechanisms respected maxima and canonical order. |
| Votes are blind and queues are per judge | `GET /api/curate/next?filter=unreviewed` authenticated as Judge 2 after Judge 1 had voted, and as Judge 1 after their vote | Judge 2 received the meme and AI4/AI5 context but no Judge 1 name, ID, or curation; Judge 1's own queue returned no such item. |
| Only unanimous excluded hard-removes; 2:1 excluded is soft archive | Approval endpoint followed by isolated D1 queries and a local R2 object-existence probe | 3:0 response was `hard_removed`; meme and vote row counts were both zero and seeded object no longer existed. The 2:1 excluded row remained in D1 with `curation_status='excluded'` and `is_active=0`. |
| Duplicate/review_later use the compatible storage contract | Direct queries after duplicate and review_later outcomes | Agreed duplicate target and review_later status appeared on `memes`; neither status appeared in `meme_curation_final`. |
| Existing `tags`/`category` taxonomy contract is preserved | Read-only isolated D1 query on `matrix-secondary-majority` after the real approval request | `topics` and `tags` both equaled `["Everyday Life","Work / Education","Relationships"]`; `category` was `Everyday Life`; SQL check returned `PASS`. |
| Schema change is additive and existing migrations remain untouched | `git show --name-status 01dfcb8` compared with `d1/migrations/014_add_resolved_curation_fields.sql` | Feature commit added migration 014 and updated baseline `d1/schema.sql`; no pre-existing migration file was modified. The migration only adds the four resolved metadata columns. |
| Existing adjacent public workflows remain usable | `PATCH /api/curate/nsfw`, `GET /api/random-meme` with and without `nsfw=1`, `POST /api/report`, and page requests to `/admin`, `/reports`, `/curate` | NSFW flag succeeded; default random delivery excluded the NSFW fixture and opt-in admitted it; report was accepted and persisted; all three pages returned HTTP 200. |
| Build and isolated decision rules remain valid | Resolver test command and production `npm run build` | 9/9 unit tests passed; TypeScript and Vite build succeeded (1,634 modules transformed). |

**Acceptance boundary:** The end-to-end HTTP checks used the actual project Pages Function routes, but an isolated local Wrangler D1/R2 setup, seeded test users/rows, and a temporary acceptance script. They did not use production credentials, buckets, or databases. The upload route's local request was rejected as unauthorized, so upload itself is not claimed as verified; the destructive R2 deletion path above was exercised independently with a disposable local object.

**Limitations:** The local admin upload endpoint request was rejected as unauthorized because local secret configuration overrode the test token. Therefore the upload route itself was not validated. The R2 removal behavior was independently exercised with a seeded disposable local object. No remote or production D1/R2 resources were used. The temporary HTTP test script was intentionally removed after the run; its coverage is summarized above, while the pure resolver tests are maintained in-repository.

## 6. Commit trail

- `01dfcb8` — `feat: replace single-judge finality with majority consensus`
- `bcb42b9` — `docs: record majority consensus API smoke results`
- `f8836e6` — `docs: record consensus acceptance verification`
- `712e136` — `docs: add majority consensus implementation walkthrough`
- `66e5d7a` — `docs: add consensus acceptance traceability`

This document is a follow-up guide to those implementation commits. It does not add new runtime behavior.
