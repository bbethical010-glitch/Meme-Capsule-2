/**
 * POST /api/curate/approve
 *
 * Stores the submitting judge's independent vote in meme_curation.
 * Votes are accepted only while the meme is in 'archive'.
 * Automatically evaluates 3-human consensus via applyConsensus.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, handleD1Error, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";
import { ensureCurationTables } from "../../_shared/curateDb";
import { applyConsensus } from "../../_shared/corpus";
import { getIngestionJobState } from "../../_shared/ingestion";

interface ApprovePayload {
  meme_id?: string;
  corpus_status?: "keep" | "excluded" | "duplicate";
  duplicate_of?: string;
  topics?: string[];
  tone?: string;
  humour_mechanisms?: string[];
  curator_note?: string;
  user_id?: string;
  user_name?: string;
  adopted_from?: "judge4" | "consensus" | "manual";
}

interface JudgeIdentity {
  id: string;
  username: string;
  display_name: string;
}

let tablesEnsured = false;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!tablesEnsured) {
      await ensureCurationTables(env.DB);
      tablesEnsured = true;
    }
    const sessionUser = await validateSession(request, env);
    const body = (await request.json().catch(() => ({}))) as ApprovePayload;
    const memeId = (body.meme_id || "").trim();
    const corpusStatus = body.corpus_status;

    if (!memeId) return json({ error: "meme_id is required." }, { status: 400 });
    
    // Exactly three options: keep, excluded, duplicate. review_later is rejected.
    if (!corpusStatus || !["keep", "excluded", "duplicate"].includes(corpusStatus)) {
      return json({ error: "corpus_status must be 'keep', 'excluded', or 'duplicate'. review_later is not permitted." }, { status: 400 });
    }

    // Verify meme exists and is in ARCHIVE state
    const memeRow = await env.DB.prepare(
      "SELECT id, corpus_status FROM memes WHERE id = ?"
    ).bind(memeId).first<{ id: string; corpus_status: string }>();

    if (!memeRow) {
      return json({ error: "Meme not found." }, { status: 404 });
    }

    if (memeRow.corpus_status !== "archive") {
      return json({
        error: "not_in_archive",
        message: `Vote cannot be accepted: meme is in state '${memeRow.corpus_status}', not 'archive'.`
      }, { status: 409 });
    }

    const ingestionState = await getIngestionJobState(env.DB, memeId);
    if (ingestionState && ingestionState !== "human_ready") {
      return json({
        error: "This new intake item is not human-ready yet. Advisory evaluation must succeed before human votes are accepted.",
        ingestion_state: ingestionState
      }, { status: 409 });
    }

    // Guard: if meme has been force-removed, return 410
    const isRemoved = await env.DB.prepare(
      "SELECT r2_deleted FROM meme_force_removals WHERE meme_id = ?"
    ).bind(memeId).first<{ r2_deleted: number }>();

    if (isRemoved) {
      return json(
        { error: "meme_removed", message: "This meme has been permanently force-removed." },
        { status: 410 }
      );
    }

    const { results: judgeRows } = await env.DB.prepare(`
      SELECT id, username, display_name
      FROM cat_users
      WHERE role = 'judge' AND username IN ('judge1', 'judge2', 'judge3')
    `).all<JudgeIdentity>();
    const judgeByUsername = new Map((judgeRows || []).map((judge) => [judge.username, judge]));
    const humanJudges = ["judge1", "judge2", "judge3"].map((username) => judgeByUsername.get(username));
    if (humanJudges.some((judge) => !judge)) {
      return json({ error: "The three designated human judges (judge1, judge2, judge3) are not configured." }, { status: 503 });
    }

    const judge1 = judgeByUsername.get("judge1");
    const userId = sessionUser?.id || (body.user_id ? body.user_id.trim() : judge1?.id || "user-judge1");
    const userName = sessionUser?.display_name || (body.user_name && body.user_name.trim() !== "Judge" ? body.user_name.trim() : judge1?.display_name || "Judge One");

    const rawTopics = Array.isArray(body.topics) ? body.topics.filter(Boolean) : [];
    const topics = rawTopics.slice(0, 3);
    const tone = (body.tone || "").trim() || null;
    const rawMechanisms = Array.isArray(body.humour_mechanisms) ? body.humour_mechanisms.filter(Boolean) : [];
    const mechanisms = rawMechanisms.slice(0, 2);
    const duplicateOf = (body.duplicate_of || "").trim() || null;
    const curatorNote = (body.curator_note || "").trim() || null;
    const now = new Date().toISOString();
    const curId = `cur-${crypto.randomUUID().slice(0, 8)}`;

    // Upsert vote into meme_curation
    await env.DB.prepare(`
      INSERT INTO meme_curation (
        id, meme_id, user_id, user_name, corpus_status, duplicate_of,
        topics, tone, humour_mechanisms, curator_note, reviewed_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(meme_id, user_id) DO UPDATE SET
        corpus_status = excluded.corpus_status,
        duplicate_of = excluded.duplicate_of,
        topics = excluded.topics,
        tone = excluded.tone,
        humour_mechanisms = excluded.humour_mechanisms,
        curator_note = excluded.curator_note,
        user_name = excluded.user_name,
        updated_at = excluded.updated_at
    `).bind(
      curId,
      memeId,
      userId,
      userName,
      corpusStatus,
      duplicateOf,
      JSON.stringify(topics),
      tone,
      JSON.stringify(mechanisms),
      curatorNote,
      now,
      now
    ).run();

    // Trigger authoritative consensus resolution
    const consensusRes = await applyConsensus(env, memeId);

    if (consensusRes.outcome === "pending") {
      const votesCnt = Number(consensusRes.split?.replace("votes:", "") || 1);
      return json({
        success: true,
        meme_id: memeId,
        user_id: userId,
        user_name: userName,
        corpus_status: corpusStatus,
        votes_received: votesCnt,
        votes_required: 3,
        is_final: false,
        outcome: "pending"
      });
    }

    if (consensusRes.outcome === "purged") {
      return json({
        success: true,
        meme_id: memeId,
        user_id: userId,
        user_name: userName,
        votes_received: 3,
        votes_required: 3,
        is_final: true,
        outcome: "purged",
        split: consensusRes.split
      });
    }

    if (consensusRes.outcome === "conflict") {
      return json({
        success: true,
        meme_id: memeId,
        user_id: userId,
        user_name: userName,
        votes_received: 3,
        votes_required: 3,
        is_final: false,
        outcome: "arbitration",
        split: consensusRes.split
      });
    }

    // Finalized into active or excluded
    return json({
      success: true,
      meme_id: memeId,
      user_id: userId,
      user_name: userName,
      corpus_status: consensusRes.outcome,
      votes_received: 3,
      votes_required: 3,
      is_final: true,
      outcome: "finalized",
      split: consensusRes.split
    });
  } catch (err: unknown) {
    return handleD1Error(err, "Error approving curation decision");
  }
};
