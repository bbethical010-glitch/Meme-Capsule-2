import type { Env } from "./d1r2";
import { toPublicUrl } from "./ingestion";

export const ALLOWED_MEDIA: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heic",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

export const MAX_BYTES = 20 * 1024 * 1024; // 20 MiB

export type IntakeSource = "admin_upload" | "r2_sync" | "legacy";

export interface VerifyObjectOptions {
  declaredName?: string;
  clientHash?: string;
}

export interface VerificationResult {
  ok: boolean;
  sniffedMime: string | null;
  sizeBytes: number;
  sha256: string;
  checks: string[];
  rejectReason?: "unsupported_extension" | "mime_mismatch" | "size_zero" | "size_exceeded" | "hash_mismatch" | "duplicate" | "object_not_found";
  matchedMemeId?: string;
  previouslyPurged?: boolean;
}

export interface IntakeOptions {
  storagePath: string;
  source: IntakeSource;
  batchId?: string;
  originalFilename?: string;
  clientHash?: string;
  actor: string;
}

export interface IntakeResult {
  ok: boolean;
  memeId?: string;
  jobId?: string;
  batchId?: string;
  rejectReason?: string;
  matchedMemeId?: string;
  sha256?: string;
  previouslyPurged?: boolean;
}

export const detectMediaMime = (bytes: Uint8Array): string | null => {
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
    const boxType = new TextDecoder().decode(bytes.slice(4, 8));
    if (boxType === "ftyp") {
      const brandHeader = new TextDecoder().decode(bytes.slice(8, Math.min(bytes.length, 32))).toLowerCase();
      if (brandHeader.includes("avif") || brandHeader.includes("avis")) return "image/avif";
      if (
        brandHeader.includes("heic") ||
        brandHeader.includes("heix") ||
        brandHeader.includes("hevc") ||
        brandHeader.includes("hevx") ||
        brandHeader.includes("mif1") ||
        brandHeader.includes("msf1")
      ) {
        return "image/heic";
      }
      if (brandHeader.includes("mp4") || brandHeader.includes("isom") || brandHeader.includes("iso2")) {
        return "video/mp4";
      }
      if (brandHeader.includes("qt  ")) {
        return "video/quicktime";
      }
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }
  // Check for SVG
  if (bytes.length >= 5) {
    const sample = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 256))).trim().toLowerCase();
    if (sample.includes("<svg") || sample.includes("<?xml")) {
      return "image/svg+xml";
    }
  }
  return null;
};

export const isExtensionSupported = (filename: string): boolean => {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filename.slice(dotIndex).toLowerCase();
  return ext in ALLOWED_MEDIA;
};

export const sanitizeFilename = (name: string): string => {
  const basename = name.split(/[/\\]/).pop() || "meme-file";
  return basename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "meme-file";
};

/**
 * Computes SHA-256 hex string from byte buffer.
 */
export async function computeSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reads R2 object, runs magic-byte sniff, computes streaming SHA-256,
 * and validates constraints.
 */
