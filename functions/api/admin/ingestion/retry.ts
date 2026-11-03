import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { getBatchStatus, hasIngestionSchema } from "../../../_shared/ingestion";

type RetryPayload = { job_ids?: string[] };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;
  if (!(await hasIngestionSchema(env.DB))) {
    return json({ error: "Durable ingestion is not available until migration 025 is applied to this D1 environment." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as RetryPayload;
    const jobIds = Array.isArray(body.job_ids)
      ? [...new Set(body.job_ids.map((id) => String(id).trim()).filter(Boolean))].slice(0, 50)
      : [];
    if (jobIds.length === 0) return json({ error: "job_ids must contain at least one job." }, { status: 400 });

    const placeholders = jobIds.map(() => "?").join(",");
    const jobs = await env.DB.prepare(
      `SELECT job_id, batch_id, state, upload_state FROM ingestion_jobs WHERE job_id IN (${placeholders})`
    ).bind(...jobIds).all<{ job_id: string; batch_id: string; state: string; upload_state: string }>();
    if ((jobs.results || []).length === 0) return json({ error: "No matching ingestion jobs were found." }, { status: 404 });

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    for (const job of jobs.results || []) {
      if (job.state === "human_ready") continue;
      statements.push(env.DB.prepare(`
        UPDATE ingestion_jobs
        SET state = 'queued', upload_state = CASE WHEN upload_state = 'uploaded' THEN 'uploaded' ELSE 'pending' END,
            error_code = NULL, error_message = NULL, next_attempt_at = NULL,
            lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE job_id = ?
      `).bind(now, job.job_id));
      statements.push(env.DB.prepare(`
        UPDATE ingestion_ai_evaluations
        SET state = CASE WHEN state = 'succeeded' THEN 'succeeded' ELSE 'pending' END,
            error_code = CASE WHEN state = 'succeeded' THEN error_code ELSE NULL END,
            error_message = CASE WHEN state = 'succeeded' THEN error_message ELSE NULL END,
            next_attempt_at = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE job_id = ?
      `).bind(now, job.job_id));
    }
    if (statements.length > 0) await env.DB.batch(statements);

    const batchIds = [...new Set((jobs.results || []).map((job) => job.batch_id))];
    const batches = [];
    for (const batchId of batchIds) {
      const status = await getBatchStatus(env, batchId);
      if (status) batches.push(status);
    }
    return json({ success: true, reset_jobs: jobIds.length, batches });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to reset ingestion jobs." }, { status: 400 });
  }
};
