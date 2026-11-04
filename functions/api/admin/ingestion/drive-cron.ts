/**
 * GET/POST /api/admin/ingestion/drive-cron
 *
 * Automated Google Drive Intake (Phase 1.5).
 * Invoked by Cloudflare Cron Triggers or administrative ping.
 * Uses pure Web Crypto service account auth to poll configured Drive folder,
 * streams new images into R2, creates private draft metadata, and feeds
 * the durable ingestion pipeline.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { getGoogleDriveAuth } from "../../../_shared/googleDriveAuth";
import {
  boundError,
  detectImageMime,
  hasIngestionSchema,
  isSupportedImageType,
  refreshBatchStatus,
  sanitizeFileName,
  sha256Hex
} from "../../../_shared/ingestion";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
}

const ensurePrivateDraftMeme = async (
  env: Env,
  memeId: string,
  title: string,
  storagePath: string,
  originalFilename: string
) => {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO memes (
      id, title, image_url, storage_path, source_link, category, tags,
      rarity, status, media_type, input_method, is_active, rights_note,
      share_text, random_key, uploaded_at
    ) VALUES (?, ?, NULL, ?, ?, 'Unsorted', '[]', 'Common', 'draft', 'image', 'google-drive', 0, 'reviewed', ?, ?, ?)
  `).bind(
    memeId,
    title,
    storagePath,
    originalFilename,
    title,
    Math.random(),
    now
  ).run();

  await env.DB.prepare(`
    UPDATE memes
    SET title = ?, image_url = NULL, storage_path = ?, source_link = ?,
        status = 'draft', media_type = 'image', input_method = 'google-drive',
        is_active = 0, rights_note = 'reviewed', share_text = ?
    WHERE id = ? AND is_active = 0
  `).bind(
    title,
    storagePath,
    originalFilename,
    title,
    memeId
  ).run();
};

const dispatchAdminAlert = async (env: Env, title: string, message: string) => {
  try {
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT OR REPLACE INTO app_global_stats (stat_key, stat_value, updated_at)
      VALUES (?, ?, ?)
    `).bind("last_drive_cron_alert", 1, now).run().catch(() => undefined);
  } catch {
    // Non-blocking fallback
  }
};

const handleCron = async (request: Request, env: Env) => {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const cronKey = request.headers.get("X-Cron-Key") || new URL(request.url).searchParams.get("token") || "";
  const adminToken = env.ADMIN_API_TOKEN || "";

  if (adminToken && token !== adminToken && cronKey !== adminToken) {
    return json({ error: "Unauthorized cron trigger." }, { status: 401 });
  }

  if (!(await hasIngestionSchema(env.DB))) {
    return json({ error: "Ingestion schema (migration 025) is not applied." }, { status: 503 });
  }

  const folderId = ((env as any).GOOGLE_DRIVE_FOLDER_ID || "").trim();
  if (!folderId) {
    return json({
      success: true,
      skipped: true,
      reason: "GOOGLE_DRIVE_FOLDER_ID is not configured in Workers environment."
    });
  }

  let accessToken = "";
  try {
    const auth = await getGoogleDriveAuth(env);
    accessToken = auth.accessToken;
  } catch (authError) {
    const message = boundError(authError, "Google Drive service account auth failed.");
    await dispatchAdminAlert(env, "Google Drive Auth Expired", message);
    return json({ error: message, alert_dispatched: true }, { status: 500 });
  }

  // Query folder for image files
  const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(folderId)}'+in+parents+and+trashed=false&pageSize=25&fields=files(id,name,mimeType,size,md5Checksum)`;
  const listRes = await fetch(driveUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => "");
    const message = `Google Drive API error (${listRes.status}): ${errText.slice(0, 300)}`;
    await dispatchAdminAlert(env, "Google Drive Folder Unreachable", message);
    return json({ error: message, alert_dispatched: true }, { status: 502 });
  }

  const driveData = (await listRes.json().catch(() => ({}))) as { files?: DriveFile[] };
  const allFiles = (driveData.files || []).filter((f) => f.mimeType && f.mimeType.startsWith("image/"));

  if (allFiles.length === 0) {
    return json({
      success: true,
      new_items: 0,
      message: "No image files found in the configured Google Drive folder."
    });
  }

  // Deduplication check: check which drive file IDs have already been ingested
  const existingJobKeys = new Set<string>();
  const idChecks = allFiles.map((f) => `gdrive-${f.id}`);
  const placeholders = idChecks.map(() => "?").join(",");
  const existingRows = await env.DB.prepare(
    `SELECT idempotency_key FROM ingestion_jobs WHERE idempotency_key IN (${placeholders})`
  ).bind(...idChecks).all<{ idempotency_key: string }>();

  for (const row of existingRows.results || []) {
    existingJobKeys.add(row.idempotency_key);
  }

  const newFiles = allFiles.filter((f) => !existingJobKeys.has(`gdrive-${f.id}`));

  if (newFiles.length === 0) {
    return json({
      success: true,
      new_items: 0,
      total_folder_files: allFiles.length,
      message: "All files in the Google Drive folder have already been ingested."
    });
  }

  // Create an ingestion batch for this cron cycle
  const batchId = `batch-gdrive-${Date.now()}`;
  const batchIdempotencyKey = `gdrive-batch-${folderId}-${Date.now()}`;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO ingestion_batches (
      id, idempotency_key, actor_id, actor_name, status, total_items, total_bytes, created_at, updated_at
    ) VALUES (?, ?, 'system-cron-drive', 'Google Drive Automation', 'queued', ?, 0, ?, ?)
  `).bind(batchId, batchIdempotencyKey, newFiles.length, now, now).run();

  let ingestedCount = 0;
  let totalBytes = 0;

  for (const file of newFiles) {
    try {
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!downloadRes.ok) continue;

      const bytes = new Uint8Array(await downloadRes.arrayBuffer());
      if (bytes.byteLength < 1) continue;

      const sniffed = detectImageMime(bytes);
      const mime = sniffed || file.mimeType || "image/jpeg";
      if (!isSupportedImageType(mime)) continue;

      const hash = await sha256Hex(bytes);
      const memeId = `meme-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const jobId = `job-${crypto.randomUUID()}`;
      const title = file.name.replace(/\.[^.]+$/, "") || "Drive Intake Meme";
      const sanitizedName = sanitizeFileName(file.name);
      const storagePath = `ingestion/${batchId}/${memeId}/${hash.slice(0, 16)}-${sanitizedName}`;

      // Upload to R2
      await env.MEMES_BUCKET.put(storagePath, bytes, {
        httpMetadata: { contentType: mime }
      });

      // Insert ingestion job
      await env.DB.prepare(`
        INSERT INTO ingestion_jobs (
          job_id, idempotency_key, batch_id, meme_id, original_filename,
          title, content_hash, byte_size, mime_type, media_type,
          upload_state, state, storage_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'uploaded', 'queued', ?, ?, ?)
      `).bind(
        jobId,
        `gdrive-${file.id}`,
        batchId,
        memeId,
        file.name,
        title,
        hash,
        bytes.byteLength,
        mime,
        storagePath,
        now,
        now
      ).run();

      // Create evaluations for Judge 4 and Judge 5
      await env.DB.prepare(`
        INSERT INTO ingestion_ai_evaluations (id, job_id, judge_key, state, created_at, updated_at)
        VALUES (?, ?, 'judge4', 'pending', ?, ?)
      `).bind(`eval-${crypto.randomUUID()}`, jobId, now, now).run();

      await env.DB.prepare(`
        INSERT INTO ingestion_ai_evaluations (id, job_id, judge_key, state, created_at, updated_at)
        VALUES (?, ?, 'judge5', 'pending', ?, ?)
      `).bind(`eval-${crypto.randomUUID()}`, jobId, now, now).run();

      // Create private draft meme in D1
      await ensurePrivateDraftMeme(env, memeId, title, storagePath, file.name);

      ingestedCount++;
      totalBytes += bytes.byteLength;
    } catch {
      // Individual file error; continue processing the rest of the batch
    }
  }

  await env.DB.prepare(`
    UPDATE ingestion_batches
    SET total_items = ?, total_bytes = ?, updated_at = ?
    WHERE id = ?
  `).bind(ingestedCount, totalBytes, new Date().toISOString(), batchId).run();

  await refreshBatchStatus(env.DB, batchId);

  return json({
    success: true,
    batch_id: batchId,
    new_items_ingested: ingestedCount,
    total_bytes: totalBytes,
    folder_total: allFiles.length
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => handleCron(request, env);
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => handleCron(request, env);