export async function verifyObject(
  env: Env,
  storagePath: string,
  options: VerifyObjectOptions = {}
): Promise<VerificationResult> {
  const cleanPath = storagePath.replace(/^\/+/, "");
  const obj = await env.MEMES_BUCKET.get(cleanPath);

  if (!obj) {
    return {
      ok: false,
      sniffedMime: null,
      sizeBytes: 0,
      sha256: "",
      checks: ["r2_exists:fail"],
      rejectReason: "object_not_found"
    };
  }

  const size = obj.size;
  const checks: string[] = ["r2_exists:pass"];

  // 1. Size check
  if (size === 0) {
    return {
      ok: false,
      sniffedMime: null,
      sizeBytes: 0,
      sha256: "",
      checks: [...checks, "size_nonzero:fail"],
      rejectReason: "size_zero"
    };
  }
  if (size > MAX_BYTES) {
    return {
      ok: false,
      sniffedMime: null,
      sizeBytes: size,
      sha256: "",
      checks: [...checks, "size_max:fail"],
      rejectReason: "size_exceeded"
    };
  }
  checks.push("size_valid:pass");

  // Read full body into memory (within 20MB limit)
  const arrayBuffer = await obj.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // 2. Extension check
  const dotIndex = cleanPath.lastIndexOf(".");
  const ext = dotIndex !== -1 ? cleanPath.slice(dotIndex).toLowerCase() : "";
  const expectedMime = ALLOWED_MEDIA[ext];
  if (!expectedMime) {
    return {
      ok: false,
      sniffedMime: null,
      sizeBytes: size,
      sha256: "",
      checks: [...checks, `extension_allowed:${ext || "none"}:fail`],
      rejectReason: "unsupported_extension"
    };
  }
  checks.push("extension_allowed:pass");

  // 3. Magic-byte sniff
  const sniffedMime = detectMediaMime(bytes);
  // Normalize compatible MIME types
  const isCompatible = (expected: string, sniffed: string | null): boolean => {
    if (!sniffed) return false;
    if (expected === sniffed) return true;
    if (expected === "image/jpeg" && sniffed === "image/jpeg") return true;
    if ((expected === "image/heic" || expected === "image/heif") && (sniffed === "image/heic" || sniffed === "image/heif")) return true;
    return false;
  };

  if (!isCompatible(expectedMime, sniffedMime)) {
    return {
      ok: false,
      sniffedMime,
      sizeBytes: size,
      sha256: "",
      checks: [...checks, `mime_sniff:${sniffedMime || "unknown"}:fail`],
      rejectReason: "mime_mismatch"
    };
  }
  checks.push(`mime_sniff:${sniffedMime}:pass`);

  // 4. SHA-256 calculation
  const sha256 = await computeSha256(bytes);
  if (options.clientHash && options.clientHash.toLowerCase() !== sha256) {
    return {
      ok: false,
      sniffedMime,
      sizeBytes: size,
      sha256,
      checks: [...checks, "client_hash_match:fail"],
      rejectReason: "hash_mismatch"
    };
  }
  checks.push("sha256:pass");

  // 5. Duplicate check against single hash store: memes.content_hash + in-flight jobs
  const existingMeme = await env.DB.prepare(`
    SELECT id, storage_path FROM memes WHERE content_hash = ? LIMIT 1
  `).bind(sha256).first<{ id: string; storage_path: string | null }>();

  if (existingMeme && existingMeme.storage_path !== cleanPath) {
    return {
      ok: false,
      sniffedMime,
      sizeBytes: size,
      sha256,
      checks: [...checks, "duplicate_check:fail"],
      rejectReason: "duplicate",
      matchedMemeId: existingMeme.id
    };
  }

  const existingJob = await env.DB.prepare(`
    SELECT job_id, meme_id, storage_path FROM ingestion_jobs
    WHERE content_hash = ? AND upload_state = 'uploaded' AND state IN ('queued', 'processing', 'human_ready')
    LIMIT 1
  `).bind(sha256).first<{ job_id: string; meme_id: string; storage_path: string | null }>();

  if (existingJob && existingJob.storage_path !== cleanPath) {
    return {
      ok: false,
      sniffedMime,
      sizeBytes: size,
      sha256,
      checks: [...checks, "duplicate_inflight_check:fail"],
      rejectReason: "duplicate",
      matchedMemeId: existingJob.meme_id
    };
  }
  checks.push("duplicate_check:pass");

  // 6. Soft flag: previously purged check
  let previouslyPurged = false;
  try {
    const purgeRecord = await env.DB.prepare(
      "SELECT id FROM meme_purge_log WHERE content_hash = ? LIMIT 1"
    ).bind(sha256).first();
    if (purgeRecord) {
      previouslyPurged = true;
      checks.push("previously_purged:flag");
    }
  } catch {}

  return {
    ok: true,
    sniffedMime,
    sizeBytes: size,
    sha256,
    checks,
    previouslyPurged
  };
}

/**
 * Unified server-side intake pipeline.
 * The ONLY function authorized to insert into `memes`.
 * Guarantees Path Equivalence Invariant across all entry routes.
 */
