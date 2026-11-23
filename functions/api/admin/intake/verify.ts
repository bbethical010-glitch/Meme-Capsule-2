import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { verifyObject, sanitizeFilename } from "../../../_shared/intake";

/**
 * POST /api/admin/intake/verify
 * 
 * Step 6 & Step 10: VERIFY INTAKE action for DRAFT memes.
 * Re-runs physical R2 verification, MIME sniffing, SHA-256 calculation, and duplicate check.
 * Updates memes.content_hash and writes ingestion_jobs record.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  const sessionUser = adminError ? await validateSession(request, env) : null;

  if (adminError && (!sessionUser || (sessionUser.role !== "superadmin" && sessionUser.role !== "curator"))) {
    return json({ error: "Admin or SuperAdmin credentials required." }, { status: 401 });
  }

  let body: { meme_ids?: string[] } = {};
  try {
    body = await request.json();
  } catch {}

  const url = new URL(request.url);
  const limit = Math.min(25, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
  const nowIso = new Date().toISOString();

  let targetMemes: Array<{ id: string; storage_path: string; title: string; uploaded_at: string }> = [];

  if (body.meme_ids && Array.isArray(body.meme_ids) && body.meme_ids.length > 0) {
    const placeholders = body.meme_ids.slice(0, 25).map(() => "?").join(",");
    const { results } = await env.DB.prepare(`
      SELECT id, storage_path, title, uploaded_at FROM memes
      WHERE id IN (${placeholders}) AND storage_path IS NOT NULL
    `).bind(...body.meme_ids.slice(0, 25)).all<{ id: string; storage_path: string; title: string; uploaded_at: string }>();
    targetMemes = results || [];
  } else {
    // Pick unverified draft memes (missing content_hash or missing ingestion_jobs row)
    const { results } = await env.DB.prepare(`
      SELECT m.id, m.storage_path, m.title, m.uploaded_at
      FROM memes m
      LEFT JOIN ingestion_jobs j ON m.id = j.meme_id
      WHERE m.storage_path IS NOT NULL
        AND (m.content_hash IS NULL OR j.id IS NULL)
      LIMIT ?
    `).bind(limit).all<{ id: string; storage_path: string; title: string; uploaded_at: string }>();
    targetMemes = results || [];
  }

  const results: Array<{ id: string; ok: boolean; sha256?: string; reason?: string }> = [];

  for (const m of targetMemes) {
    const cleanPath = m.storage_path.replace(/^\/+/, "");
    const verification = await verifyObject(env, cleanPath);

    if (verification.ok && verification.sha256) {
      // Update memes content_hash
      await env.DB.prepare(`
        UPDATE memes SET content_hash = ? WHERE id = ?
      `).bind(verification.sha256, m.id).run().catch(() => {});

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
        ) VALUES (?, ?, 'intake-verification', ?, ?, ?, ?, ?, ?, 'image', 'uploaded', 'verified', ?, 'r2_sync', ?, ?, ?, ?, ?)
      `).bind(
        `job-verify-${m.id}`,
        `key-verify-${m.id}`,
        m.id,
        filename,
        title,
        verification.sha256,
        verification.sizeBytes,
        verification.sniffedMime || "image/jpeg",
        cleanPath,
        verification.sniffedMime,
        JSON.stringify(verification.checks),
        nowIso,
        m.uploaded_at || nowIso,
        nowIso
      ).run().catch(() => {});

      results.push({ id: m.id, ok: true, sha256: verification.sha256 });
    } else {
      results.push({ id: m.id, ok: false, reason: verification.rejectReason || "verification_failed" });
    }
  }

  const remainingRes = await env.DB.prepare(`
    SELECT COUNT(*) as cnt
    FROM memes m
    LEFT JOIN ingestion_jobs j ON m.id = j.meme_id
    WHERE m.storage_path IS NOT NULL
      AND (m.content_hash IS NULL OR j.id IS NULL)
  `).first<{ cnt: number }>();

  return json({
    verified: results.filter((r) => r.ok).length,
    rejected: results.filter((r) => !r.ok).length,
    remaining: remainingRes?.cnt || 0,
    results
  });
};
