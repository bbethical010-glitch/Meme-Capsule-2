import test from "node:test";
import assert from "node:assert/strict";
import { resolveHumanConsensus } from "../functions/_shared/curationConsensus.ts";

const vote = (user_id, corpus_status, overrides = {}) => ({
  user_id,
  corpus_status,
  duplicate_of: null,
  topics: [],
  tone: null,
  humour_mechanisms: [],
  ...overrides,
});

const ai = {
  judge4: { topics: ["Gaming"], tone: "Chaotic", humour_mechanisms: ["Absurdity"] },
  judge5: { topics: ["Gaming"], tone: "Chaotic", humour_mechanisms: ["Absurdity"] },
};

const judges = ["user-judge1", "user-judge2", "user-judge3"];

test("does not finalize until all three human judges have voted", () => {
  const result = resolveHumanConsensus([
    vote(judges[0], "keep"),
    vote(judges[1], "keep"),
  ], ai);
  assert.deepEqual(result, { kind: "pending" });
});

test("finalizes a unanimous keep with agreed field majorities", () => {
  const result = resolveHumanConsensus([
    vote(judges[0], "keep", { topics: ["Gaming", "Everyday Life"], tone: "Dark", humour_mechanisms: ["Irony"] }),
    vote(judges[1], "keep", { topics: ["Gaming"], tone: "Dark", humour_mechanisms: ["Irony"] }),
    vote(judges[2], "keep", { topics: ["Everyday Life"], tone: "Dark", humour_mechanisms: ["Relatability"] }),
  ], ai);
  assert.equal(result.kind, "finalize");
  assert.equal(result.corpus_status, "keep");
  assert.deepEqual(result.topics, ["Everyday Life", "Gaming"]);
  assert.equal(result.tone, "Dark");
  assert.deepEqual(result.humour_mechanisms, ["Irony"]);
});

test("hard-removes only a unanimous excluded vote", () => {
  const unanimous = resolveHumanConsensus(judges.map((id) => vote(id, "excluded")), ai);
  const majority = resolveHumanConsensus([
    vote(judges[0], "excluded"), vote(judges[1], "excluded"), vote(judges[2], "keep"),
  ], ai);
  assert.equal(unanimous.kind, "hard_remove");
  assert.equal(majority.kind, "finalize");
  assert.equal(majority.corpus_status, "excluded");
});

test("routes a 1:1:1 Layer 0 split to arbitration", () => {
  const result = resolveHumanConsensus([
    vote(judges[0], "keep"), vote(judges[1], "excluded"), vote(judges[2], "duplicate", { duplicate_of: "m-3" }),
  ], ai);
  assert.deepEqual(result, { kind: "arbitration", reason: "layer0_split" });
});

test("routes unanimous duplicate status to arbitration when any duplicate targets differ", () => {
  const result = resolveHumanConsensus([
    vote(judges[0], "duplicate", { duplicate_of: "m-1" }),
    vote(judges[1], "duplicate", { duplicate_of: "m-1" }),
    vote(judges[2], "duplicate", { duplicate_of: "m-2" }),
  ], ai);
  assert.deepEqual(result, { kind: "arbitration", reason: "duplicate_target_split" });
});

test("finalizes a 2:1 duplicate outcome when the duplicate pair agrees on its target", () => {
  const result = resolveHumanConsensus([
    vote(judges[0], "duplicate", { duplicate_of: "m-1" }),
    vote(judges[1], "duplicate", { duplicate_of: "m-1" }),
    vote(judges[2], "keep"),
  ], ai);
  assert.equal(result.kind, "finalize");
  assert.equal(result.corpus_status, "duplicate");
  assert.equal(result.duplicate_of, "m-1");
});

test("uses unanimous review_later directly without final-table status", () => {
  const result = resolveHumanConsensus(judges.map((id) => vote(id, "review_later")), ai);
  assert.equal(result.kind, "finalize");
  assert.equal(result.corpus_status, "review_later");
});

test("uses AI Judge 4/5 fallback when no human secondary-field option has majority", () => {
  const result = resolveHumanConsensus([
    vote(judges[0], "keep", { topics: ["Gaming"], tone: "Dark", humour_mechanisms: ["Irony"] }),
    vote(judges[1], "keep", { topics: ["Food"], tone: "Wholesome", humour_mechanisms: ["Parody"] }),
    vote(judges[2], "keep", { topics: ["Animals"], tone: "Chaotic", humour_mechanisms: ["Surrealism"] }),
  ], ai);
  assert.deepEqual(result.topics, ["Gaming"]);
  assert.equal(result.tone, "Chaotic");
  assert.deepEqual(result.humour_mechanisms, ["Absurdity"]);
});

test("uses canonical taxonomy order for tied options over the field maximum", () => {
  const result = resolveHumanConsensus([
    vote(judges[0], "keep", { topics: ["Everyday Life", "Work / Education", "Relationships"], humour_mechanisms: ["Relatability", "Absurdity"] }),
    vote(judges[1], "keep", { topics: ["Everyday Life", "Work / Education", "Gaming"], humour_mechanisms: ["Relatability", "Irony"] }),
    vote(judges[2], "keep", { topics: ["Relationships", "Gaming", "Food"], humour_mechanisms: ["Absurdity", "Irony"] }),
  ], ai);
  assert.deepEqual(result.topics, ["Everyday Life", "Work / Education", "Relationships"]);
  assert.deepEqual(result.humour_mechanisms, ["Relatability", "Absurdity"]);
});