export async function intakeMeme(
  env: Env,
  options: IntakeOptions
): Promise<IntakeResult> {
  const cleanPath = options.storagePath.replace(/^\/+/, "");

  // Race safety: Check if this storage_path already has a memes row
  const existingMeme = await env.DB.prepare(
    "SELECT id, content_hash FROM memes WHERE storage_path = ?"
  ).bind(cleanPath).first<{ id: string; content_hash: string | null }>();

  if (existingMeme) {
    return {
      ok: true,
      memeId: existingMeme.id,
      sha256: existingMeme.content_hash || undefined
    };
  }

  // Verify the physical R2 object
  const verification = await verifyObject(env, cleanPath, {
    clientHash: options.clientHash
  });

  const nowIso = new Date().toISOString();
  const filename = options.originalFilename || cleanPath.split("/").pop() || "meme-file";
  const sanitized = sanitizeFilename(filename);
  const cleanTitle = sanitized.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  const title = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  const batchId = options.batchId || `batch-${options.source}-${Date.now()}`;
  const jobId = `job-${crypto.randomUUID().slice(0, 18)}`;
  const memeId = `meme-${crypto.randomUUID().slice(0, 12)}`;

  // Ensure ingestion_batches exists
  await env.DB.prepare(`
    INSERT OR IGNORE INTO ingestion_batches (
      id, idempotency_key, actor_id, actor_name, source, status, total_items, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'complete', 1, ?, ?)
  `).bind(
    batchId,
    `batch-key-${batchId}`,
    options.actor,
    options.actor,
    options.source,
    nowIso,
    nowIso
  ).run().catch(() => {});

  if (!verification.ok) {
    // Record rejected job; NO memes row is created
    await env.DB.prepare(`
      INSERT OR IGNORE INTO ingestion_jobs (
        job_id, idempotency_key, batch_id, meme_id, original_filename, title,
        content_hash, byte_size, mime_type, media_type, upload_state, state,
        storage_path, source, sniffed_mime, checks_json, reject_reason, matched_meme_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'failed', 'failed', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobId,
      `key-${jobId}`,
      batchId,
      memeId,
      filename,
      title,
      verification.sha256 || "unknown",
      verification.sizeBytes,
      verification.sniffedMime || "application/octet-stream",
      cleanPath,
      options.source,
      verification.sniffedMime || null,
      JSON.stringify(verification.checks),
      verification.rejectReason || "unknown",
      verification.matchedMemeId || null,
      nowIso,
      nowIso
    ).run().catch(() => {});

    return {
      ok: false,
      rejectReason: verification.rejectReason,
      matchedMemeId: verification.matchedMemeId,
      sha256: verification.sha256
    };
  }

  // Verified: Write ingestion_jobs + memes + meme_state_log in one atomic D1 batch
  const publicUrl = toPublicUrl(env, cleanPath);
  const randomKey = Math.random();

  const stmts: D1PreparedStatement[] = [];

  // 1. ingestion_jobs row
  stmts.push(
    env.DB.prepare(`
      INSERT OR IGNORE INTO ingestion_jobs (
        job_id, idempotency_key, batch_id, meme_id, original_filename, title,
        content_hash, byte_size, mime_type, media_type, upload_state, state,
        storage_path, source, sniffed_mime, checks_json, verified_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'uploaded', 'human_ready', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobId,
      `key-${jobId}`,
      batchId,
      memeId,
      filename,
      title,
      verification.sha256,
      verification.sizeBytes,
      verification.sniffedMime,
      cleanPath,
      options.source,
      verification.sniffedMime,
      JSON.stringify(verification.checks),
      nowIso,
      nowIso,
      nowIso
    )
  );

  // 2. memes row: ONLY insert permitted in the system
  stmts.push(
    env.DB.prepare(`
      INSERT OR IGNORE INTO memes (
        id, title, image_url, storage_path, source_link, category, tags,
        rarity, status, corpus_status, media_type, input_method, is_active,
        rights_note, share_text, random_key, content_hash, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, 'Unsorted', '[]', 'Common', 'draft', 'draft', 'image', 'upload', 0, 'reviewed', 'Spawned from Meme Capsule', ?, ?, ?)
    `).bind(
      memeId,
      title,
      publicUrl,
      cleanPath,
      filename,
      randomKey,
      verification.sha256,
      nowIso
    )
  );

  // 3. meme_state_log row
  stmts.push(
    env.DB.prepare(`
      INSERT INTO meme_state_log (meme_id, from_state, to_state, actor, reason, at)
      VALUES (?, NULL, 'draft', ?, 'unified_intake', ?)
    `).bind(
      memeId,
      options.actor,
      nowIso
    )
  );

  await env.DB.batch(stmts);

  return {
    ok: true,
    memeId,
    jobId,
    batchId,
    sha256: verification.sha256,
    previouslyPurged: verification.previouslyPurged
  };
}
