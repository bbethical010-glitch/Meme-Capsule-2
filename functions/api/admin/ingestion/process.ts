import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { decryptApiKey } from "../../../_shared/crypto";
import {
  INGESTION_LEASE_MS,
  INGESTION_MAX_AI_ATTEMPTS,
  boundError,
  getBatchStatus,
  hasIngestionSchema,
  refreshBatchStatus,
  type IngestionEvaluationRow,
  type IngestionJobRow
} from "../../../_shared/ingestion";

const TOPICS = [
  "Everyday Life", "Work / Education", "Relationships", "Family", "Politics / Society",
  "Internet Culture", "Pop Culture", "Gaming", "Animals", "Food", "Technology", "Other"
];
const TONES = ["Wholesome", "Dark", "Chaotic", "Cynical", "Awkward", "Neutral"];
const MECHANISMS = ["Relatability", "Absurdity", "Irony", "Satire", "Exaggeration", "Cringe", "Dark Humour", "Parody", "Surrealism"];
const DECISIONS = ["keep", "excluded", "duplicate", "review_later"];

type PresetRow = {
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
  settings: string | null;
};

type AiResult = {
  decision: string;
  topics: string[];
  tone: string;
  humour_mechanisms: string[];
  confidence: number;
  reasoning: string;
  raw_response: string;
  tokens_used: number;
};

class EvaluationError extends Error {
  code: string;
  retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const parseBody = async (request: Request) => {
  try {
    return (await request.json()) as { job_id?: string };
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
};

const extractJson = (text: string): Record<string, unknown> => {
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        // Fall through to the bounded validation error.
      }
    }
    throw new EvaluationError("The model returned invalid JSON.", "invalid_response", false);
  }
};

const validateResult = (raw: Record<string, unknown>, rawResponse: string, tokensUsed: number): AiResult => {
  const topics = Array.isArray(raw.topics)
    ? raw.topics.filter((value): value is string => typeof value === "string")
    : [];
  const mechanisms = Array.isArray(raw.humour_mechanisms)
    ? raw.humour_mechanisms.filter((value): value is string => typeof value === "string")
    : [];
  const tone = typeof raw.tone === "string" ? raw.tone : "";
  const decision = raw.decision === "exclude"
    ? "excluded"
    : raw.decision === "later"
    ? "review_later"
    : typeof raw.decision === "string"
    ? raw.decision
    : "";
  const confidence = typeof raw.confidence === "number" ? Math.min(1, Math.max(0, raw.confidence)) : NaN;
  if (
    topics.length < 1 || topics.length > 3 || topics.some((value) => !TOPICS.includes(value)) ||
    !TONES.includes(tone) || mechanisms.length < 1 || mechanisms.length > 2 || mechanisms.some((value) => !MECHANISMS.includes(value)) ||
    !DECISIONS.includes(decision) || !Number.isFinite(confidence)
  ) {
    throw new EvaluationError("The model response did not match the required taxonomy.", "invalid_response", false);
  }
  if (typeof raw.reasoning !== "string" || !raw.reasoning.trim()) {
    throw new EvaluationError("The model response is missing reasoning.", "invalid_response", false);
  }
  return {
    decision,
    topics,
    tone,
    humour_mechanisms: mechanisms,
    confidence,
    reasoning: raw.reasoning.trim().slice(0, 500),
    raw_response: rawResponse.slice(0, 4000),
    tokens_used: Number.isFinite(tokensUsed) ? Math.max(0, Math.floor(tokensUsed)) : 0
  };
};

