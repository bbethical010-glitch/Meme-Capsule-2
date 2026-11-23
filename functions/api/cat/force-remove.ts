/**
 * POST /api/cat/force-remove
 * 
 * Force remove a meme: immediately deactivate in D1, delete from R2, audit the action.
 * Idempotent: safe to call multiple times.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAuth } from "../../_shared/catAuth";
import { purgeMeme } from "../../_shared/corpus";

interface ForceRemovePayload {
  meme_id?: string;
  reason?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // 1. Authenticate: any active judge
    const user = await requireAuth(request, env);
    const body = (await request.json().catch(() => ({}))) as ForceRemovePayload;

    // 2. Validate meme_id
    const memeId = (body.meme_id || "").trim();
    if (!memeId) {
      return json({ error: "meme_id is required." }, { status: 400 });
    }

    // 3. Trim and validate reason
    let reason: string | null = null;
    if (body.reason) {
      reason = String(body.reason).trim().slice(0, 200);
      if (!reason) reason = null;
    }

    const meme = await env.DB.prepare("SELECT id FROM memes WHERE id = ?")
      .bind(memeId)
      .first<{ id: string }>();
    if (!meme) {
      const alreadyRemoved = await env.DB.prepare(
        "SELECT r2_deleted FROM meme_force_removals WHERE meme_id = ?",
      ).bind(memeId).first<{ r2_deleted: number }>();
      if (alreadyRemoved) {
        return json({ success: true, meme_id: memeId, already_removed: true, r2_deleted: true });
      }
      return json({ error: "Meme not found" }, { status: 404 });
    }

    // 8. Record audit log into meme_force_removals and permanently purge via purgeMeme
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(`
        INSERT INTO meme_force_removals 
        (meme_id, title, image_url, storage_path, r2_key, removed_by, removed_by_name, reason, removed_at, r2_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        memeId,
        meme.title || null,
        meme.image_url || null,
        meme.storage_path || null,
        r2Key || null,
        user.id,
        user.display_name,
        reason,
        now
      ).run();

      await purgeMeme(env, memeId, {
        actor: user.id,
        reason: `cat_force_remove: ${reason}`,
        detail: JSON.stringify({ removed_by_name: user.display_name, r2_key: r2Key })
      });

      return json({
        success: true,
        meme_id: memeId,
        r2_deleted: true
      });
    } catch (dbErr) {
      const errorMsg = dbErr instanceof Error ? dbErr.message : "Purge error";
      return json(
        { success: false, error: `Purge error: ${errorMsg}` },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error force-removing meme";
    return json({ error: msg }, { status: 500 });
  }
};
