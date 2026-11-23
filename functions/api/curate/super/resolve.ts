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
import { transitionMeme, applyConsensus, hasCorpusStatusColumn, type CorpusState, type VoteDecision } from "../../../_shared/corpus";

interface ResolvePayload {
  action?: "arbitrate" | "edit_vote";
  meme_id?: string;
  target_state?: "active" | "excluded";
  corpus_status?: "keep" | "excluded" | "duplicate";
  note?: string;
  curator_note?: string | null;
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

    const hasCol = await hasCorpusStatusColumn(env.DB);
    let memeStatus: CorpusState = "draft";

    if (hasCol) {
      const currentMeme = await env.DB.prepare(
        "SELECT id, corpus_status FROM memes WHERE id = ?"
      ).bind(memeId).first<{ id: string; corpus_status: CorpusState }>();

      if (!currentMeme) {
        return json({ error: "Meme not found." }, { status: 404 });
      }
      memeStatus = currentMeme.corpus_status || "draft";
    } else {
      const currentMeme = await env.DB.prepare(
        "SELECT id, status, is_active, curation_status FROM memes WHERE id = ?"
      ).bind(memeId).first<{ id: string; status: string; is_active: number; curation_status: string | null }>();

      if (!currentMeme) {
        return json({ error: "Meme not found." }, { status: 404 });
      }
      memeStatus = currentMeme.is_active === 1 ? "active" : currentMeme.curation_status === "excluded" ? "excluded" : "draft";
    }

    const actor = sessionUser.display_name || sessionUser.username || "Super Admin";

    // 1. EDIT VOTE on EXCLUDED meme
    if (body.action === "edit_vote" || (memeStatus === "excluded" && body.judge_id && body.new_vote)) {
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
      ).run().catch(() => {});

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

    // 2. CONFLICT ARBITRATION / SUPERADMIN RESOLUTION
    const targetState: "active" | "excluded" | undefined =
      body.target_state ||
      (body.corpus_status === "keep" ? "active" : body.corpus_status === "excluded" || body.corpus_status === "duplicate" ? "excluded" : undefined);

    if (!targetState) {
      return json({ error: "target_state must be 'active' or 'excluded' (or corpus_status 'keep'/'excluded')." }, { status: 400 });
    }

    const note = body.note || body.curator_note || "";
    await transitionMeme(env, memeId, targetState, {
      actor,
      reason: note ? `superadmin_arbitration: ${note}` : "superadmin_arbitration",
      expectedFrom: memeStatus
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
