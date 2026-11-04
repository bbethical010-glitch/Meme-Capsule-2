import type { Env } from "./d1r2";

export const INGESTION_MAX_ITEMS = 1000;
export const INGESTION_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const INGESTION_MAX_BATCH_BYTES = 2000 * 1024 * 1024;
export const INGESTION_MAX_AI_ATTEMPTS = 3;
export const INGESTION_LEASE_MS = 90_000;

const ID_PATTERN = /^[a-z0-9][a-z0-9-_]{2,80}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export type IngestionBatchRow = {
  id: string;
  idempotency_key: string;
  actor_id: string;
  actor_name: string | null;
  status: string;
  total_items: number;
  total_bytes: number;
  ready_items: number;
  failed_items: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type IngestionJobRow = {
  job_id: string;
  idempotency_key: string;
  batch_id: string;
  meme_id: string;
  original_filename: string;
  title: string;
  content_hash: string;
  byte_size: number;
  mime_type: string;
  media_type: string;
  duplicate_of_job_id: string | null;
  upload_state: string;
  state: string;
  storage_path: string | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IngestionEvaluationRow = {
  id: string;
  job_id: string;
  meme_id: string;
  judge_key: "judge4" | "judge5";
  provider_key: string | null;
  model: string | null;
  state: string;
  attempt_count: number;
  decision: string | null;
  topics: string;
  tone: string | null;
  humour_mechanisms: string;
  confidence: number | null;
  reasoning: string | null;
  result_json: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  next_attempt_at: string | null;
  lease_owner: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IngestionBatchStatus = {
  batch: IngestionBatchRow;
  storage_usage?: {
    total_bytes: number;
    total_files: number;
  };
  items: Array<{
    job_id: string;
    idempotency_key: string;
    batch_id: string;
    meme_id: string;
    original_filename: string;
    title: string;
    content_hash: string;
    byte_size: number;
    mime_type: string;
    upload_state: string;
    state: string;
    storage_path: string | null;
    url: string;
    duplicate_warning: string | null;
    error_code: string | null;
    error_message: string | null;
    attempt_count: number;
    completed_at: string | null;
    evaluations: Array<{
      judge_key: "judge4" | "judge5";
      provider_key: string | null;
      model: string | null;
      state: string;
      attempt_count: number;
      decision: string | null;
      topics: string[];
      tone: string | null;
      humour_mechanisms: string[];
      confidence: number | null;
      reasoning: string | null;
      error_code: string | null;
      error_message: string | null;
      finished_at: string | null;
    }>;
  }>;
};

let ingestionSchemaAvailable: boolean | null = null;

export const isValidId = (value: string) => ID_PATTERN.test(value);
export const isValidHash = (value: string) => HASH_PATTERN.test(value);

export const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "meme-image";

export const normalizeTitle = (title: string, filename: string) =>
  (title || filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled meme")
    .trim()
    .slice(0, 160);

export const isSupportedImageType = (mimeType: string) => SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase());

export const detectImageMime = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6) {
    const header = new TextDecoder().decode(bytes.slice(0, 6));
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12) {
    const riff = new TextDecoder().decode(bytes.slice(0, 4));
    const webp = new TextDecoder().decode(bytes.slice(8, 12));
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }
  if (bytes.length >= 12) {
    const brand = new TextDecoder().decode(bytes.slice(4, 12));
    if (brand.startsWith("ftyp") && (brand.includes("avif") || brand.includes("avis"))) return "image/avif";
  }
  return null;
};

export const sha256Hex = async (bytes: ArrayBuffer | Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export const boundError = (message: unknown, fallback = "Ingestion operation failed.") => {
  const value = message instanceof Error ? message.message : String(message || fallback);
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500) || fallback;
};

export const toPublicUrl = (env: Env, storagePath: string | null) => {
  if (!storagePath) return "";
  const base = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  return base ? `${base}/${storagePath.replace(/^\/+/, "")}` : "";
};

export const hasIngestionSchema = async (db: D1Database) => {
  if (ingestionSchemaAvailable === true) return true;
  try {
    const result = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('ingestion_batches', 'ingestion_jobs', 'ingestion_ai_evaluations')"
    ).all<{ name: string }>();
    ingestionSchemaAvailable = new Set((result.results || []).map((row) => row.name)).size === 3;
  } catch {
    ingestionSchemaAvailable = false;
  }
  if (!ingestionSchemaAvailable) return false;
  return ingestionSchemaAvailable;
};

export const getIngestionJobState = async (db: D1Database, memeId: string) => {
  if (!(await hasIngestionSchema(db))) return null;
  const row = await db.prepare("SELECT state FROM ingestion_jobs WHERE meme_id = ?")
    .bind(memeId)
    .first<{ state: string }>();
  return row?.state || null;
};

