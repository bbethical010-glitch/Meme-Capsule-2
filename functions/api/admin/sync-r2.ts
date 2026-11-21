import type { PagesFunction } from "../../_shared/pages";
import { json, requireAdmin, type Env } from "../../_shared/d1r2";
import { intakeMeme } from "../../_shared/intake";
import { purgeMeme } from "../../_shared/corpus";

const CHUNK_SIZE = 25;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * POST /api/admin/sync-r2
 * 
 * Rebuilt on Unified Intake Pipeline:
 * - New R2 objects verified via intakeMeme (source = 'r2_sync')
 * - Skips already-registered storage_paths (never reprocesses)
 * - Deletions use authoritative purgeMeme with 15-minute grace window
 * - Mass deletion safety guard: min(100, 3% of corpus) unless confirmed
 * - Chunked execution (max 25 objects per request) with resumable cursor
 * - Dry-run mode support
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const startTime = Date.now();

  try {
    const bucket = env.MEMES_BUCKET;
    const db = env.DB;
    const url = new URL(request.url);

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const isDryRun = url.searchParams.get("dry_run") === "true" || body.dry_run === true;
    const cursor = (url.searchParams.get("cursor") || body.cursor || "").trim() || undefined;
    const confirmDeleteCount = Number(body.confirm_delete_count || url.searchParams.get("confirm_delete_count"));

    // 1. List objects from R2
    const listLimit = isDryRun ? 1000 : CHUNK_SIZE;
    const listed = await bucket.list({
      limit: listLimit,
      cursor
    });

    const nextCursor = listed.truncated ? listed.cursor : undefined;
    const r2Objects = listed.objects;

    // 2. Fetch existing storage paths from D1 (from both memes and ingestion_jobs)
    const existingJobs = await db.prepare(
      "SELECT storage_path FROM ingestion_jobs WHERE storage_path IS NOT NULL"
    ).all<{ storage_path: string }>();

    const existingMemes = await db.prepare(
      "SELECT id, storage_path, uploaded_at FROM memes WHERE storage_path IS NOT NULL"
    ).all<{ id: string; storage_path: string; uploaded_at: string }>();

    const knownJobPaths = new Set((existingJobs.results || []).map((j) => j.storage_path.replace(/^\/+/, "")));
    const knownMemePaths = new Map<string, { id: string; uploaded_at: string }>();
    for (const m of existingMemes.results || []) {
      knownMemePaths.set(m.storage_path.replace(/^\/+/, ""), { id: m.id, uploaded_at: m.uploaded_at });
    }

    const totalCorpusRows = knownMemePaths.size;
    const now = Date.now();

    // 3. Classify listed R2 objects
    const wouldAdd: string[] = [];
    const wouldSkip: string[] = [];

    for (const obj of r2Objects) {
      const cleanKey = obj.key.replace(/^\/+/, "");
      // Grace window for very fresh R2 uploads: ignore objects younger than 2 minutes
      const objAgeMs = obj.uploaded ? now - new Date(obj.uploaded as any).getTime() : Infinity;
      if (objAgeMs < 2 * 60 * 1000) {
        wouldSkip.push(cleanKey);
        continue;
      }

      if (knownJobPaths.has(cleanKey) || knownMemePaths.has(cleanKey)) {
        wouldSkip.push(cleanKey);
      } else {
        wouldAdd.push(cleanKey);
      }
    }

    // 4. Identify potential deletions (R2-backed memes whose R2 file is gone)
    // Only evaluate deletions if we did a full dry run or explicitly requested
    const toDelete: Array<{ id: string; key: string }> = [];
    if (isDryRun && !cursor && !listed.truncated) {
      const currentR2KeySet = new Set(r2Objects.map((o) => o.key.replace(/^\/+/, "")));
      for (const [key, meme] of knownMemePaths.entries()) {
        const uploadedMs = meme.uploaded_at ? new Date(meme.uploaded_at).getTime() : 0;
        const ageMs = now - uploadedMs;
        // 15-minute orphan grace window
        if (ageMs > FIFTEEN_MINUTES_MS && !currentR2KeySet.has(key)) {
          toDelete.push({ id: meme.id, key });
        }
      }
    }

    // Dry Run Output
    if (isDryRun) {
      return json({
        dry_run: true,
        would_add: wouldAdd.length,
        would_skip: wouldSkip.length,
        to_delete: toDelete.length,
        samples: {
          add: wouldAdd.slice(0, 10),
          skip: wouldSkip.slice(0, 10),
          delete: toDelete.slice(0, 10)
        },
        has_more: !!nextCursor,
        next_cursor: nextCursor,
        duration_ms: Date.now() - startTime
      });
    }

    // 5. Apply Mode: Execute additions via unified intakeMeme
    let addedCount = 0;
    const rejectedByReason: Record<string, number> = {};
    const syncBatchId = `batch-sync-${now}`;

    for (const key of wouldAdd) {
      const intakeRes = await intakeMeme(env, {
        storagePath: key,
        source: "r2_sync",
        batchId: syncBatchId,
        actor: "sync-r2"
      });

      if (intakeRes.ok) {
        addedCount++;
      } else {
        const reason = intakeRes.rejectReason || "unknown";
        rejectedByReason[reason] = (rejectedByReason[reason] || 0) + 1;
      }
    }

    // 6. Deletion safety checks if deletions are staged
    let deletedCount = 0;
    if (toDelete.length > 0) {
      const maxAllowedDeletions = Math.max(1, Math.min(100, Math.floor(totalCorpusRows * 0.03)));
      if (toDelete.length > maxAllowedDeletions && confirmDeleteCount !== toDelete.length) {
        return json({
          error: "Mass deletion safety limit exceeded.",
          proposed_deletions: toDelete.length,
          max_allowed_without_confirmation: maxAllowedDeletions,
          hint: `Provide confirm_delete_count: ${toDelete.length} to confirm.`
        }, { status: 400 });
      }

      for (const item of toDelete) {
        await purgeMeme(env, item.id, {
          actor: "sync-r2",
          reason: "r2_sync_orphan",
          detail: `File ${item.key} missing from R2 during sync`
        });
        deletedCount++;
      }
    }

    return json({
      success: true,
      added: addedCount,
      rejected_by_reason: rejectedByReason,
      skipped: wouldSkip.length,
      deleted: deletedCount,
      remaining_in_chunk: r2Objects.length - (wouldAdd.length + wouldSkip.length),
      has_more: !!nextCursor,
      next_cursor: nextCursor,
      duration_ms: Date.now() - startTime
    });
  } catch (error: any) {
    return json({
      error: "R2 sync execution failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};