const resolveEndpoint = (baseUrl: string) => {
  let value = baseUrl.trim().replace(/\/+$/, "");
  const lower = value.toLowerCase();
  if (lower.includes("generativelanguage.googleapis.com")) {
    return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }
  if (lower.includes("groq.com") && !lower.includes("/openai/v1")) {
    value = "https://api.groq.com/openai/v1";
  }
  if (lower.includes("/chat/completions")) return value;
  if (lower.includes("integrate.api.nvidia.com") && !lower.includes("/v1")) value += "/v1";
  if (lower.includes("openrouter.ai") && !lower.includes("/api/v1")) value += "/api/v1";
  return `${value}/chat/completions`;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const buildPrompt = () => `You are an advisory meme-culture pre-evaluator for Meme Capsule. Analyse this single image independently and return only JSON.
TOPICS: ${TOPICS.join(", ")}
TONES: ${TONES.join(", ")}
HUMOUR MECHANISMS: ${MECHANISMS.join(", ")}
DECISION: keep, excluded, duplicate, or review_later.
Use 1-3 topics, exactly one tone, 1-2 humour mechanisms, confidence from 0 to 1, and one short rationale.
JSON shape: {"topics":["Everyday Life"],"tone":"Neutral","humour_mechanisms":["Relatability"],"decision":"keep","confidence":0.85,"reasoning":"One short sentence."}`;

const loadPreset = async (env: Env, judgeKey: "judge4" | "judge5") => {
  const username = judgeKey;
  const row = await env.DB.prepare(`
    SELECT p.provider, p.base_url, p.api_key, p.model, p.settings
    FROM cat_judge_ai_presets p
    JOIN cat_users u ON u.id = p.user_id
    WHERE u.username = ? AND u.role = 'judge' AND u.is_active = 1
    ORDER BY p.updated_at DESC
    LIMIT 1
  `).bind(username).first<PresetRow>().catch(() => null);

  if (!row?.api_key || !row.base_url || !row.model) {
    throw new EvaluationError(`${judgeKey} has no configured advisory AI preset.`, "configuration_missing", false);
  }

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(row.settings || "{}");
  } catch {
    settings = {};
  }
  const secretSeed = env.ADMIN_API_TOKEN || "meme-capsule-secret-token";
  const apiKey = await decryptApiKey(row.api_key, secretSeed);
  if (!apiKey) throw new EvaluationError(`${judgeKey} AI credential is empty.`, "configuration_missing", false);
  return {
    provider: row.provider,
    baseUrl: row.base_url,
    apiKey,
    model: row.model,
    temperature: typeof settings.temperature === "number" ? Math.min(1, Math.max(0, settings.temperature)) : 0
  };
};

const evaluateWithPreset = async (env: Env, job: IngestionJobRow, judgeKey: "judge4" | "judge5", bytes: Uint8Array): Promise<AiResult & { provider: string; model: string }> => {
  const preset = await loadPreset(env, judgeKey);
  const endpoint = resolveEndpoint(preset.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${preset.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(endpoint.includes("generativelanguage.googleapis.com") ? { "x-goog-api-key": preset.apiKey } : {})
    },
    body: JSON.stringify({
      model: preset.model,
      temperature: preset.temperature,
      max_tokens: 400,
      stream: false,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: buildPrompt() },
          { type: "image_url", image_url: { url: `data:${job.mime_type};base64,${toBase64(bytes)}`, detail: "low" } }
        ]
      }]
    }),
    signal: AbortSignal.timeout(30_000)
  }).catch((error: unknown) => {
    throw new EvaluationError(
      error instanceof Error ? error.message : "The advisory AI provider could not be reached.",
      "provider_network",
      true
    );
  });

  const payload = await response.json().catch(() => ({})) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
    error?: { message?: string } | string;
  };
  if (!response.ok) {
    const providerMessage = typeof payload.error === "string" ? payload.error : payload.error?.message;
    throw new EvaluationError(
      providerMessage || `Advisory AI provider returned HTTP ${response.status}.`,
      `provider_http_${response.status}`,
      response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
    );
  }

  const rawResponse = payload.choices?.[0]?.message?.content || "";
  const result = validateResult(extractJson(rawResponse), rawResponse, payload.usage?.total_tokens || 0);
  return { ...result, provider: preset.provider, model: preset.model };
};

const claimJob = async (env: Env, jobId: string, now: string, leaseExpiresAt: string) => {
  const result = await env.DB.prepare(`
    UPDATE ingestion_jobs
    SET state = 'processing', attempt_count = attempt_count + 1,
        last_attempt_at = ?, lease_owner = ?, lease_expires_at = ?,
        error_code = NULL, error_message = NULL, updated_at = ?
    WHERE job_id = ? AND upload_state = 'uploaded'
      AND (
        (state = 'queued' OR (state = 'retry_wait' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)))
        OR (state = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?)
      )
  `).bind(now, `processor-${crypto.randomUUID()}`, leaseExpiresAt, now, jobId, now, now).run();
  return Number(result.meta?.changes || 0) > 0;
};

const claimEvaluation = async (env: Env, evaluation: IngestionEvaluationRow, now: string, leaseExpiresAt: string) => {
  const result = await env.DB.prepare(`
    UPDATE ingestion_ai_evaluations
    SET state = 'processing', attempt_count = attempt_count + 1,
        started_at = ?, lease_owner = ?, lease_expires_at = ?, updated_at = ?
    WHERE id = ?
      AND (
        (state IN ('pending', 'retry_wait') AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
        OR (state = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?)
      )
  `).bind(now, `processor-${crypto.randomUUID()}`, leaseExpiresAt, now, evaluation.id, now, now).run();
  return Number(result.meta?.changes || 0) > 0;
};

