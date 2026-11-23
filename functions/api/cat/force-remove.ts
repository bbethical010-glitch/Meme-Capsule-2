/**
 * POST /api/cat/force-remove
 * 
 * Force remove a meme: immediately deactivate in D1, delete from R2, audit the action.
 * Idempotent: safe to call multiple times.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAuth } from "../../_shared/catAuth";
import { hardRemoveMeme } from "../../_shared/forceRemove";

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

    await hardRemoveMeme(
      env,
      memeId,
      reason || "Manual categorization force remove",
      user.id,
      user.display_name,
    );
    return json({ success: true, meme_id: memeId, r2_deleted: true });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error force-removing meme";
    return json({ error: msg }, { status: 500 });
  }
};
