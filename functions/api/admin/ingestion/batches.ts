import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import {
  INGESTION_MAX_BATCH_BYTES,
  INGESTION_MAX_FILE_BYTES,
  INGESTION_MAX_ITEMS,
  getBatchStatus,
  hasIngestionSchema,
  isSupportedImageType,
  isValidHash,
  isValidId,
  normalizeTitle,
  refreshBatchStatus,
  type IngestionBatchRow
} from "../../../_shared/ingestion";

type BatchItemInput = {
  idempotency_key?: string;
  meme_id?: string;
  original_filename?: string;
  title?: string;
  content_hash?: string;
  byte_size?: number;
  mime_type?: string;
  media_type?: string;
};

type BatchPayload = {
  idempotency_key?: string;
  items?: BatchItemInput[];
};

const itemKeyPattern = /^[a-z0-9][a-z0-9-_]{2,120}$/i;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const parsePayload = async (request: Request): Promise<BatchPayload> => {
  try {
    return (await request.json()) as BatchPayload;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
};

const schemaUnavailable = () => json(
  { error: "Durable ingestion is not available until migration 025 is applied to this D1 environment." },
  { status: 503 }
);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;
  if (!(await hasIngestionSchema(env.DB))) return schemaUnavailable();

  const batchId = (new URL(request.url).searchParams.get("id") || "").trim();
  if (!batchId) return json({ error: "id is required." }, { status: 400 });

  try {
    const status = await getBatchStatus(env, batchId);
    if (!status) return json({ error: "Ingestion batch not found." }, { status: 404 });
    return json(status);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to read ingestion batch." }, { status: 503 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;
  if (!(await hasIngestionSchema(env.DB))) return schemaUnavailable();

  try {
    const payload = await parsePayload(request);
    const idempotencyKey = (payload.idempotency_key || "").trim();
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!idempotencyKey || idempotencyKey.length > 120) {
      return json({ error: "A stable batch idempotency_key is required." }, { status: 400 });
    }
    if (items.length < 1 || items.length > INGESTION_MAX_ITEMS) {
      return json({ error: `A batch must contain between 1 and ${INGESTION_MAX_ITEMS} image files.` }, { status: 400 });
    }

    const existing = await env.DB.prepare(
      "SELECT * FROM ingestion_batches WHERE idempotency_key = ?"
    ).bind(idempotencyKey).first<IngestionBatchRow>();
    if (existing) {
      const status = await getBatchStatus(env, existing.id);
      return status ? json(status) : json({ error: "Existing ingestion batch could not be read." }, { status: 503 });
    }

    const seenKeys = new Set<string>();
    const seenMemeIds = new Set<string>();
    const normalizedItems = [] as Array<{
      idempotencyKey: string;
      memeId: string;
      originalFilename: string;
      title: string;
      contentHash: string;
      byteSize: number;
      mimeType: string;
    }>;
    let totalBytes = 0;

    for (const item of items) {
      const itemIdempotencyKey = (item.idempotency_key || "").trim();
      const memeId = (item.meme_id || "").trim();
      const filename = (item.original_filename || "").trim().slice(0, 180);
      const contentHash = (item.content_hash || "").trim().toLowerCase();
      const byteSize = Number(item.byte_size);
      const mimeType = (item.mime_type || "").trim().toLowerCase();

      if (!itemKeyPattern.test(itemIdempotencyKey)) {
        return json({ error: "Each item needs a stable idempotency_key." }, { status: 400 });
      }
      if (!isValidId(memeId) || !memeId.startsWith("intake-")) {
        return json({ error: "Each item needs a generated intake meme ID." }, { status: 400 });
      }
      if (!filename) return json({ error: "Each item needs an original filename." }, { status: 400 });
      if (!isValidHash(contentHash)) return json({ error: `Invalid content hash for ${filename}.` }, { status: 400 });
      if (!Number.isSafeInteger(byteSize) || byteSize <= 0) return json({ error: `Invalid file size for ${filename}.` }, { status: 400 });
      if (!isSupportedImageType(mimeType) || item.media_type === "video") {
        return json({ error: `${filename} is not a supported image. Bulk intake accepts images only; video is not supported.` }, { status: 400 });
      }
      if (byteSize > INGESTION_MAX_FILE_BYTES) {
        return json({ error: `${filename} exceeds the 20 MiB per-file limit.` }, { status: 400 });
      }
      if (seenKeys.has(itemIdempotencyKey) || seenMemeIds.has(memeId)) {
        return json({ error: "Batch items must have unique IDs and idempotency keys." }, { status: 400 });
      }

      seenKeys.add(itemIdempotencyKey);
      seenMemeIds.add(memeId);
      totalBytes += byteSize;
      normalizedItems.push({
        idempotencyKey: itemIdempotencyKey,
        memeId,
        originalFilename: filename,
        title: normalizeTitle(String(item.title || ""), filename),
        contentHash,
        byteSize,
        mimeType
      });
    }

    if (totalBytes > INGESTION_MAX_BATCH_BYTES) {
      return json({ error: `The batch exceeds the ${Math.round(INGESTION_MAX_BATCH_BYTES / (1024 * 1024))} MiB total payload limit.` }, { status: 400 });
    }

    const existingMemesSet = new Set<string>();
    for (const chunk of chunkArray(normalizedItems.map((item) => item.memeId), 40)) {
      const placeholders = chunk.map(() => "?").join(",");
      const res = await env.DB.prepare(
        `SELECT id FROM memes WHERE id IN (${placeholders})`
      ).bind(...chunk).all<{ id: string }>();
      for (const row of res.results || []) existingMemesSet.add(row.id);
    }

    const existingKeysSet = new Set<string>();
    for (const chunk of chunkArray(normalizedItems.map((item) => item.idempotencyKey), 40)) {
      const placeholders = chunk.map(() => "?").join(",");
      const res = await env.DB.prepare(
        `SELECT idempotency_key FROM ingestion_jobs WHERE idempotency_key IN (${placeholders})`
      ).bind(...chunk).all<{ idempotency_key: string }>();
      for (const row of res.results || []) existingKeysSet.add(row.idempotency_key);
    }

    const existingHashJobs = new Map<string, string>();
    for (const chunk of chunkArray(normalizedItems.map((item) => item.contentHash), 40)) {
      const placeholders = chunk.map(() => "?").join(",");
      const res = await env.DB.prepare(
        `SELECT job_id, content_hash FROM ingestion_jobs WHERE content_hash IN (${placeholders})`
      ).bind(...chunk).all<{ job_id: string; content_hash: string }>();
      for (const row of res.results || []) existingHashJobs.set(row.content_hash, row.job_id);
    }

    const batchId = `batch-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(`
        INSERT INTO ingestion_batches (
          id, idempotency_key, actor_id, actor_name, status,
          total_items, total_bytes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)
      `).bind(batchId, idempotencyKey, "admin-api", "Admin", normalizedItems.length, totalBytes, now, now)
    ];

    for (const item of normalizedItems) {
      const jobId = `job-${crypto.randomUUID()}`;
      const duplicateOf = existingHashJobs.get(item.contentHash) || null;
      // Defensive resolution: If an idempotency key or meme ID already exists in D1 from an older batch,
      // scope it to this batch instead of throwing a blocking 409 conflict.
      const safeKey = existingKeysSet.has(item.idempotencyKey)
        ? `${batchId.slice(0, 10)}-${item.idempotencyKey}`.slice(0, 110)
        : item.idempotencyKey;
      const safeMemeId = existingMemesSet.has(item.memeId)
        ? `intake-${crypto.randomUUID().replace(/-/g, "")}`
        : item.memeId;

      statements.push(env.DB.prepare(`
        INSERT INTO ingestion_jobs (
          job_id, idempotency_key, batch_id, meme_id, original_filename, title,
          content_hash, byte_size, mime_type, media_type, duplicate_of_job_id,
          upload_state, state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', ?, 'pending', 'queued', ?, ?)
      `).bind(
        jobId,
        safeKey,
        batchId,
        safeMemeId,
        item.originalFilename,
        item.title,
        item.contentHash,
        item.byteSize,
        item.mimeType,
        duplicateOf,
        now,
        now
      ));
      for (const judgeKey of ["judge4", "judge5"] as const) {
        statements.push(env.DB.prepare(`
          INSERT INTO ingestion_ai_evaluations (
            id, job_id, meme_id, judge_key, state, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `).bind(`eval-${crypto.randomUUID()}`, jobId, safeMemeId, judgeKey, now, now));
      }
    }

    const STATEMENT_CHUNK_SIZE = 25;
    for (let i = 0; i < statements.length; i += STATEMENT_CHUNK_SIZE) {
      await env.DB.batch(statements.slice(i, i + STATEMENT_CHUNK_SIZE));
    }

    await refreshBatchStatus(env.DB, batchId);
    const status = await getBatchStatus(env, batchId);
    return status ? json(status, { status: 201 }) : json({ error: "Batch was created but could not be read back." }, { status: 503 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to create ingestion batch." }, { status: 400 });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;
  if (!(await hasIngestionSchema(env.DB))) return schemaUnavailable();

  const batchId = (new URL(request.url).searchParams.get("id") || "").trim();
  if (!batchId) return json({ error: "id is required." }, { status: 400 });

  if (batchId === "all_stale") {
    // Comprehensive purge for all stale/abandoned intake sessions
    const staleBatchesRes = await env.DB.prepare(
      "SELECT id FROM ingestion_batches WHERE status IN ('queued', 'processing', 'partial', 'failed', 'cancelled')"
    ).all<{ id: string }>();
    const staleBatches = staleBatchesRes.results || [];
    let totalPurgedJobs = 0;

    for (const b of staleBatches) {
      const jobsRes = await env.DB.prepare(
        "SELECT job_id, meme_id, storage_path FROM ingestion_jobs WHERE batch_id = ?"
      ).bind(b.id).all<{ job_id: string; meme_id: string; storage_path: string | null }>();
      const jobs = jobsRes.results || [];
      totalPurgedJobs += jobs.length;

      if (jobs.length > 0) {
        const memeIds = jobs.map((j) => j.meme_id);
        for (const chunk of chunkArray(memeIds, 40)) {
          const placeholders = chunk.map(() => "?").join(",");
          await env.DB.prepare(`DELETE FROM memes WHERE id IN (${placeholders}) AND status = 'draft' AND is_active = 0`)
            .bind(...chunk).run().catch(() => undefined);
        }
        for (const job of jobs) {
          if (job.storage_path) {
            await env.MEMES_BUCKET.delete(job.storage_path).catch(() => undefined);
          }
        }
      }

      // Explicitly delete AI evaluations, jobs, and batch row
      await env.DB.prepare("DELETE FROM ingestion_ai_evaluations WHERE job_id IN (SELECT job_id FROM ingestion_jobs WHERE batch_id = ?)").bind(b.id).run().catch(() => undefined);
      await env.DB.prepare("DELETE FROM ingestion_jobs WHERE batch_id = ?").bind(b.id).run().catch(() => undefined);
      await env.DB.prepare("DELETE FROM ingestion_batches WHERE id = ?").bind(b.id).run().catch(() => undefined);
    }

    // Clean any orphaned jobs/evaluations whose batch no longer exists
    await env.DB.prepare("DELETE FROM ingestion_ai_evaluations WHERE job_id IN (SELECT job_id FROM ingestion_jobs WHERE batch_id NOT IN (SELECT id FROM ingestion_batches))").run().catch(() => undefined);
    await env.DB.prepare("DELETE FROM ingestion_jobs WHERE batch_id NOT IN (SELECT id FROM ingestion_batches)").run().catch(() => undefined);

    return json({
      success: true,
      deleted_batch_id: "all_stale",
      purged_batches_count: staleBatches.length,
      purged_jobs_count: totalPurgedJobs
    });
  }

  const batch = await env.DB.prepare("SELECT * FROM ingestion_batches WHERE id = ?")
    .bind(batchId)
    .first<IngestionBatchRow>();
  if (!batch) return json({ error: "Ingestion batch not found." }, { status: 404 });

  const jobsRes = await env.DB.prepare("SELECT job_id, meme_id, storage_path FROM ingestion_jobs WHERE batch_id = ?")
    .bind(batchId)
    .all<{ job_id: string; meme_id: string; storage_path: string | null }>();
  const jobs = jobsRes.results || [];

  if (jobs.length > 0) {
    const memeIds = jobs.map((j) => j.meme_id);
    for (const chunk of chunkArray(memeIds, 40)) {
      const placeholders = chunk.map(() => "?").join(",");
      await env.DB.prepare(`DELETE FROM memes WHERE id IN (${placeholders}) AND status = 'draft' AND is_active = 0`)
        .bind(...chunk)
        .run()
        .catch(() => undefined);
    }

    for (const job of jobs) {
      if (job.storage_path) {
        await env.MEMES_BUCKET.delete(job.storage_path).catch(() => undefined);
      }
    }
  }

  // Explicitly delete AI evaluations and jobs to ensure 100% complete purge (bypassing SQLite cascade limits)
  await env.DB.prepare("DELETE FROM ingestion_ai_evaluations WHERE job_id IN (SELECT job_id FROM ingestion_jobs WHERE batch_id = ?)").bind(batchId).run().catch(() => undefined);
  await env.DB.prepare("DELETE FROM ingestion_jobs WHERE batch_id = ?").bind(batchId).run().catch(() => undefined);
  await env.DB.prepare("DELETE FROM ingestion_batches WHERE id = ?").bind(batchId).run();

  return json({
    success: true,
    deleted_batch_id: batchId,
    purged_jobs_count: jobs.length
  });
};