const recordEvaluationFailure = async (env: Env, evaluation: IngestionEvaluationRow, error: unknown) => {
  const failure = error instanceof EvaluationError
    ? error
    : new EvaluationError(boundError(error, "Advisory AI evaluation failed."), "evaluation_failed", true);
  const retryable = failure.retryable && evaluation.attempt_count < INGESTION_MAX_AI_ATTEMPTS;
  const state = retryable ? "retry_wait" : "failed";
  const nextAttempt = retryable
    ? new Date(Date.now() + Math.min(15 * 60_000, 2 ** Math.max(0, evaluation.attempt_count - 1) * 30_000)).toISOString()
    : null;
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE ingestion_ai_evaluations
    SET state = ?, error_code = ?, error_message = ?, next_attempt_at = ?,
        finished_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
    WHERE id = ?
  `).bind(state, failure.code, boundError(failure), nextAttempt, now, now, evaluation.id).run();
};

const recordEvaluationSuccess = async (env: Env, evaluation: IngestionEvaluationRow, result: AiResult & { provider: string; model: string }) => {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE ingestion_ai_evaluations
    SET state = 'succeeded', provider_key = ?, model = ?, decision = ?, topics = ?,
        tone = ?, humour_mechanisms = ?, confidence = ?, reasoning = ?, result_json = ?,
        error_code = NULL, error_message = NULL, next_attempt_at = NULL,
        finished_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
    WHERE id = ?
  `).bind(
    result.provider,
    result.model,
    result.decision,
    JSON.stringify(result.topics),
    result.tone,
    JSON.stringify(result.humour_mechanisms),
    result.confidence,
    result.reasoning,
    JSON.stringify({ ...result, provider: undefined, model: undefined }),
    now,
    now,
    evaluation.id
  ).run();
};

