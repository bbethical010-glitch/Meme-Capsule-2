import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import {
  INGESTION_MAX_FILE_BYTES,
  boundError,
  detectImageMime,
  getBatchStatus,
  hasIngestionSchema,
  isSupportedImageType,
  refreshBatchStatus,
  sanitizeFileName,
  sha256Hex,
  type IngestionJobRow
} from "../../../_shared/ingestion";

type UploadFile = {
  name?: string;
  type?: string;
  arrayBuffer?: () => Promise<ArrayBuffer>;
};

const schemaUnavailable = () => json(
  { error: "Durable ingestion is not available until migration 025 is applied to this D1 environment." },
  { status: 503 }
);

const field = (formData: FormData | null, name: string) => {
  const value = formData?.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const ensurePrivateMeme = async (env: Env, job: IngestionJobRow) => {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO memes (
      id, title, image_url, storage_path, source_link, category, tags,
      rarity, status, media_type, input_method, is_active, rights_note,
      share_text, random_key, uploaded_at
    ) VALUES (?, ?, NULL, ?, ?, 'Unsorted', '[]', 'Common', 'draft', 'image', 'upload', 0, 'reviewed', ?, ?, ?)
  `).bind(
    job.meme_id,
    job.title,
    job.storage_path,
    job.original_filename,
    job.title,
    Math.random(),
    now
  ).run();

  const result = await env.DB.prepare(`
    UPDATE memes
    SET title = ?, image_url = NULL, storage_path = ?, source_link = ?,
        status = 'draft', media_type = 'image', input_method = 'upload',
        is_active = 0, rights_note = 'reviewed', share_text = ?
    WHERE id = ? AND is_active = 0
  `).bind(
    job.title,
    job.storage_path,
    job.original_filename,
    job.title,
    job.meme_id
  ).run();

  if (!result.meta?.changes) {
    const row = await env.DB.prepare("SELECT id FROM memes WHERE id = ?")
      .bind(job.meme_id)
      .first<{ id: string }>();
    if (!row) throw new Error("The private meme metadata row could not be created.");
  }
};

const markUploadFailure = async (env: Env, jobId: string, message: string) => {
  await env.DB.prepare(`
    UPDATE ingestion_jobs
    SET upload_state = 'failed', state = 'queued', error_code = 'upload_failed',
        error_message = ?, updated_at = ?, lease_owner = NULL, lease_expires_at = NULL
    WHERE job_id = ?
  `).bind(boundError(message, "Image upload failed."), new Date().toISOString(), jobId).run().catch(() => undefined);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;
  if (!(await hasIngestionSchema(env.DB))) return schemaUnavailable();

  const formData = await request.formData().catch(() => null);
  const batchId = field(formData, "batch_id");
  const jobId = field(formData, "job_id");
  if (!batchId || !jobId) return json({ error: "batch_id and job_id are required." }, { status: 400 });

  const job = await env.DB.prepare(
    "SELECT * FROM ingestion_jobs WHERE job_id = ? AND batch_id = ?"
  ).bind(jobId, batchId).first<IngestionJobRow>();
  if (!job) return json({ error: "Ingestion job not found." }, { status: 404 });

  let objectPath: string | null = null;
  let r2Uploaded = false;
  try {
    if (job.upload_state === "uploaded" && job.storage_path) {
      await ensurePrivateMeme(env, job);
      await refreshBatchStatus(env.DB, batchId);
      const status = await getBatchStatus(env, batchId);
      return status ? json(status) : json({ error: "Batch could not be read after upload recovery." }, { status: 503 });
    }

    const fileValue = formData?.get("file") as UploadFile | string | null;
    if (!fileValue || typeof fileValue === "string" || typeof fileValue.arrayBuffer !== "function") {
      return json({ error: "Upload requires an image file. Re-select the file to retry this item." }, { status: 400 });
    }

    const bytes = new Uint8Array(await fileValue.arrayBuffer());
    if (bytes.byteLength < 1 || bytes.byteLength > INGESTION_MAX_FILE_BYTES) {
      await markUploadFailure(env, jobId, `File exceeds the ${INGESTION_MAX_FILE_BYTES / 1024 / 1024} MiB per-file limit.`);
      return json({ error: `File exceeds the ${INGESTION_MAX_FILE_BYTES / 1024 / 1024} MiB per-file limit.` }, { status: 400 });
    }

    const declaredMime = (fileValue.type || job.mime_type || "").toLowerCase().trim();
    const sniffedMime = detectImageMime(bytes);
    const effectiveMime = sniffedMime || declaredMime;

    // Normalize compatible MIME variants so heif/heic and jpg/jpeg are compatible
    const normalizeImageMime = (m: string) => {
      if (m === "image/jpg") return "image/jpeg";
      if (m === "image/heif" || m === "image/heic-sequence" || m === "image/heif-sequence") return "image/heic";
      return m;
    };

    const normDeclared = normalizeImageMime(declaredMime);
    const normSniffed = sniffedMime ? normalizeImageMime(sniffedMime) : null;
    const isMismatched = Boolean(normDeclared && isSupportedImageType(normDeclared) && normSniffed && normSniffed !== normDeclared);

    if (!sniffedMime || !isSupportedImageType(effectiveMime) || isMismatched) {
      await markUploadFailure(env, jobId, "The file is not a supported image or its declared type does not match its contents.");
      return json({ error: "Only valid PNG, JPEG, GIF, WebP, AVIF, HEIC, or HEIF images are accepted. Video is not supported." }, { status: 400 });
    }

    const actualHash = await sha256Hex(bytes);
    if (actualHash !== job.content_hash.toLowerCase()) {
      await markUploadFailure(env, jobId, "The selected file changed after the batch was prepared. Remove it and add the current file again.");
      return json({ error: "The selected file no longer matches its prepared content hash." }, { status: 409 });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE ingestion_jobs
      SET upload_state = 'uploading', error_code = NULL, error_message = ?, updated_at = ?
      WHERE job_id = ?
    `).bind(null, now, jobId).run();

    objectPath = job.storage_path || `ingestion/${batchId}/${job.meme_id}/${actualHash.slice(0, 16)}-${crypto.randomUUID()}-${sanitizeFileName(fileValue.name || job.original_filename)}`;
    await env.DB.prepare(`
      UPDATE ingestion_jobs
      SET upload_state = 'uploading', storage_path = ?, error_code = NULL,
          error_message = NULL, updated_at = ?
      WHERE job_id = ?
    `).bind(objectPath, now, jobId).run();
    await env.MEMES_BUCKET.put(objectPath, bytes, {
      httpMetadata: { contentType: effectiveMime }
    });
    r2Uploaded = true;

    await env.DB.prepare(`
      UPDATE ingestion_jobs
      SET upload_state = 'uploaded', storage_path = ?, mime_type = ?,
          state = 'queued', error_code = NULL, error_message = NULL,
          updated_at = ?, lease_owner = NULL, lease_expires_at = NULL
      WHERE job_id = ?
    `).bind(objectPath, effectiveMime, now, jobId).run();

    const uploadedJob = await env.DB.prepare("SELECT * FROM ingestion_jobs WHERE job_id = ?")
      .bind(jobId)
      .first<IngestionJobRow>();
    if (!uploadedJob) throw new Error("The uploaded ingestion job could not be read back.");

    try {
      await ensurePrivateMeme(env, uploadedJob);
    } catch (metadataError) {
      const message = boundError(metadataError, "R2 upload succeeded but private D1 metadata could not be saved.");
      await env.DB.prepare(`
        UPDATE ingestion_jobs
        SET state = 'retry_wait', error_code = 'metadata_persist_failed', error_message = ?,
            next_attempt_at = ?, updated_at = ?
        WHERE job_id = ?
      `).bind(message, now, now, jobId).run().catch(() => undefined);
      await refreshBatchStatus(env.DB, batchId).catch(() => undefined);
      return json({
        error: "R2 upload succeeded, but private metadata persistence failed. Retry this item; the existing R2 object will be reused.",
        recoverable: true,
        storage_path: objectPath
      }, { status: 503 });
    }

    await refreshBatchStatus(env.DB, batchId);
    const status = await getBatchStatus(env, batchId);
    return status ? json(status) : json({ error: "Batch could not be read after upload." }, { status: 503 });
  } catch (error) {
    if (r2Uploaded && objectPath) {
      const message = boundError(error, "R2 upload succeeded but the upload state could not be finalized.");
      await env.DB.prepare(`
        UPDATE ingestion_jobs
        SET upload_state = 'uploaded', storage_path = ?, state = 'retry_wait',
            error_code = 'upload_state_persist_failed', error_message = ?,
            next_attempt_at = ?, updated_at = ?
        WHERE job_id = ?
      `).bind(objectPath, message, new Date().toISOString(), new Date().toISOString(), jobId).run().catch(() => undefined);
    } else {
      await markUploadFailure(env, jobId, boundError(error));
    }
    await refreshBatchStatus(env.DB, batchId).catch(() => undefined);
    return json({
      error: r2Uploaded
        ? "R2 upload succeeded, but its durable state needs recovery. Retry this item."
        : boundError(error, "Unable to upload image."),
      recoverable: r2Uploaded
    }, { status: 500 });
  }
};
