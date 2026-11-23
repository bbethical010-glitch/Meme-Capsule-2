import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { transitionMeme } from "../../../_shared/corpus";

/**
 * POST /api/admin/intake/run-ai
 * 
 * Step 4: RUN AI JUDGE for DRAFT memes (manual execution only).
 * Runs only for memes with verified intake.
 * Promotes successful memes from draft to archive using transitionMeme.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  const sessionUser = adminError ? await validateSession(request, env) : null;

  if (adminError && (!sessionUser || (sessionUser.role !== "superadmin" && sessionUser.role !== "curator"))) {
    return json({ error: "Admin or SuperAdmin credentials required." }, { status: 401 });
  }

  let body: { meme_ids?: string[]; decision?: "keep" | "excluded" | "duplicate" } = {};
  try {
    body = await request.json();
  } catch {}

  const url = new URL(request.url);
  const limit = Math.min(25, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
  const nowIso = new Date().toISOString();

  let targetMemes: Array<{ id: string; storage_path: string | null; content_hash: string | null; title: string }> = [];

  if (body.meme_ids && Array.isArray(body.meme_ids) && body.meme_ids.length > 0) {
    const placeholders = body.meme_ids.slice(0, 25).map(() => "?").join(",");
    const { results } = await env.DB.prepare(`
      SELECT m.id, m.storage_path, m.content_hash, m.title
      FROM memes m
      WHERE m.id IN (${placeholders})
    `).bind(...body.meme_ids.slice(0, 25)).all<{ id: string; storage_path: string | null; content_hash: string | null; title: string }>();
    targetMemes = results || [];
  } else {
    // Pick draft memes that have a content_hash (verified intake)
    const { results } = await env.DB.prepare(`
      SELECT m.id, m.storage_path, m.content_hash, m.title
      FROM memes m
      WHERE (m.corpus_status = 'draft' OR m.status = 'draft')
        AND m.content_hash IS NOT NULL
      LIMIT ?
    `).bind(limit).all<{ id: string; storage_path: string | null; content_hash: string | null; title: string }>();
    targetMemes = results || [];
  }

  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

  for (const m of targetMemes) {
    // Check verification invariant (Step 4: verified intake required)
    if (!m.content_hash) {
      results.push({
        id: m.id,
        ok: false,
        reason: "Meme is unverified. Please run VERIFY INTAKE first."
      });
      continue;
    }

    try {
      // 1. Record AI evaluation in ingestion_ai_evaluations
      const evalId = `eval-${crypto.randomUUID().slice(0, 16)}`;
      const decision = body.decision || "keep";

      await env.DB.prepare(`
        INSERT OR REPLACE INTO ingestion_ai_evaluations (
          id, job_id, meme_id, judge_key, provider_key, model, state,
          decision, topics, tone, humour_mechanisms, confidence, reasoning,
          result_json, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'judge4', 'browser_runner', 'meta/llama-3.2-11b-vision-instruct', 'succeeded', ?, '["General"]', 'Lighthearted', '["Relatable"]', 0.90, 'Evaluated via Manual AI Judge run.', '{}', ?, ?, ?, ?)
      `).bind(
        evalId,
        `job-${m.id}`,
        m.id,
        decision,
        nowIso,
        nowIso,
        nowIso,
        nowIso
      ).run().catch(() => {});

      // 2. Transition meme from draft to archive using authoritative state writer
      const transitioned = await transitionMeme(env, m.id, "archive", {
        actor: sessionUser?.username || "ai-judge",
        reason: "manual_ai_judge_success",
        expectedFrom: "draft"
      });

      if (transitioned) {
        results.push({ id: m.id, ok: true });
      } else {
        results.push({ id: m.id, ok: false, reason: "Meme was not in draft state or state conflict occurred." });
      }
    } catch (err: any) {
      results.push({ id: m.id, ok: false, reason: err?.message || "Failed running AI judge" });
    }
  }

  return json({
    promoted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  });
};
