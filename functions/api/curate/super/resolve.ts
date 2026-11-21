/**
 * POST /api/curate/super/resolve
 *
 * SuperAdmin actions:
 * 1. CONFLICT arbitration: choose 'active' or 'excluded' (reason 'superadmin_arbitration').
 * 2. EXCLUDED review EDIT VOTE: edit one judge's vote and re-run applyConsensus.
 * All transitions go through transitionMeme or applyConsensus.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";
import { transitionMeme, applyConsensus, type CorpusState, type VoteDecision } from "../../../_shared/corpus";

interface ResolvePayload {
  action?: "arbitrate" | "edit_vote";
  meme_id?: string;
  target_state?: "active" | "excluded";
  note?: string;
  // For edit_vote:
  judge_id?: string;
  new_vote?: VoteDecision;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);

    const sessionUser = await validateSession(request, env);
    if (!sessionUser || sessionUser.role !== "superadmin") {
      return json({ error: "Superadmin credentials required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ResolvePayload;
    const memeId = (body.meme_id || "").trim();

    if (!memeId) {
      return json({ error: "meme_id is required." }, { status: 400 });
    }

    const currentMeme = await env.DB.prepare(
      "SELECT id, corpus_status FROM memes WHERE id = ?"
    ).bind(memeId).first<{ id: string; corpus_status: CorpusState }>();

    if (!currentMeme) {
      return json({ error: "Meme not found." }, { status: 404 });
    }

    const actor = sessionUser.display_name || "Super Admin";

    // 1. EDIT VOTE on EXCLUDED meme
    if (body.action === "edit_vote" || (currentMeme.corpus_status === "excluded" && body.judge_id && body.new_vote)) {
      const judgeId = (body.judge_id || "").trim();
      const newVote = body.new_vote;

      if (!judgeId || !newVote || !["keep", "excluded", "duplicate"].includes(newVote)) {
        return json({ error: "judge_id and valid new_vote ('keep', 'excluded', 'duplicate') required for edit_vote." }, { status: 400 });
      }

      const existingVote = await env.DB.prepare(
        "SELECT corpus_status FROM meme_curation WHERE meme_id = ? AND user_id = ?"
      ).bind(memeId, judgeId).first<{ corpus_status: string }>();

      if (!existingVote) {
        return json({ error: `Vote for judge ${judgeId} on meme ${memeId} not found.` }, { status: 404 });
      }

      const now = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE meme_curation SET corpus_status = ?, updated_at = ? WHERE meme_id = ? AND user_id = ?"
      ).bind(newVote, now, memeId, judgeId).run();

      // Log the vote modification in meme_state_log
      await env.DB.prepare(`
        INSERT INTO meme_state_log (meme_id, from_state, to_state, actor, reason, at)
        VALUES (?, 'excluded', 'excluded', ?, ?, ?)
      `).bind(
        memeId,
        actor,
        `Superadmin edited vote for judge ${judgeId}: ${existingVote.corpus_status} -> ${newVote}`,
        now
      ).run();

      // Re-run consensus evaluation
      const consensusRes = await applyConsensus(env, memeId);

      return json({
        success: true,
        action: "edit_vote",
        meme_id: memeId,
        judge_id: judgeId,
        new_vote: newVote,
        consensus: consensusRes
      });
    }

    // 2. CONFLICT ARBITRATION
    if (currentMeme.corpus_status !== "conflict") {
      return json({
        error: `Arbitration is only valid for memes in 'conflict' state (current: '${currentMeme.corpus_status}').`
      }, { status: 400 });
    }

    const targetState = body.target_state;
    if (!targetState || (targetState !== "active" && targetState !== "excluded")) {
      return json({ error: "target_state must be 'active' or 'excluded' for arbitration." }, { status: 400 });
    }

    await transitionMeme(env, memeId, targetState, {
      actor,
      reason: body.note ? `superadmin_arbitration: ${body.note}` : "superadmin_arbitration",
      expectedFrom: "conflict"
    });

    return json({
      success: true,
      action: "arbitrate",
      meme_id: memeId,
      state: targetState,
      arbitrated_by: actor
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error arbitrating meme";
    return json({ error: msg }, { status: 500 });
  }
};
