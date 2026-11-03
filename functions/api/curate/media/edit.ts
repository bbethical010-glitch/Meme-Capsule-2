/**
 * POST /api/curate/media/edit
 *
 * Compare-and-swap (CAS) canonical media replacement endpoint for human judges.
 * Strictly separates media edits from curation vote submissions.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, handleD1Error, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";

interface MemeRow {
  id: string;
  storage_path: string | null;
  image_url: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);

    // 1. Authorization: Only authenticated human judges or superadmin
    if (!sessionUser) {
      return json({ error: "Curator session required." }, { status: 401 });
    }

    if (sessionUser.role !== "judge" && sessionUser.role !== "superadmin") {
      return json({ error: "Only human judges can edit canonical media." }, { status: 403 });
    }

    // AI judges are strictly prohibited from mutating canonical media
    if (sessionUser.username === "judge4" || sessionUser.username === "judge5") {
      return json({ error: "AI judges are strictly advisory and cannot modify media." }, { status: 403 });
    }

    // 2. Parse Multipart Form Data
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return json({ error: "Invalid multipart form data." }, { status: 400 });
    }

    const memeId = (formData.get("meme_id") as string || "").trim();
    const expectedStoragePath = (formData.get("expected_storage_path") as string || "").trim();
    const file = formData.get("file") as File | null;

    if (!memeId) {
      return json({ error: "meme_id is required." }, { status: 400 });
    }
    if (!file) {
      return json({ error: "file payload is required." }, { status: 400 });
    }

    // 3. Verify current meme record in D1
    const currentMeme = await env.DB.prepare(
      "SELECT id, storage_path, image_url FROM memes WHERE id = ?"
    ).bind(memeId).first<MemeRow>();

    if (!currentMeme) {
      return json({ error: "Meme not found." }, { status: 404 });
    }

    // 4. Compare-and-Swap (CAS) check against expected revision
    const currentPath = (currentMeme.storage_path || "").trim();
    if (currentPath !== expectedStoragePath) {
      return json(
        {
          error: "Stale revision: The meme image was updated by another editor. Please reload.",
          current_storage_path: currentPath,
          expected_storage_path: expectedStoragePath
        },
        { status: 409 }
      );
    }

    // 5. Upload edited media to a new unique R2 key
    const bucket = env.MEMES_BUCKET || (env as any).R2_BUCKET || (env as any).BUCKET;
    if (!bucket) {
      return json({ error: "R2 media storage bucket is not configured." }, { status: 500 });
    }

    const extension = file.type === "image/png" ? "png" : "webp";
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const newStorageKey = `memes/edited-${memeId}-${Date.now()}-${randomSuffix}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(newStorageKey, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || "image/webp",
        cacheControl: "public, max-age=31536000, immutable"
      }
    });

    const publicBase = (env as any).R2_PUBLIC_URL || "https://media.capsule.wtf";
    const newImageUrl = `${publicBase.replace(/\/+$/, "")}/${newStorageKey}`;

    // 6. Atomic D1 Pointer Update with CAS Condition
    // Guarantees that if two concurrent requests race, only one will succeed
    let updateRes;
    if (expectedStoragePath) {
      updateRes = await env.DB.prepare(`
        UPDATE memes
        SET storage_path = ?,
            image_url = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND storage_path = ?
      `).bind(newStorageKey, newImageUrl, memeId, expectedStoragePath).run();
    } else {
      updateRes = await env.DB.prepare(`
        UPDATE memes
        SET storage_path = ?,
            image_url = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND (storage_path IS NULL OR storage_path = '')
      `).bind(newStorageKey, newImageUrl, memeId).run();
    }

    if (updateRes.meta.changes === 0) {
      // Race condition lost: Roll back new R2 object and return 409
      await bucket.delete(newStorageKey).catch(() => undefined);
      return json(
        {
          error: "Stale revision: The meme image was modified concurrently. Changes discarded.",
          conflict: true
        },
        { status: 409 }
      );
    }

    // 7. Audit Logging into media_operations table
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS media_operations (
          id TEXT PRIMARY KEY,
          meme_id TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          actor_name TEXT,
          old_storage_path TEXT,
          new_storage_path TEXT NOT NULL,
          old_image_url TEXT,
          new_image_url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'applied',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
      `).run();

      await env.DB.prepare(`
        INSERT INTO media_operations 
        (id, meme_id, actor_id, actor_name, old_storage_path, new_storage_path, old_image_url, new_image_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'applied')
      `).bind(
        crypto.randomUUID(),
        memeId,
        sessionUser.id,
        sessionUser.display_name,
        expectedStoragePath || null,
        newStorageKey,
        currentMeme.image_url || null,
        newImageUrl
      ).run();
    } catch (auditErr) {
      console.warn("Could not log media_operations audit record:", auditErr);
    }

    // 8. Recoverable Old Object Cleanup
    if (expectedStoragePath && expectedStoragePath !== newStorageKey) {
      try {
        await bucket.delete(expectedStoragePath.replace(/^\/+/, ""));
      } catch (cleanErr) {
        console.warn(`[media-edit] Old R2 object cleanup deferred for ${expectedStoragePath}:`, cleanErr);
      }
    }

    return json({
      success: true,
      meme_id: memeId,
      storage_path: newStorageKey,
      image_url: newImageUrl,
      updated_by: sessionUser.display_name
    });
  } catch (err: unknown) {
    return handleD1Error(err, "Failed to edit canonical meme media");
  }
};

