import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { verifyObject, sanitizeFilename } from "../../../_shared/intake";

/**
 * Legacy intake backfill (manual, resumable, 25 per request).
 * Verifies R2 objects for existing memes without an intake job or content_hash,
 * writes ingestion_jobs row (source = 'legacy'), and populates content_hash.
 * Does NOT alter corpus_status.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const res = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM memes m
      LEFT JOIN ingestion_jobs j ON m.id = j.meme_id
      WHERE m.storage_path IS NOT NULL
        AND (m.content_hash IS NULL OR j.id IS NULL)
    `).first<{ cnt: number }>();

    return json({
      unverifiedCount: res?.cnt || 0
    });
  } catch {
    return json({ unverifiedCount: 0 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const limit = Math.min(25, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));

  let batchMemes: Array<{ id: string; storage_path: string; title: string; uploaded_at: string }> = [];
  try {
    const { results } = await env.DB.prepare(`
      SELECT m.id, m.storage_path, m.title, m.uploaded_at FROM memes m
      LEFT JOIN ingestion_jobs j ON m.id = j.meme_id
      WHERE m.storage_path IS NOT NULL
        AND (m.content_hash IS NULL OR j.id IS NULL)
      LIMIT ?
    `).bind(limit).all<{ id: string; storage_path: string; title: string; uploaded_at: string }>();
    batchMemes = results || [];
  } catch {
    batchMemes = [];
  }

  const memes = batchMemes || [];
  const results: Array<{ id: string; ok: boolean; sha256?: string; reason?: string }> = [];

  const nowIso = new Date().toISOString();

  for (const m of memes) {
    const cleanPath = m.storage_path.replace(/^\/+/, "");
    const verification = await verifyObject(env, cleanPath);

    if (verification.ok && verification.sha256) {
      // Update memes content_hash
      await env.DB.prepare(`
        UPDATE memes SET content_hash = ? WHERE id = ?
      `).bind(verification.sha256, m.id).run();

      // Upsert legacy ingestion_jobs record
      const filename = cleanPath.split("/").pop() || "meme-file";
      const sanitized = sanitizeFilename(filename);
      const cleanTitle = sanitized.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      const title = m.title || (cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));

      await env.DB.prepare(`
        INSERT OR IGNORE INTO ingestion_jobs (
          job_id, idempotency_key, batch_id, meme_id, original_filename, title,
          content_hash, byte_size, mime_type, media_type, upload_state, state,
          storage_path, source, sniffed_mime, checks_json, verified_at,
          created_at, updated_at
        ) VALUES (?, ?, 'legacy-backfill', ?, ?, ?, ?, ?, ?, 'image', 'uploaded', 'human_ready', ?, 'legacy', ?, ?, ?, ?, ?)
      `).bind(
        `job-legacy-${m.id}`,
        `key-legacy-${m.id}`,
        m.id,
        filename,
        title,
        verification.sha256,
        verification.sizeBytes,
        verification.sniffedMime,
        cleanPath,
        verification.sniffedMime,
        JSON.stringify(verification.checks),
        nowIso,
        m.uploaded_at || nowIso,
        nowIso
      ).run();

      results.push({ id: m.id, ok: true, sha256: verification.sha256 });
    } else {
      results.push({ id: m.id, ok: false, reason: verification.rejectReason });
    }
  }

  let remaining = 0;
  try {
    const remainingRes = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM memes m
      LEFT JOIN ingestion_jobs j ON m.id = j.meme_id
      WHERE m.storage_path IS NOT NULL
        AND (m.content_hash IS NULL OR j.id IS NULL)
    `).first<{ cnt: number }>();
    remaining = remainingRes?.cnt || 0;
  } catch {}

  return json({
    processed: results.length,
    remaining,
    hasMore: remaining > 0,
    results
  });
};
