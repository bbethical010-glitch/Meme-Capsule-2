/**
 * POST /api/curate/approve
 *
 * Stores the submitting judge's independent vote. Only after Judges 1, 2, and 3
 * have each voted does this endpoint compute a majority or defer to arbitration.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, handleD1Error, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";
import { ensureCurationTables } from "../../_shared/curateDb";
import { hardRemoveMeme } from "../../_shared/forceRemove";
import { resolveHumanConsensus, type AiFallback, type HumanVote } from "../../_shared/curationConsensus";

interface ApprovePayload {
  meme_id?: string;
  corpus_status?: "keep" | "excluded" | "duplicate" | "review_later";
  duplicate_of?: string;
  topics?: string[];
  tone?: string;
  humour_mechanisms?: string[];
  curator_note?: string;
  user_id?: string;
  user_name?: string;
  adopted_from?: "judge4" | "judge5" | "consensus" | "manual";
}

interface JudgeIdentity {
  id: string;
  username: string;
  display_name: string;
}

interface CurationRow extends HumanVote {
  user_name: string;
  topics: string[];
  tone: string | null;
  humour_mechanisms: string[];
  curator_note: string | null;
}

interface StoredCurationRow {
  user_id: string;
  user_name: string;
  corpus_status: HumanVote["corpus_status"];
  duplicate_of: string | null;
  topics: string | null;
  tone: string | null;
  humour_mechanisms: string | null;
  curator_note: string | null;
}

function parseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
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
    if (!corpusStatus || !["keep", "excluded", "duplicate", "review_later"].includes(corpusStatus)) {
      return json({ error: "corpus_status must be 'keep', 'excluded', 'duplicate', or 'review_later'." }, { status: 400 });
    }

    const { results: judgeRows } = await env.DB.prepare(`
      SELECT id, username, display_name
      FROM cat_users
      WHERE role = 'judge' AND username IN (?, ?, ?, ?, ?)
    `).bind("judge1", "judge2", "judge3", "judge4", "judge5").all<JudgeIdentity>();
    const judgeByUsername = new Map((judgeRows || []).map((judge) => [judge.username, judge]));
    const humanJudges = ["judge1", "judge2", "judge3"].map((username) => judgeByUsername.get(username));
    if (humanJudges.some((judge) => !judge)) {
      return json({ error: "The three configured human judges are not present in cat_users." }, { status: 503 });
    }
    const humanJudgeIdentities = humanJudges as JudgeIdentity[];
    const humanJudgeIds = humanJudgeIdentities.map((judge) => judge.id);
    const judge4 = judgeByUsername.get("judge4");
    const judge5 = judgeByUsername.get("judge5");

    if (sessionUser && (sessionUser.role !== "judge" || !humanJudgeIds.includes(sessionUser.id))) {
      return json({ error: "Only Judges 1, 2, or 3 may submit a human curation vote." }, { status: 403 });
    }
    const userId = sessionUser?.id || (body.user_id ? body.user_id.trim() : humanJudgeIds[0]);
    if (!humanJudgeIds.includes(userId)) {
      return json({ error: "A configured human judge identity is required." }, { status: 403 });
    }
    const userName = sessionUser?.display_name ||
      humanJudgeIdentities.find((judge) => judge.id === userId)?.display_name ||
      (body.user_name && body.user_name.trim() !== "Judge" ? body.user_name.trim() : "Judge");

    const topics = (Array.isArray(body.topics) ? body.topics : []).filter(Boolean).slice(0, 3);
    const tone = (body.tone || "").trim() || null;
    const mechanisms = (Array.isArray(body.humour_mechanisms) ? body.humour_mechanisms : []).filter(Boolean).slice(0, 2);
    const duplicateOf = (body.duplicate_of || "").trim() || null;
    const curatorNote = (body.curator_note || "").trim() || null;
    const now = new Date().toISOString();

    const stmtCuration = env.DB.prepare(`
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
      `cur-${crypto.randomUUID().slice(0, 8)}`,
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
      now,
    );

    const aiJudgeIds = [judge4?.id, judge5?.id].filter((id): id is string => Boolean(id));
    const voteIds = [...humanJudgeIds, ...aiJudgeIds];
    const placeholders = voteIds.map(() => "?").join(", ");
    const stmtVotes = env.DB.prepare(`
      SELECT user_id, user_name, corpus_status, duplicate_of, topics, tone, humour_mechanisms, curator_note
      FROM meme_curation
      WHERE meme_id = ? AND user_id IN (${placeholders})
    `).bind(memeId, ...voteIds);

    // D1 batches execute in order as one transaction. Keeping the upsert and
    // count read together prevents two concurrent final judges from both
    // observing only two votes and leaving a fully-voted meme unfinalized.
    const voteBatch = await env.DB.batch([stmtCuration, stmtVotes]);
    const rows = (voteBatch[1]?.results || []) as StoredCurationRow[];
    const votes: CurationRow[] = rows
      .filter((row) => humanJudgeIds.includes(row.user_id))
      .map((row) => ({
        user_id: row.user_id,
        user_name: row.user_name,
        corpus_status: row.corpus_status,
        duplicate_of: row.duplicate_of,
        topics: parseArray(row.topics),
        tone: row.tone,
        humour_mechanisms: parseArray(row.humour_mechanisms),
        curator_note: row.curator_note,
      }));

    if (votes.length < 3) {
      return json({
        success: true,
        meme_id: memeId,
        user_id: userId,
        user_name: userName,
        corpus_status: corpusStatus,
        votes_received: votes.length,
        votes_required: 3,
        is_final: false,
        outcome: "pending",
      });
    }

    const aiRow = (id?: string): StoredCurationRow | undefined => rows.find((row) => row.user_id === id);
    const aiDecision = (row?: StoredCurationRow) => row ? {
      topics: parseArray(row.topics),
      tone: row.tone,
      humour_mechanisms: parseArray(row.humour_mechanisms),
    } : null;
    const ai: AiFallback = {
      judge4: aiDecision(aiRow(judge4?.id)),
      judge5: aiDecision(aiRow(judge5?.id)),
    };
    const consensus = resolveHumanConsensus(votes, ai);

    if (consensus.kind === "arbitration") {
      return json({
        success: true,
        meme_id: memeId,
        user_id: userId,
        votes_received: votes.length,
        votes_required: 3,
        is_final: false,
        outcome: "arbitration",
        arbitration_reason: consensus.reason,
      });
    }

    if (consensus.kind === "pending") {
      return json({ success: true, meme_id: memeId, votes_received: votes.length, votes_required: 3, is_final: false, outcome: "pending" });
    }

    const isHardRemove = consensus.kind === "hard_remove";
    const resolvedStatus = consensus.corpus_status;
    const resolvedTopics = isHardRemove ? [] : consensus.topics;
    const resolvedTone = isHardRemove ? null : consensus.tone;
    const resolvedMechanisms = isHardRemove ? [] : consensus.humour_mechanisms;
    const resolvedDuplicateOf = isHardRemove ? null : consensus.duplicate_of;
    const adoptedTag = body.adopted_from ? `; latest vote adopted ${body.adopted_from}` : "";
    const resolvedBy = `3-Judge Majority (${humanJudgeIdentities.map((judge) => judge.display_name).join(", ")})${adoptedTag}`;
    const isActive = resolvedStatus === "keep" ? 1 : 0;
    const newStatus = resolvedStatus === "keep" ? "active" : "archived";
    const statements: D1PreparedStatement[] = [];

    if (resolvedStatus === "keep" || resolvedStatus === "excluded") {
      statements.push(env.DB.prepare(`
        INSERT INTO meme_curation_final (
          meme_id, corpus_status, duplicate_of, topics, tone, humour_mechanisms,
          curator_note, resolved_by, resolved_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(meme_id) DO UPDATE SET
          corpus_status = excluded.corpus_status,
          duplicate_of = excluded.duplicate_of,
          topics = excluded.topics,
          tone = excluded.tone,
          humour_mechanisms = excluded.humour_mechanisms,
          curator_note = excluded.curator_note,
          resolved_by = excluded.resolved_by,
          resolved_at = excluded.resolved_at,
          updated_at = excluded.updated_at
      `).bind(
        memeId,
        resolvedStatus,
        resolvedDuplicateOf,
        JSON.stringify(resolvedTopics),
        resolvedTone,
        JSON.stringify(resolvedMechanisms),
        curatorNote,
        resolvedBy,
        now,
        now,
      ));
    }

    if (resolvedStatus === "keep" && resolvedTopics.length > 0) {
      statements.push(env.DB.prepare(`
        UPDATE memes
        SET is_active = ?, status = ?, curation_status = ?, duplicate_of = ?, topics = ?, tone = ?, humour_mechanisms = ?, tags = ?, category = COALESCE(?, category)
        WHERE id = ?
      `).bind(isActive, newStatus, resolvedStatus, resolvedDuplicateOf, JSON.stringify(resolvedTopics), resolvedTone, JSON.stringify(resolvedMechanisms), JSON.stringify(resolvedTopics), resolvedTopics[0], memeId));
    } else {
      statements.push(env.DB.prepare(`
        UPDATE memes
        SET is_active = ?, status = ?, curation_status = ?, duplicate_of = ?, topics = ?, tone = ?, humour_mechanisms = ?
        WHERE id = ?
      `).bind(isActive, newStatus, resolvedStatus, resolvedDuplicateOf, JSON.stringify(resolvedTopics), resolvedTone, JSON.stringify(resolvedMechanisms), memeId));
    }

    await env.DB.batch(statements);
    if (isHardRemove) {
      await hardRemoveMeme(env, memeId, "Unanimous 3:0 excluded by Judges 1, 2, and 3");
    }

    return json({
      success: true,
      meme_id: memeId,
      user_id: userId,
      user_name: userName,
      corpus_status: resolvedStatus,
      topics: resolvedTopics,
      tone: resolvedTone,
      humour_mechanisms: resolvedMechanisms,
      duplicate_of: resolvedDuplicateOf,
      votes_received: 3,
      votes_required: 3,
      is_final: true,
      outcome: isHardRemove ? "hard_removed" : "finalized",
    });
  } catch (err: unknown) {
    return handleD1Error(err, "Error approving curation decision");
  }
};