export const getBatchStatus = async (env: Env, batchId: string): Promise<IngestionBatchStatus | null> => {
  const batch = await env.DB.prepare("SELECT * FROM ingestion_batches WHERE id = ?")
    .bind(batchId)
    .first<IngestionBatchRow>();
  if (!batch) return null;

  const jobsResult = await env.DB.prepare(
    "SELECT * FROM ingestion_jobs WHERE batch_id = ? ORDER BY created_at ASC, job_id ASC"
  ).bind(batchId).all<IngestionJobRow>();
  const jobs = jobsResult.results || [];
  const evaluations = new Map<string, IngestionEvaluationRow[]>();

  if (jobs.length > 0) {
    const placeholders = jobs.map(() => "?").join(",");
    const evaluationResult = await env.DB.prepare(
      `SELECT * FROM ingestion_ai_evaluations WHERE job_id IN (${placeholders}) ORDER BY judge_key ASC`
    ).bind(...jobs.map((job) => job.job_id)).all<IngestionEvaluationRow>();
    for (const evaluation of evaluationResult.results || []) {
      const existing = evaluations.get(evaluation.job_id) || [];
      existing.push(evaluation);
      evaluations.set(evaluation.job_id, existing);
    }
  }

  let storageUsage = { total_bytes: 0, total_files: 0 };
  try {
    const statsRow = await env.DB.prepare(
      "SELECT COUNT(*) as total_files, COALESCE(SUM(byte_size), 0) as total_bytes FROM ingestion_jobs WHERE upload_state = 'uploaded'"
    ).first<{ total_files: number; total_bytes: number }>();
    if (statsRow) {
      storageUsage = {
        total_files: Number(statsRow.total_files) || 0,
        total_bytes: Number(statsRow.total_bytes) || 0
      };
    }
  } catch {
    // Non-blocking fallback if ingestion_jobs does not exist yet
  }

  const uploadedCount = (jobs || []).filter((j) => j.upload_state === "uploaded").length;
  const uploadFailedCount = (jobs || []).filter((j) => j.upload_state === "failed").length;
  const aiFailedCount = (jobs || []).filter((j) => j.state === "failed").length;

  return {
    batch: {
      ...batch,
      uploaded_items: uploadedCount,
      upload_failed_items: uploadFailedCount,
      ai_failed_items: aiFailedCount
    },
    storage_usage: storageUsage,
    items: jobs.map((job) => ({
      job_id: job.job_id,
      idempotency_key: job.idempotency_key,
      batch_id: job.batch_id,
      meme_id: job.meme_id,
      original_filename: job.original_filename,
      title: job.title,
      content_hash: job.content_hash,
      byte_size: job.byte_size,
      mime_type: job.mime_type,
      upload_state: job.upload_state,
      state: job.state,
      storage_path: job.storage_path,
      url: toPublicUrl(env, job.storage_path),
      duplicate_warning: job.duplicate_of_job_id,
      error_code: job.error_code,
      error_message: job.error_message,
      attempt_count: job.attempt_count,
      completed_at: job.completed_at,
      evaluations: (evaluations.get(job.job_id) || []).map((evaluation) => ({
        judge_key: evaluation.judge_key,
        provider_key: evaluation.provider_key,
        model: evaluation.model,
        state: evaluation.state,
        attempt_count: evaluation.attempt_count,
        decision: evaluation.decision,
        topics: parseStringArray(evaluation.topics),
        tone: evaluation.tone,
        humour_mechanisms: parseStringArray(evaluation.humour_mechanisms),
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        error_code: evaluation.error_code,
        error_message: evaluation.error_message,
        finished_at: evaluation.finished_at
      }))
    }))
  };
};

export const parseStringArray = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export const refreshBatchStatus = async (db: D1Database, batchId: string) => {
  const counts = await db.prepare(`
    SELECT
      COUNT(*) AS total_items,
      SUM(CASE WHEN upload_state = 'uploaded' THEN 1 ELSE 0 END) AS uploaded_items,
      SUM(CASE WHEN upload_state = 'failed' THEN 1 ELSE 0 END) AS upload_failed_items,
      SUM(CASE WHEN state = 'human_ready' THEN 1 ELSE 0 END) AS ready_items,
      SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) AS ai_failed_items,
      SUM(CASE WHEN upload_state = 'uploading' OR state = 'processing' THEN 1 ELSE 0 END) AS busy_items
    FROM ingestion_jobs
    WHERE batch_id = ?
  `).bind(batchId).first<{
    total_items: number;
    uploaded_items: number;
    upload_failed_items: number;
    ready_items: number;
    ai_failed_items: number;
    busy_items: number;
  }>();

  const total = Number(counts?.total_items || 0);
  const uploaded = Number(counts?.uploaded_items || 0);
  const uploadFailed = Number(counts?.upload_failed_items || 0);
  const ready = Number(counts?.ready_items || 0);
  const aiFailed = Number(counts?.ai_failed_items || 0);
  const busy = Number(counts?.busy_items || 0);

  // Decoupled batch status calculation:
  // The intake batch status represents whether all items were successfully uploaded into R2 and D1 drafts:
  // If all uploads succeeded, status is "complete".
  // An advisory AI evaluation failure must NEVER mark the batch as "failed" or "partial" if uploads succeeded.
  const status = total > 0 && uploaded === total
    ? "complete"
    : busy > 0
    ? "processing"
    : uploadFailed === total && total > 0
    ? "failed"
    : uploadFailed > 0
    ? "partial"
    : "queued";
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE ingestion_batches
    SET status = ?, ready_items = ?, failed_items = ?, updated_at = ?, completed_at = ?
    WHERE id = ?
  `).bind(status, ready, uploadFailed, now, status === "complete" ? now : null, batchId).run();

  return {
    status,
    total_items: total,
    uploaded_items: uploaded,
    upload_failed_items: uploadFailed,
    ready_items: ready,
    failed_items: uploadFailed,
    ai_failed_items: aiFailed
  };
};
