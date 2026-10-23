/**
 * POST /api/curate/force-remove
 *
 * Permanently deletes a non-meme / invalid image from R2 storage
 * and all D1 database tables so it completely vanishes from existence.
 *
 * Triggered by Shift+Delete / Shift+Backspace or the "FORCE REMOVE" button.
 * Non-undoable by design.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, handleD1Error, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";
import { ensureCurationTables } from "../../_shared/curateDb";
import { hardRemoveMeme } from "../../_shared/forceRemove";

interface ForceRemovePayload {
  meme_id?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);
    if (!sessionUser) {
      return json({ error: "Curator authentication required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ForceRemovePayload;
    const memeId = (body.meme_id || "").trim();

    if (!memeId) {
      return json({ error: "meme_id is required." }, { status: 400 });
    }

    await hardRemoveMeme(
      env,
      memeId,
      `Manual Force Remove by ${sessionUser.display_name}`,
      sessionUser.id,
      sessionUser.display_name
    );

    return json({
      success: true,
      meme_id: memeId,
      message: `Meme ${memeId} permanently removed from R2 storage and database.`
    });
  } catch (err: unknown) {
    return handleD1Error(err, "Error executing force-remove");
  }
};