const writeLegacyAdvisoryPreview = async (env: Env, job: IngestionJobRow, evaluation: IngestionEvaluationRow) => {
  try {
    await env.DB.prepare(`
      INSERT INTO ai_curation_predictions (
        meme_id, storage_path, image_url, corpus_status, topics, tone,
        humour_mechanisms, confidence, reasoning, model, tokens_used,
        processing_ms, raw_response, error, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(meme_id) DO UPDATE SET
        storage_path = excluded.storage_path,
        corpus_status = excluded.corpus_status,
        topics = excluded.topics,
        tone = excluded.tone,
        humour_mechanisms = excluded.humour_mechanisms,
        confidence = excluded.confidence,
        reasoning = excluded.reasoning,
        model = excluded.model,
        tokens_used = excluded.tokens_used,
        processing_ms = excluded.processing_ms,
        raw_response = excluded.raw_response,
        error = NULL,
        updated_at = excluded.updated_at
    `).bind(
      job.meme_id,
      job.storage_path,
      evaluation.decision,
      evaluation.topics,
      evaluation.tone,
      evaluation.humour_mechanisms,
      evaluation.confidence || 0,
      evaluation.reasoning,
      evaluation.model,
      0,
      0,
      evaluation.result_json,
      new Date().toISOString(),
      new Date().toISOString()
    ).run();
  } catch {
    // The legacy advisory preview table is optional. Durable evaluation rows
    // remain the readiness source and are never replaced by this compatibility write.
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;
  if (!(await hasIngestionSchema(env.DB))) {
    return json({ error: "Durable ingestion is not available until migration 025 is applied to this D1 environment." }, { status: 503 });
  }

  let activeJobId = "";
  let activeBatchId = "";
  try {
    const body = await parseBody(request);
    const jobId = (body.job_id || "").trim();
    activeJobId = jobId;
    if (!jobId) return json({ error: "job_id is required." }, { status: 400 });

    const job = await env.DB.prepare("SELECT * FROM ingestion_jobs WHERE job_id = ?")
      .bind(jobId)
      .first<IngestionJobRow>();
    if (!job) return json({ error: "Ingestion job not found." }, { status: 404 });
    activeBatchId = job.batch_id;
    if (job.state === "human_ready") {
      const status = await getBatchStatus(env, job.batch_id);
      return status ? json(status) : json({ error: "Batch could not be read." }, { status: 503 });
    }
    if (job.upload_state !== "uploaded" || !job.storage_path) {
      return json({ error: "Upload the image before starting advisory processing." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + INGESTION_LEASE_MS).toISOString();
    if (!(await claimJob(env, jobId, now, leaseExpiresAt))) {
      const current = await env.DB.prepare("SELECT state FROM ingestion_jobs WHERE job_id = ?")
        .bind(jobId)
        .first<{ state: string }>();
      if (current?.state === "processing") return json({ success: true, busy: true, job_id: jobId });
      return json({ error: "This job is not ready to be claimed. Retry the item after its next attempt time." }, { status: 409 });
    }

    const object = await env.MEMES_BUCKET.get(job.storage_path);
    if (!object?.body) throw new EvaluationError("The uploaded R2 object could not be read.", "media_missing", true);
    const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
    const evaluations = await env.DB.prepare(
      "SELECT * FROM ingestion_ai_evaluations WHERE job_id = ? ORDER BY judge_key ASC"
    ).bind(jobId).all<IngestionEvaluationRow>();

    for (const evaluation of evaluations.results || []) {
      if (evaluation.state === "succeeded") continue;
      const evaluationNow = new Date().toISOString();
      const evaluationLease = new Date(Date.now() + INGESTION_LEASE_MS).toISOString();
      if (!(await claimEvaluation(env, evaluation, evaluationNow, evaluationLease))) continue;

      const claimed = await env.DB.prepare("SELECT * FROM ingestion_ai_evaluations WHERE id = ?")
        .bind(evaluation.id)
        .first<IngestionEvaluationRow>();
      if (!claimed) continue;
      try {
        const result = await evaluateWithPreset(env, job, claimed.judge_key, bytes);
        await recordEvaluationSuccess(env, claimed, result);
      } catch (error) {
        await recordEvaluationFailure(env, claimed, error);
      }
    }

    const finalEvaluations = await env.DB.prepare(
      "SELECT * FROM ingestion_ai_evaluations WHERE job_id = ? ORDER BY judge_key ASC"
    ).bind(jobId).all<IngestionEvaluationRow>();
    const finalRows = finalEvaluations.results || [];
    const allSucceeded = finalRows.length === 2 && finalRows.every((evaluation) => evaluation.state === "succeeded");
    if (allSucceeded) {
      await env.DB.prepare(`
        UPDATE ingestion_jobs
        SET state = 'human_ready', completed_at = ?, error_code = NULL, error_message = NULL,
            next_attempt_at = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE job_id = ?
      `).bind(new Date().toISOString(), new Date().toISOString(), jobId).run();
      const preview = finalRows.find((evaluation) => evaluation.judge_key === "judge4") || finalRows[0];
      if (preview) await writeLegacyAdvisoryPreview(env, job, preview);
    } else {
      const hasTerminalFailure = finalRows.some((evaluation) => evaluation.state === "failed");
      const hasRetry = finalRows.some((evaluation) => evaluation.state === "retry_wait" || evaluation.state === "pending");
      await env.DB.prepare(`
        UPDATE ingestion_jobs
        SET state = ?, error_code = ?, error_message = ?, lease_owner = NULL,
            lease_expires_at = NULL, updated_at = ?
        WHERE job_id = ?
      `).bind(
        hasTerminalFailure ? "failed" : hasRetry ? "retry_wait" : "queued",
        hasTerminalFailure ? "advisory_evaluation_failed" : "advisory_evaluation_pending",
        hasTerminalFailure ? "One or more advisory evaluations failed. Retry the failed item after correcting its configuration." : "One or more advisory evaluations are waiting for another attempt.",
        new Date().toISOString(),
        jobId
      ).run();
    }

    await refreshBatchStatus(env.DB, job.batch_id);
    const status = await getBatchStatus(env, job.batch_id);
    return status ? json(status) : json({ error: "Batch could not be read after processing." }, { status: 503 });
  } catch (error) {
    if (activeJobId) {
      const message = boundError(error, "Ingestion processing failed.");
      await env.DB.prepare(`
        UPDATE ingestion_jobs
        SET state = 'retry_wait', error_code = 'processor_failed', error_message = ?,
            next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE job_id = ? AND state = 'processing'
      `).bind(message, new Date(Date.now() + 30_000).toISOString(), new Date().toISOString(), activeJobId).run().catch(() => undefined);
      if (activeBatchId) await refreshBatchStatus(env.DB, activeBatchId).catch(() => undefined);
    }
    return json({ error: boundError(error, "Unable to process ingestion job."), retryable: true }, { status: 500 });
  }
};
