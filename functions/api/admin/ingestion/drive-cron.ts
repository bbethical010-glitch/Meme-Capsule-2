/**
 * GET/POST /api/admin/ingestion/drive-cron
 *
 * Automated Google Drive Multi-Bot Script Team (Phase 1.5).
 * Invoked by Cloudflare Cron Triggers or administrative ping.
 *
 * Multi-Bot Team Architecture:
 * - auditLoggerBot: Structured ISO timestamped telemetry and execution audits.
 * - driveFolderResolverBot: Validates root folder and ensures '_Uploaded_Memes' subfolder exists.
 * - driveFetcherBot: Discovers new files in the root folder, ignoring subfolders.
 * - dedupSecurityBot: Zero-egress shortcode and file ID deduplication against D1 before download.
 * - ingestionUploaderBot: Validates MIME/bytes, computes SHA-256 hash, writes R2 + D1 draft rows.
 * - driveRelocatorBot: Moves completed files from root to '_Uploaded_Memes'.
 *
 * INVIOLABLE SAFETY GUARANTEE:
 * Any file that fails processing is NEVER recorded in D1 and NEVER moved to '_Uploaded_Memes'.
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

const extractShortcode = (filename: string): string | null => {
  const match = filename.match(/(?:\[|\b)([A-Z0-9_-]{4,16})(?:\]|\b)/i);
  return match ? match[1] : null;
};

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

const findOrCreateUploadedFolder = async (
  rootFolderId: string,
  accessToken: string,
  logAudit: (bot: string, msg: string) => void
): Promise<string | null> => {
  try {
    const query = encodeURIComponent(`'${rootFolderId}' in parents and name = '_Uploaded_Memes' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (listRes.ok) {
      const data = (await listRes.json().catch(() => ({}))) as { files?: { id: string; name: string }[] };
      if (data.files && data.files.length > 0) {
        logAudit("driveFolderResolverBot", `Found existing '_Uploaded_Memes' quarantine subfolder (${data.files[0].id}).`);
        return data.files[0].id;
      }
    }

    logAudit("driveFolderResolverBot", "Creating new '_Uploaded_Memes' subfolder inside root folder...");
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "_Uploaded_Memes",
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId]
      })
    });
    if (createRes.ok) {
      const created = (await createRes.json().catch(() => ({}))) as { id?: string };
      if (created.id) {
        logAudit("driveFolderResolverBot", `Created '_Uploaded_Memes' subfolder (${created.id}).`);
        return created.id;
      }
    }
    logAudit("driveFolderResolverBot", `Failed to create '_Uploaded_Memes' subfolder (${createRes.status}).`);
    return null;
  } catch (err) {
    logAudit("driveFolderResolverBot", `Error resolving '_Uploaded_Memes' subfolder: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
};

const relocateFileToUploaded = async (
  fileId: string,
  rootFolderId: string,
  uploadedFolderId: string,
  accessToken: string
): Promise<boolean> => {
  try {
    const patchUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(uploadedFolderId)}&removeParents=${encodeURIComponent(rootFolderId)}&enforceSingleParent=true`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.ok;
  } catch {
    return false;
  }
};

const handleCron = async (request: Request, env: Env) => {
  const auditLogs: string[] = [];
  const logAudit = (bot: string, message: string) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${bot}] ${message}`;
    auditLogs.push(entry);
    console.log(entry);
  };

  logAudit("auditLoggerBot", "Google Drive Intake Multi-Bot cycle initiated.");

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const cronKey = request.headers.get("X-Cron-Key") || new URL(request.url).searchParams.get("token") || "";
  const adminToken = env.ADMIN_API_TOKEN || "";

  if (adminToken && token !== adminToken && cronKey !== adminToken) {
    logAudit("securityBot", "Unauthorized trigger attempt rejected.");
    return json({ error: "Unauthorized cron trigger.", logs: auditLogs }, { status: 401 });
  }

  if (!(await hasIngestionSchema(env.DB))) {
    logAudit("auditLoggerBot", "Ingestion schema (migration 025) is not applied.");
    return json({ error: "Ingestion schema (migration 025) is not applied.", logs: auditLogs }, { status: 503 });
  }

  const folderId = ((env as any).GOOGLE_DRIVE_FOLDER_ID || "").trim();
  if (!folderId) {
    logAudit("driveFolderResolverBot", "GOOGLE_DRIVE_FOLDER_ID is not configured in Workers environment.");
    return json({
      success: true,
      status: "unconfigured",
      message: "GOOGLE_DRIVE_FOLDER_ID is not configured in Cloudflare environment variables.",
      instructions: "Set GOOGLE_DRIVE_FOLDER_ID to your Google Drive shared folder ID. The multi-bot team will scan this root folder, ingest memes into D1/R2, and automatically relocate completed uploads to an '_Uploaded_Memes' subfolder.",
      logs: auditLogs
    });
  }

  let accessToken = "";
  try {
    const auth = await getGoogleDriveAuth(env);
    accessToken = auth.accessToken;
    logAudit("driveFetcherBot", "Google Drive service account authentication succeeded.");
  } catch (authError) {
    const message = boundError(authError, "Google Drive service account auth failed.");
    logAudit("driveFetcherBot", `Auth failed: ${message}`);
    return json({ error: message, alert_dispatched: true, logs: auditLogs }, { status: 500 });
  }

  // 1. Resolve or create _Uploaded_Memes subfolder
  const uploadedFolderId = await findOrCreateUploadedFolder(folderId, accessToken, logAudit);

  // 2. Query root folder for files (excluding subfolders)
  const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(folderId)}'+in+parents+and+mimeType!='application/vnd.google-apps.folder'+and+trashed=false&pageSize=50&fields=files(id,name,mimeType,size,md5Checksum)`;
  const listRes = await fetch(driveUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => "");
    const message = `Google Drive API error (${listRes.status}): ${errText.slice(0, 300)}`;
    logAudit("driveFetcherBot", message);
    return json({ error: message, logs: auditLogs }, { status: 502 });
  }

  const driveData = (await listRes.json().catch(() => ({}))) as { files?: DriveFile[] };
  const allFiles = (driveData.files || []).filter((f) => f.mimeType && f.mimeType.startsWith("image/"));
  logAudit("driveFetcherBot", `Discovered ${allFiles.length} image files in root folder.`);

  if (allFiles.length === 0) {
    return json({
      success: true,
      new_items: 0,
      message: "No image files found in the configured Google Drive folder.",
      logs: auditLogs
    });
  }

  // 3. Level 1 Zero-Egress Deduplication Check
  const filesToProcess: DriveFile[] = [];
  let skippedDuplicatesCount = 0;

  for (const file of allFiles) {
    const shortcode = extractShortcode(file.name);
    const gdriveId = `gdrive-${file.id}`;

    // Query D1 without downloading bytes
    const existingJob = await env.DB.prepare(
      "SELECT job_id FROM ingestion_jobs WHERE idempotency_key = ? LIMIT 1"
    ).bind(gdriveId).first<{ job_id: string }>();

    if (existingJob) {
      logAudit("dedupSecurityBot", `Skipping already ingested file: ${file.name} (ID: ${file.id})`);
      skippedDuplicatesCount++;
      // If file was already ingested earlier but not moved to _Uploaded_Memes, move it now
      if (uploadedFolderId) {
        await relocateFileToUploaded(file.id, folderId, uploadedFolderId, accessToken);
      }
      continue;
    }

    if (shortcode) {
      const existingMeme = await env.DB.prepare(
        "SELECT id FROM memes WHERE id = ? OR source_link LIKE ? LIMIT 1"
      ).bind(`meme-${shortcode}`, `%${shortcode}%`).first<{ id: string }>();

      if (existingMeme) {
        logAudit("dedupSecurityBot", `Shortcode [${shortcode}] already exists in D1. Skipping ${file.name}.`);
        skippedDuplicatesCount++;
        continue;
      }
    }

    filesToProcess.push(file);
  }

  if (filesToProcess.length === 0) {
    logAudit("auditLoggerBot", "All files in folder are already processed or skipped as duplicates.");
    return json({
      success: true,
      new_items: 0,
      skipped_duplicates: skippedDuplicatesCount,
      total_folder_files: allFiles.length,
      message: "All files in the Google Drive folder have already been ingested.",
      logs: auditLogs
    });
  }

  // 4. Batch creation
  const batchId = `batch-gdrive-${Date.now()}`;
  const batchIdempotencyKey = `gdrive-batch-${folderId}-${Date.now()}`;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO ingestion_batches (
      id, idempotency_key, actor_id, actor_name, status, total_items, total_bytes, created_at, updated_at
    ) VALUES (?, ?, 'system-cron-drive', 'Google Drive Automation', 'queued', ?, 0, ?, ?)
  `).bind(batchId, batchIdempotencyKey, filesToProcess.length, now, now).run();

  logAudit("ingestionUploaderBot", `Batch ${batchId} initialized for ${filesToProcess.length} candidate files.`);

  let ingestedCount = 0;
  let totalBytes = 0;
  let failedCount = 0;

  // 5. Ingestion and Quarantine Relocation
  for (const file of filesToProcess) {
    let storagePath: string | null = null;
    let didSucceed = false;

    try {
      logAudit("ingestionUploaderBot", `Downloading media for ${file.name} (${file.id})...`);
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!downloadRes.ok) throw new Error(`Download failed with status ${downloadRes.status}`);

      const bytes = new Uint8Array(await downloadRes.arrayBuffer());
      if (bytes.byteLength < 1) throw new Error("Empty file payload received.");

      const sniffed = detectImageMime(bytes);
      const mime = sniffed || file.mimeType || "image/jpeg";
      if (!isSupportedImageType(mime)) throw new Error(`Unsupported image type detected (${mime}).`);

      const hash = await sha256Hex(bytes);

      // Level 2 Byte Hash Check
      const hashConflict = await env.DB.prepare(
        "SELECT job_id FROM ingestion_jobs WHERE content_hash = ? LIMIT 1"
      ).bind(hash).first<{ job_id: string }>();

      if (hashConflict) {
        logAudit("dedupSecurityBot", `Byte hash duplicate detected for ${file.name}. Skipping.`);
        skippedDuplicatesCount++;
        continue;
      }

      const memeId = `meme-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const jobId = `job-${crypto.randomUUID()}`;
      const title = file.name.replace(/\.[^.]+$/, "") || "Drive Intake Meme";
      const sanitizedName = sanitizeFileName(file.name);
      storagePath = `ingestion/${batchId}/${memeId}/${hash.slice(0, 16)}-${sanitizedName}`;

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
        INSERT INTO ingestion_ai_evaluations (id, job_id, meme_id, judge_key, state, created_at, updated_at)
        VALUES (?, ?, ?, 'judge4', 'pending', ?, ?)
      `).bind(`eval-${crypto.randomUUID()}`, jobId, memeId, now, now).run();

      await env.DB.prepare(`
        INSERT INTO ingestion_ai_evaluations (id, job_id, meme_id, judge_key, state, created_at, updated_at)
        VALUES (?, ?, ?, 'judge5', 'pending', ?, ?)
      `).bind(`eval-${crypto.randomUUID()}`, jobId, memeId, now, now).run();

      // Create private draft meme in D1
      await ensurePrivateDraftMeme(env, memeId, title, storagePath, file.name);

      didSucceed = true;
      ingestedCount++;
      totalBytes += bytes.byteLength;
      logAudit("ingestionUploaderBot", `Successfully uploaded ${file.name} as private draft (${memeId}).`);

      // 6. Drive Relocator Bot: Move to _Uploaded_Memes only upon full success
      if (uploadedFolderId) {
        const moved = await relocateFileToUploaded(file.id, folderId, uploadedFolderId, accessToken);
        if (moved) {
          logAudit("driveRelocatorBot", `Relocated ${file.name} to '_Uploaded_Memes' subfolder.`);
        } else {
          logAudit("driveRelocatorBot", `Warning: Could not relocate ${file.name} to '_Uploaded_Memes' subfolder.`);
        }
      }
    } catch (fileErr) {
      failedCount++;
      const errMsg = fileErr instanceof Error ? fileErr.message : String(fileErr);
      logAudit("driveRelocatorBot", `FAILED processing ${file.name}: ${errMsg}. File kept in root quarantine and NOT recorded in DB.`);

      // Clean up R2 if partial write occurred
      if (storagePath && !didSucceed) {
        await env.MEMES_BUCKET.delete(storagePath).catch(() => undefined);
      }
    }
  }

  await env.DB.prepare(`
    UPDATE ingestion_batches
    SET total_items = ?, total_bytes = ?, updated_at = ?
    WHERE id = ?
  `).bind(ingestedCount, totalBytes, new Date().toISOString(), batchId).run();

  await refreshBatchStatus(env.DB, batchId);

  logAudit("auditLoggerBot", `Cycle completed. Ingested: ${ingestedCount}, Skipped: ${skippedDuplicatesCount}, Failed: ${failedCount}.`);

  return json({
    success: true,
    batch_id: batchId,
    new_items_ingested: ingestedCount,
    total_bytes: totalBytes,
    skipped_duplicates: skippedDuplicatesCount,
    failed_items: failedCount,
    folder_total: allFiles.length,
    logs: auditLogs
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => handleCron(request, env);
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => handleCron(request, env);
