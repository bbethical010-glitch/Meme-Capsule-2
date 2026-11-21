import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";

/**
 * Rejected files list inside the integrity system.
 * Shows rejected jobs with reject reason and matched meme.
 * DELETE action removes R2 object and logs to meme_purge_log with explicit confirmation.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const { results } = await env.DB.prepare(`
    SELECT job_id, meme_id, original_filename, storage_path, content_hash,
           byte_size, mime_type, reject_reason, matched_meme_id, created_at
    FROM ingestion_jobs
    WHERE state = 'failed'
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  return json({
    rejectedJobs: results || []
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const body = await request.json().catch(() => ({})) as { jobId?: string; confirm?: boolean };
  if (!body.jobId || !body.confirm) {
    return json({ error: "Explicit confirmation and jobId required to delete rejected intake file." }, { status: 400 });
  }

  const job = await env.DB.prepare(`
    SELECT job_id, storage_path, content_hash FROM ingestion_jobs WHERE job_id = ? AND state = 'failed'
  `).bind(body.jobId).first<{ job_id: string; storage_path: string | null; content_hash: string | null }>();

  if (!job) {
    return json({ error: "Rejected job not found." }, { status: 404 });
  }

  if (job.storage_path) {
    await env.MEMES_BUCKET.delete(job.storage_path.replace(/^\/+/, ""));
  }

  // Audit log in meme_purge_log
  await env.DB.prepare(`
    INSERT INTO meme_purge_log (meme_id, content_hash, reason, actor, detail, purged_at)
    VALUES (?, ?, 'rejected_file_purge', 'admin', ?, CURRENT_TIMESTAMP)
  `).bind(
    job.job_id,
    job.content_hash || "unknown",
    `Purged rejected file at ${job.storage_path || "none"}`
  ).run();

  await env.DB.prepare("DELETE FROM ingestion_jobs WHERE job_id = ?").bind(body.jobId).run();

  return json({
    success: true,
    purgedJobId: body.jobId
  });
};
