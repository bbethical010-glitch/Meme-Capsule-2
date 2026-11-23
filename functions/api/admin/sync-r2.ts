import type { PagesFunction } from "../../_shared/pages";
import { json, requireAdmin, type Env } from "../../_shared/d1r2";
import { hardRemoveMeme } from "../../_shared/forceRemove";

const BATCH_SIZE = 50;

/**
 * POST /api/admin/sync-r2
 * 
 * True Bidirectional Sync between Cloudflare R2 and D1 database:
 * 1. Additions: Creates D1 records for any new files present in R2 but missing in D1.
 * 2. Deletions: Cleans up D1 records (and analytics references) for any R2-backed files that have been removed from the R2 bucket.
 * 3. Preserves: External URL memes (e.g. imgur, external CDNs) are preserved and never deleted.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const startTime = Date.now();

  try {
    const bucket = env.MEMES_BUCKET;
    const db = env.DB;
    const publicBase = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

    // 1. List all objects in R2 bucket (with pagination handling)
    const allObjects: { key: string; uploaded?: string }[] = [];
    let cursor: string | undefined;
    let listAttempts = 0;

    do {
      const options: Record<string, unknown> = { limit: 1000 };
      if (cursor) options.cursor = cursor;

      const listed = await bucket.list(options);
      for (const obj of listed.objects) {
        allObjects.push({
          key: obj.key,
          uploaded: obj.uploaded ? new Date(obj.uploaded as unknown as string).toISOString() : undefined
        });
      }
      cursor = listed.truncated ? listed.cursor : undefined;
      listAttempts++;
      if (listAttempts > 50) break; // safety limit: 50,000 files max
    } while (cursor);

    // 2. Filter only valid image/video media files by extension
    const mediaExtensions = new Set([
      ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp",
      ".mp4", ".webm", ".mov", ".avi", ".mkv"
    ]);

    const mediaObjects = allObjects.filter((obj) => {
      const dotIndex = obj.key.lastIndexOf(".");
      if (dotIndex === -1) return false;
      const ext = obj.key.slice(dotIndex).toLowerCase();
      return mediaExtensions.has(ext);
    });

    const r2KeySet = new Set<string>();
    const r2UrlSet = new Set<string>();

    for (const obj of mediaObjects) {
      r2KeySet.add(obj.key);
      if (publicBase) {
        r2UrlSet.add(`${publicBase}/${obj.key}`);
      }
    }

    // 3. Query all existing memes from D1 database
    const { results: existingMemes } = await db
      .prepare("SELECT id, title, storage_path, image_url, input_method FROM memes")
      .all<{
        id: string;
        title: string | null;
        storage_path: string | null;
        image_url: string | null;
        input_method: string | null;
      }>();

    const d1Rows = existingMemes || [];
    const d1StoragePathsSet = new Set<string>();
    const d1UrlSet = new Set<string>();

    for (const r of d1Rows) {
      if (r.storage_path) d1StoragePathsSet.add(r.storage_path);
      if (r.image_url) d1UrlSet.add(r.image_url);
    }

    // 4. Determine ADDITIONS: Files in R2 that do NOT exist in D1
    const missingInD1 = mediaObjects.filter((obj) => {
      const fullUrl = publicBase ? `${publicBase}/${obj.key}` : obj.key;
      return !d1StoragePathsSet.has(obj.key) && !d1UrlSet.has(fullUrl);
    });

    // 5. Determine DELETIONS: R2-backed records in D1 whose files no longer exist in R2
    const memesToDelete: { id: string; key: string }[] = [];

    for (const r of d1Rows) {
      let isR2Backed = false;
      let r2Key: string | null = null;

      if (r.storage_path && r.storage_path.trim() !== "") {
        isR2Backed = true;
        r2Key = r.storage_path.trim();
      } else if (publicBase && r.image_url && r.image_url.startsWith(publicBase)) {
        isR2Backed = true;
        r2Key = r.image_url.replace(`${publicBase}/`, "").replace(/^\/+/, "");
      } else if (r.input_method === "upload") {
        isR2Backed = true;
        r2Key = r.storage_path || (r.image_url ? r.image_url.split("/").pop() || null : null);
      }

      if (isR2Backed && r2Key) {
        // If it's an R2 file but is no longer present in the bucket
        if (!r2KeySet.has(r2Key)) {
          memesToDelete.push({ id: r.id, key: r2Key });
        }
      }
    }

    // 6. Build and execute R2 additions; remove missing R2 metadata through the canonical purge.
    const statements = [];
    const now = new Date().toISOString();
    const syncedFiles: string[] = [];
    const removedFiles: string[] = [];

    // Add statements for new files
    for (const obj of missingInD1) {
      const ext = obj.key.slice(obj.key.lastIndexOf(".")).toLowerCase();
      const isVideo = [".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(ext);
      const mediaType = isVideo ? "video" : "image";

      const filename = obj.key.split("/").pop() || obj.key;
      const cleanName = filename
        .replace(/^[a-f0-9-]{36,}-?/i, "")
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() || filename.replace(/\.[^.]+$/, "");

      const title = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      const fullUrl = publicBase ? `${publicBase}/${obj.key}` : "";
      const id = crypto.randomUUID();

      statements.push(
        db.prepare(
          `INSERT INTO memes (id, title, image_url, storage_path, source_link, category, tags, rarity, status, media_type, input_method, is_active, uploaded_at, share_text, shown_count, share_count, random_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          title,
          fullUrl,
          obj.key,
          filename,
          "Synced",
          "[]",
          "Common",
          "archived",
          mediaType,
          "upload",
          0,
          obj.uploaded || now,
          "Spawned from Meme Capsule",
          0,
          0,
          Math.random()
        )
      );

      syncedFiles.push(obj.key);
    }

    // Execute in fast chunks of 50
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const chunk = statements.slice(i, i + BATCH_SIZE);
      await db.batch(chunk);
    }

    for (const item of memesToDelete) {
      await hardRemoveMeme(env, item.id, "R2 sync missing-object purge", "sync-r2", "R2 Sync");
      removedFiles.push(item.key);
    }

    const duration = Date.now() - startTime;
    const addedCount = syncedFiles.length;
    const removedCount = memesToDelete.length;

    let message = "All R2 files and D1 records are in sync.";
    if (addedCount > 0 && removedCount > 0) {
      message = `Two-way sync complete: Added ${addedCount} new files, removed ${removedCount} deleted files.`;
    } else if (addedCount > 0) {
      message = `Sync complete: Added ${addedCount} new files from R2.`;
    } else if (removedCount > 0) {
      message = `Sync complete: Removed ${removedCount} deleted files from D1.`;
    }

    return json({
      message,
      totalR2Files: mediaObjects.length,
      alreadyInD1: mediaObjects.length - missingInD1.length,
      newlySynced: addedCount,
      removedCount,
      syncedFiles,
      removedFiles,
      duration_ms: duration
    });
  } catch (error) {
    return json(
      {
        error: "Two-way R2 sync failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
