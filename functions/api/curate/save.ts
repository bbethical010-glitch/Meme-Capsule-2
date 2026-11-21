/**
 * POST /api/curate/save
 * 
 * Saves editorial judgment and multi-dimensional categorization for a meme.
 * Tracks user_id and user_name for multi-curator workflows.
 * Accepts votes only while the meme is in 'archive'.
 * Triggers applyConsensus on every vote.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, handleD1Error, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";
import { ensureCurationTables } from "../../_shared/curateDb";
import { getIngestionJobState } from "../../_shared/ingestion";
import { applyConsensus } from "../../_shared/corpus";

interface SavePayload {
  meme_id?: string;
  moderation_only?: boolean;
  is_nsfw?: boolean;
  corpus_status?: "keep" | "excluded" | "duplicate";
  duplicate_of?: string;
  topics?: string[];
  tone?: string;
  humour_mechanisms?: string[];
  curator_note?: string;
  user_id?: string;
  user_name?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);
    const body = (await request.json().catch(() => ({}))) as SavePayload;
    const memeId = (body.meme_id || "").trim();
    const corpusStatus = body.corpus_status;

    if (!memeId) {
      return json({ error: "meme_id is required." }, { status: 400 });
    }

    if (body.moderation_only) {
      if (typeof body.is_nsfw !== "boolean") {
        return json({ error: "is_nsfw must be a boolean." }, { status: 400 });
      }
      const meme = await env.DB.prepare("SELECT id FROM memes WHERE id = ?")
        .bind(memeId)
        .first<{ id: string }>();
      if (!meme) {
        return json({ error: "Meme not found." }, { status: 404 });
      }
      const flaggedBy = body.is_nsfw ? "curator" : null;
      await env.DB.prepare("UPDATE memes SET is_nsfw = ?, nsfw_flagged_by = ? WHERE id = ?")
        .bind(body.is_nsfw ? 1 : 0, flaggedBy, memeId)
        .run();
      return json({ success: true, meme_id: memeId, is_nsfw: body.is_nsfw, nsfw_flagged_by: flaggedBy });
    }

    // REVIEW LATER removed everywhere. Exactly KEEP / EXCLUDE / DUPLICATE accepted.
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
        message: `Vote cannot be saved: meme is currently in state '${memeRow.corpus_status}', not 'archive'.`
      }, { status: 409 });
    }

    const ingestionState = await getIngestionJobState(env.DB, memeId);
    if (ingestionState && ingestionState !== "human_ready") {
      return json({
        error: "This new intake item is not human-ready yet. Advisory evaluations must succeed before a human vote is accepted.",
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

    // Determine user from session or explicit payload
    const userId = sessionUser?.id || (body.user_id ? body.user_id.trim() : "user-judge1");
    const userName = sessionUser?.display_name || (body.user_name && body.user_name.trim() !== "Judge" ? body.user_name.trim() : "Judge One");

    // Enforce taxonomy selection limits
    const rawTopics = Array.isArray(body.topics) ? body.topics.filter(Boolean) : [];
    const topics = rawTopics.slice(0, 3); // Max 3 topics

    const tone = (body.tone || "").trim() || null; // 1 dominant tone

    const rawMechanisms = Array.isArray(body.humour_mechanisms) ? body.humour_mechanisms.filter(Boolean) : [];
    const mechanisms = rawMechanisms.slice(0, 2); // Max 2 mechanisms

    const duplicateOf = (body.duplicate_of || "").trim() || null;
    const curatorNote = (body.curator_note || "").trim() || null;
    const now = new Date().toISOString();
    const curId = `cur-${crypto.randomUUID().slice(0, 8)}`;

    // 1. Upsert into meme_curation table
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

    // 2. Trigger automatic consensus evaluation & state transition
    const consensusRes = await applyConsensus(env, memeId);

    return json({
      success: true,
      meme_id: memeId,
      user_id: userId,
      user_name: userName,
      corpus_status: corpusStatus,
      topics,
      tone,
      humour_mechanisms: mechanisms,
      consensus: consensusRes
    });
  } catch (err: unknown) {
    return handleD1Error(err, "Error saving curation decision");
  }
};
