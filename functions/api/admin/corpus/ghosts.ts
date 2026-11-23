import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { hardRemoveMeme } from "../../../_shared/forceRemove";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const body = await request.json().catch(() => ({})) as {
    dry_run?: boolean;
    confirm_legacy_force_removals?: boolean;
  };
  const dryRun = body.dry_run !== false;

  const candidates = await env.DB.prepare(`
    SELECT m.id, m.storage_path
    FROM memes m
    INNER JOIN meme_force_removals f ON f.meme_id = m.id
    WHERE f.r2_deleted = 1
    ORDER BY m.uploaded_at ASC
  `).all<{ id: string; storage_path: string | null }>();

  const ids = (candidates.results || []).map((row) => row.id);
  if (dryRun) {
    return json({
      dry_run: true,
      candidate_count: ids.length,
      samples: (candidates.results || []).slice(0, 20),
    });
  }

  if (!body.confirm_legacy_force_removals) {
    return json({ error: "confirm_legacy_force_removals is required." }, { status: 400 });
  }

  let purged = 0;
  for (const id of ids.slice(0, 50)) {
    await hardRemoveMeme(env, id, "Legacy force-removal ghost cleanup", "superadmin", "SuperAdmin");
    purged++;
  }

  return json({
    dry_run: false,
    purged,
    remaining: Math.max(0, ids.length - purged),
  });
};
