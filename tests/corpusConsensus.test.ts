import { describe, it, expect } from "vitest";
import {
  evaluateConsensus,
  isLegalTransition,
  CORPUS_STATES,
  VOTE_OPTIONS,
  STATE_METADATA,
  LEGAL_TRANSITIONS,
  type RawJudgeVote
} from "../functions/_shared/corpus";
import * as FrontEndCorpus from "../src/types/corpus";

describe("Corpus Constants Equality", () => {
  it("backend and frontend CORPUS_STATES must be strictly identical", () => {
    expect(CORPUS_STATES).toEqual(FrontEndCorpus.CORPUS_STATES);
  });

  it("backend and frontend VOTE_OPTIONS must be strictly identical", () => {
    expect(VOTE_OPTIONS).toEqual(FrontEndCorpus.VOTE_OPTIONS);
  });

  it("backend and frontend STATE_METADATA keys and labels match", () => {
    expect(Object.keys(STATE_METADATA)).toEqual(Object.keys(FrontEndCorpus.STATE_METADATA));
    for (const key of CORPUS_STATES) {
      expect(STATE_METADATA[key].label).toBe(FrontEndCorpus.STATE_METADATA[key].label);
      expect(STATE_METADATA[key].color).toBe(FrontEndCorpus.STATE_METADATA[key].color);
    }
  });

  it("backend and frontend LEGAL_TRANSITIONS match", () => {
    expect(LEGAL_TRANSITIONS).toEqual(FrontEndCorpus.LEGAL_TRANSITIONS);
  });
});

describe("Corpus Legal Transitions", () => {
  it("allows legal forward transitions", () => {
    expect(isLegalTransition("new", "draft")).toBe(true);
    expect(isLegalTransition("draft", "archive")).toBe(true);
    expect(isLegalTransition("archive", "active")).toBe(true);
    expect(isLegalTransition("archive", "excluded")).toBe(true);
    expect(isLegalTransition("archive", "conflict")).toBe(true);
    expect(isLegalTransition("conflict", "active")).toBe(true);
    expect(isLegalTransition("conflict", "excluded")).toBe(true);
    expect(isLegalTransition("excluded", "active")).toBe(true);
    expect(isLegalTransition("excluded", "conflict")).toBe(true);
    expect(isLegalTransition("excluded", "excluded")).toBe(true);
  });

  it("allows purging from any state", () => {
    for (const state of CORPUS_STATES) {
      expect(isLegalTransition(state, "purged")).toBe(true);
    }
  });

  it("rejects illegal transitions", () => {
    expect(isLegalTransition("draft", "active")).toBe(false);
    expect(isLegalTransition("draft", "conflict")).toBe(false);
    expect(isLegalTransition("active", "archive")).toBe(false);
    expect(isLegalTransition("active", "draft")).toBe(false);
    expect(isLegalTransition("conflict", "draft")).toBe(false);
    expect(isLegalTransition("conflict", "archive")).toBe(false);
  });
});

describe("Corpus evaluateConsensus — All 27 Ordered Profiles", () => {
  const options = ["keep", "excluded", "duplicate"] as const;
  const judges = ["user-judge1", "user-judge2", "user-judge3"];

  // Helper to generate expected outcome for any K, E, D
  function getExpectedOutcome(K: number, E: number, D: number) {
    if (K >= 2) return { outcome: "active", reason: "consensus" };
    if (E === 3) return { outcome: "purge", reason: "unanimous_exclude" };
    if (E === 2) return { outcome: "excluded", reason: "consensus" };
    if (D >= 2) return { outcome: "excluded", reason: "duplicate" };
    return { outcome: "conflict", reason: "split" };
  }

  const profiles: Array<{ votes: RawJudgeVote[]; K: number; E: number; D: number }> = [];

  for (const v1 of options) {
    for (const v2 of options) {
      for (const v3 of options) {
        const vList = [v1, v2, v3];
        const K = vList.filter((x) => x === "keep").length;
        const E = vList.filter((x) => x === "excluded").length;
        const D = vList.filter((x) => x === "duplicate").length;
        profiles.push({
          votes: [
            { user_id: judges[0], corpus_status: v1 },
            { user_id: judges[1], corpus_status: v2 },
            { user_id: judges[2], corpus_status: v3 }
          ],
          K, E, D
        });
      }
    }
  }

  it("generates exactly 27 ordered vote profiles", () => {
    expect(profiles.length).toBe(27);
  });

  for (const { votes, K, E, D } of profiles) {
    const desc = `K=${K}, E=${E}, D=${D} [${votes.map((v) => v.corpus_status).join(", ")}]`;
    const expected = getExpectedOutcome(K, E, D);

    it(`correctly resolves ${desc} to ${expected.outcome} (${expected.reason})`, () => {
      const res = evaluateConsensus(votes);
      expect(res.outcome).toBe(expected.outcome);
      if (res.outcome !== "pending") {
        expect(res.reason).toBe(expected.reason);
        expect(res.split).toBe(`${K}:${E}:${D}`);
      }
    });
  }
});

describe("Corpus evaluateConsensus — Edge Cases & Guards", () => {
  it("returns pending with fewer than 3 designated human votes", () => {
    const res1 = evaluateConsensus([]);
    expect(res1).toEqual({ outcome: "pending", votesCount: 0 });

    const res2 = evaluateConsensus([
      { user_id: "user-judge1", corpus_status: "keep" }
    ]);
    expect(res2).toEqual({ outcome: "pending", votesCount: 1 });

    const res3 = evaluateConsensus([
      { user_id: "user-judge1", corpus_status: "keep" },
      { user_id: "user-judge2", corpus_status: "keep" }
    ]);
    expect(res3).toEqual({ outcome: "pending", votesCount: 2 });
  });

  it("ignores non-designated judge votes (AI Judge 4, superadmin)", () => {
    const votes: RawJudgeVote[] = [
      { user_id: "user-judge1", corpus_status: "keep" },
      { user_id: "user-judge2", corpus_status: "keep" },
      { user_id: "user-judge4", corpus_status: "excluded" }, // AI judge advisory
      { user_id: "user-superadmin", corpus_status: "duplicate" }
    ];
    // Only judge1 and judge2 are designated, so count is 2 (pending)
    const res = evaluateConsensus(votes);
    expect(res).toEqual({ outcome: "pending", votesCount: 2 });
  });

  it("deduplicates multiple votes from the same judge", () => {
    const votes: RawJudgeVote[] = [
      { user_id: "user-judge1", corpus_status: "excluded" },
      { user_id: "user-judge1", corpus_status: "keep" }, // updated vote
      { user_id: "user-judge2", corpus_status: "keep" },
      { user_id: "user-judge3", corpus_status: "duplicate" }
    ];
    const res = evaluateConsensus(votes);
    expect(res.outcome).toBe("active");
    expect(res.split).toBe("2:0:1");
  });
});
