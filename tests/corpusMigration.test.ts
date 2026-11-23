import { describe, it, expect } from "vitest";
import {
  planMigration,
  generateSqlStatements,
  type RawMemeRecord,
  type RawFinalRecord,
  type RawVoteRecord,
  type RawAiRecord
} from "../scripts/migrate-corpus-status";

describe("Step 11: planMigration Rules 0-5", () => {
  it("Rule 0: Legacy live memes with ledger keep become active", () => {
    const memes: RawMemeRecord[] = [
      { id: "m1", status: "active", is_active: 1, curation_status: "keep", storage_path: "2024/01/m1.png", content_hash: "h1" }
    ];
    const finals: RawFinalRecord[] = [{ meme_id: "m1", corpus_status: "keep" }];
    const votes: RawVoteRecord[] = [];
    const aiJobs: RawAiRecord[] = [];

    const plan = planMigration(memes, finals, votes, aiJobs);
    expect(plan.countsAfter.active).toBe(1);
    expect(plan.rule0LegacyLiveCount).toBe(1);
    expect(plan.transitions[0].toState).toBe("active");
    expect(plan.transitions[0].reason).toBe("legacy_live");
  });

  it("Rule 1: Moves review_later votes to curation_legacy_later_votes", () => {
    const memes: RawMemeRecord[] = [
      { id: "m2", status: "draft", is_active: 0, curation_status: null, storage_path: "2024/01/m2.png", content_hash: "h2" }
    ];
    const finals: RawFinalRecord[] = [];
    const votes: RawVoteRecord[] = [
      { meme_id: "m2", user_id: "judge1", corpus_status: "review_later", duplicate_of: null },
      { meme_id: "m2", user_id: "judge2", corpus_status: "keep", duplicate_of: null }
    ];
    const aiJobs: RawAiRecord[] = [];

    const plan = planMigration(memes, finals, votes, aiJobs);
    expect(plan.reviewLaterVotesToMove.length).toBe(1);
    expect(plan.reviewLaterVotesToMove[0].user_id).toBe("judge1");
  });

  it("Rule 2: Legacy 3:0 exclude becomes excluded with 7-day timer and does not purge", () => {
    const memes: RawMemeRecord[] = [
      { id: "m3", status: "archived", is_active: 0, curation_status: "excluded", storage_path: "2024/01/m3.png", content_hash: "h3" }
    ];
    const finals: RawFinalRecord[] = [];
    const votes: RawVoteRecord[] = [
      { meme_id: "m3", user_id: "judge1", corpus_status: "excluded", duplicate_of: null },
      { meme_id: "m3", user_id: "judge2", corpus_status: "excluded", duplicate_of: null },
      { meme_id: "m3", user_id: "judge3", corpus_status: "excluded", duplicate_of: null }
    ];
    const aiJobs: RawAiRecord[] = [];

    const plan = planMigration(memes, finals, votes, aiJobs);
    expect(plan.countsAfter.excluded).toBe(1);
    expect(plan.rule2LegacyUnanimousExcludeCount).toBe(1);
    expect(plan.transitions[0].toState).toBe("excluded");
    expect(plan.transitions[0].reason).toBe("legacy_unanimous");
    expect(plan.transitions[0].purgeAt).toBeDefined();
  });

  it("Rule 3: AI Judge succeeded becomes archive", () => {
    const memes: RawMemeRecord[] = [
      { id: "m4", status: "draft", is_active: 0, curation_status: null, storage_path: "2024/01/m4.png", content_hash: "h4" }
    ];
    const finals: RawFinalRecord[] = [];
    const votes: RawVoteRecord[] = [];
    const aiJobs: RawAiRecord[] = [{ meme_id: "m4", state: "human_ready" }];

    const plan = planMigration(memes, finals, votes, aiJobs);
    expect(plan.countsAfter.archive).toBe(1);
    expect(plan.rule3ArchiveCount).toBe(1);
    expect(plan.transitions[0].toState).toBe("archive");
    expect(plan.transitions[0].reason).toBe("legacy_ai_promoted");
  });

  it("Rule 4: Otherwise becomes draft", () => {
    const memes: RawMemeRecord[] = [
      { id: "m5", status: "draft", is_active: 0, curation_status: null, storage_path: "2024/01/m5.png", content_hash: "h5" }
    ];
    const finals: RawFinalRecord[] = [];
    const votes: RawVoteRecord[] = [];
    const aiJobs: RawAiRecord[] = [];

    const plan = planMigration(memes, finals, votes, aiJobs);
    expect(plan.countsAfter.draft).toBe(1);
    expect(plan.rule4DraftCount).toBe(1);
    expect(plan.transitions[0].toState).toBe("draft");
    expect(plan.transitions[0].reason).toBe("legacy_intake");
  });

  it("Generates batched SQL with audit logs", () => {
    const memes: RawMemeRecord[] = [
      { id: "m1", status: "active", is_active: 1, curation_status: "keep", storage_path: "p1", content_hash: "h1" }
    ];
    const plan = planMigration(memes, [{ meme_id: "m1", corpus_status: "keep" }], [], []);
    const sqls = generateSqlStatements(plan);
    expect(sqls.length).toBeGreaterThanOrEqual(2);
    expect(sqls.some((s) => s.includes("UPDATE memes SET corpus_status = 'active'"))).toBe(true);
    expect(sqls.some((s) => s.includes("INSERT INTO meme_state_log"))).toBe(true);
  });
});
