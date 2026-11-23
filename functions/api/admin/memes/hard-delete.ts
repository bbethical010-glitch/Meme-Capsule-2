/**
 * POST /api/admin/memes/hard-delete
 * 
 * Permanently deletes memes from D1 metadata and their associated files from R2.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { hardRemoveMeme } from "../../../_shared/forceRemove";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return json({ error: "An array of meme ids is required." }, { status: 400 });
    }

    const ids = body.ids;

    for (const id of ids) {
      await hardRemoveMeme(env, id, "Manual admin hard delete", "superadmin", "SuperAdmin");
    }

    return json({ 
      success: true, 
      deletedCount: ids.length,
      deleted: ids,
      failedR2: failedR2.length > 0 ? failedR2 : undefined,
      message: `Successfully hard-deleted ${ids.length} memes.` 
    });

  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to hard-delete memes." }, { status: 500 });
  }
};
