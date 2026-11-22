/**
 * POST /api/curate/advisory-save
 * 
 * Atomically records an AI advisory evaluation from Judge 4 or Judge 5.
 * Persists the decision to ingestion_ai_evaluations and meme_curation.
 * When both Judge 4 and Judge 5 have evaluated the meme, transitions
 * ingestion_jobs to 'human_ready' and memes.status from 'draft' to 'archived'.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";
import { refreshBatchStatus } from "../../_shared/ingestion";
import { transitionMeme } from "../../_shared/corpus";

interface AdvisorySavePayload {
  meme_id: string;
  corpus_status: "keep" | "excluded" | "duplicate" | "review_later";
  duplicate_of?: string | null;
  topics?: string[];
  tone?: string | null;
  humour_mechanisms?: string[];
  curator_note?: string | null;
  confidence?: number;
  model?: string;
  latency_ms?: number;
  judge_key?: "judge4";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const sessionUser = await validateSession(request, env);
    if (!sessionUser) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: AdvisorySavePayload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const memeId = (payload.meme_id || "").trim();
    if (!memeId) {
      return json({ error: "meme_id is required" }, { status: 400 });
    }

    // Determine judge identity (Judge 5 is retired; user-judge4 is the sole AI Judge)
    let judgeKey: "judge4";
    let userId: string;
    let userName: string;


    if (sessionUser.id === "user-judge4" || sessionUser.username === "ai-judge" || sessionUser.username === "judge4" || payload.judge_key === "judge4") {
      judgeKey = "judge4";
      userId = "user-judge4";
      userName = "AI Judge";
    } else if (sessionUser.role === "superadmin") {
      judgeKey = "judge4";
      userId = "user-judge4";
      userName = "AI Judge";
    } else {
      return json({ error: "Only AI Judge or SuperAdmin may submit advisory evaluations." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const topicsJson = JSON.stringify(Array.isArray(payload.topics) ? payload.topics : []);
    const mechanismsJson = JSON.stringify(Array.isArray(payload.humour_mechanisms) ? payload.humour_mechanisms : []);
    const toneVal = payload.tone || null;
    const confidenceVal = typeof payload.confidence === "number" ? Math.max(0, Math.min(1, payload.confidence)) : 0.85;
    const reasoningVal = payload.curator_note || null;
    const modelVal = payload.model || "meta/llama-3.2-11b-vision-instruct";
    const decisionVal = payload.corpus_status || "keep";

    // 1. Locate the ingestion job if this is a durable intake meme
    const job = await env.DB.prepare(
      "SELECT * FROM ingestion_jobs WHERE meme_id = ? OR job_id = ?"
    ).bind(memeId, memeId).first<{
      job_id: string;
      batch_id: string;
      meme_id: string;
      storage_path: string | null;
      state: string;
    }>();

    const actualMemeId = job?.meme_id || memeId;
    const targetJobId = job?.job_id;

    // 2. If a durable job exists, record into ingestion_ai_evaluations
    if (targetJobId) {
      const evalId = `eval-${crypto.randomUUID()}`;
      await env.DB.prepare(`
        INSERT INTO ingestion_ai_evaluations (
          id, job_id, meme_id, judge_key, provider_key, model, state,
          decision, topics, tone, humour_mechanisms, confidence, reasoning,
          result_json, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'browser_runner', ?, 'succeeded', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id, judge_key) DO UPDATE SET
          state = 'succeeded',
          provider_key = 'browser_runner',
          model = excluded.model,
          decision = excluded.decision,
          topics = excluded.topics,
          tone = excluded.tone,
          humour_mechanisms = excluded.humour_mechanisms,
          confidence = excluded.confidence,
          reasoning = excluded.reasoning,
          result_json = excluded.result_json,
          finished_at = excluded.finished_at,
          error_code = NULL,
          error_message = NULL,
          lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = excluded.updated_at
      `).bind(
        evalId,
        targetJobId,
        actualMemeId,
        judgeKey,
        modelVal,
        decisionVal,
        topicsJson,
        toneVal,
        mechanismsJson,
        confidenceVal,
        reasoningVal,
        JSON.stringify({
          decision: decisionVal,
          topics: payload.topics || [],
          tone: toneVal,
          humour_mechanisms: payload.humour_mechanisms || [],
          confidence: confidenceVal,
          reasoning: reasoningVal,
          model: modelVal,
        }),
        now,
        now,
        now,
        now
      ).run();
    }

    // 3. Mirror the decision into meme_curation for multi-judge visibility
    const curId = `cur-${crypto.randomUUID().slice(0, 12)}`;
    await env.DB.prepare(`
      INSERT INTO meme_curation (
        id, meme_id, user_id, user_name, corpus_status, duplicate_of,
        topics, tone, humour_mechanisms, curator_note, reviewed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(meme_id, user_id) DO UPDATE SET
        corpus_status = excluded.corpus_status,
        duplicate_of = excluded.duplicate_of,
        topics = excluded.topics,
        tone = excluded.tone,
        humour_mechanisms = excluded.humour_mechanisms,
        curator_note = excluded.curator_note,
        reviewed_at = excluded.reviewed_at,
        updated_at = excluded.updated_at
    `).bind(
      curId,
      actualMemeId,
      userId,
      userName,
      decisionVal,
      payload.duplicate_of || null,
      topicsJson,
      toneVal,
      mechanismsJson,
      reasoningVal,
      now,
      now
    ).run();

    // 4. Check if both Judge 4 and Judge 5 evaluations are now succeeded
    let allAiCompleted = false;

    if (targetJobId) {
      const evalRows = await env.DB.prepare(
        "SELECT judge_key, state, decision, topics, tone, humour_mechanisms, confidence, reasoning, model, result_json FROM ingestion_ai_evaluations WHERE job_id = ?"
      ).bind(targetJobId).all<{
        judge_key: string;
        state: string;
        decision: string;
        topics: string;
        tone: string;
        humour_mechanisms: string;
        confidence: number;
        reasoning: string;
        model: string;
        result_json: string;
      }>();

      const evaluations = evalRows.results || [];
      const hasJ4 = evaluations.some((e) => e.judge_key === "judge4" && e.state === "succeeded");

      if (hasJ4) {
        allAiCompleted = true;

        // Transition job state to 'human_ready'
        await env.DB.prepare(`
          UPDATE ingestion_jobs
          SET state = 'human_ready', completed_at = ?, error_code = NULL, error_message = NULL,
              next_attempt_at = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
          WHERE job_id = ?
        `).bind(now, now, targetJobId).run();

        // Promote meme from 'draft' to 'archive' via authoritative state writer (Step 4)
        try {
          await transitionMeme(env, actualMemeId, "archive", {
            actor: "ai-judge",
            reason: "ai_review_success",
            expectedFrom: "draft"
          });
        } catch (transErr) {
          console.warn("Could not transition meme to archive:", transErr);
        }

        // Populate legacy/human advisory predictions table
        const preview = evaluations.find((e) => e.judge_key === "judge4") || evaluations[0];
        if (preview) {
          try {
            await env.DB.prepare(`
              INSERT INTO ai_curation_predictions (
                meme_id, storage_path, image_url, corpus_status, topics, tone,
                humour_mechanisms, confidence, reasoning, model, tokens_used,
                processing_ms, raw_response, error, created_at, updated_at
              ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, ?, ?)
              ON CONFLICT(meme_id) DO UPDATE SET
                storage_path = excluded.storage_path,
                corpus_status = excluded.corpus_status,
                topics = excluded.topics,
                tone = excluded.tone,
                humour_mechanisms = excluded.humour_mechanisms,
                confidence = excluded.confidence,
                reasoning = excluded.reasoning,
                model = excluded.model,
                processing_ms = excluded.processing_ms,
                updated_at = excluded.updated_at
            `).bind(
              actualMemeId,
              job?.storage_path || null,
              preview.decision,
              preview.topics,
              preview.tone,
              preview.humour_mechanisms,
              preview.confidence || 0.85,
              preview.reasoning,
              preview.model,
              payload.latency_ms || 0,
              now,
              now
            ).run();
          } catch {
            // Non-critical if table absent or conflict
          }
        }

        // Refresh batch status in D1
        if (job?.batch_id) {
          await refreshBatchStatus(env.DB, job.batch_id).catch(() => {});
        }
      }
    }

    return json({
      success: true,
      meme_id: actualMemeId,
      judge_key: judgeKey,
      all_ai_completed: allAiCompleted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error saving advisory evaluation";
    return json({ error: message }, { status: 500 });
  }
};

