import type { Env } from "./d1r2";
import { purgeMeme } from "./corpus";

interface MemeRow {
  id: string;
  storage_path: string | null;
  image_url: string | null;
  title: string | null;
  content_hash: string | null;
}

export class PurgeR2Error extends Error {}

/** Complete, idempotent purge used by every manual and automatic removal path. */
export async function hardRemoveMeme(
  env: Env,
  memeId: string,
  reason: string,
  removedBy: string = "system-consensus",
  removedByName: string = "Consensus Engine"
): Promise<void> {
  const memeRow = await env.DB.prepare(
    "SELECT id, storage_path, image_url, title, content_hash FROM memes WHERE id = ?",
  ).bind(memeId).first<MemeRow>();

  // Record permanent audit log into meme_force_removals
  if (memeRow) {
    try {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO meme_force_removals 
        (meme_id, title, image_url, storage_path, r2_key, removed_by, removed_by_name, reason, r2_deleted, r2_deleted_at, removed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      `).bind(
        memeId,
        memeRow.title || null,
        memeRow.image_url || null,
        memeRow.storage_path || null,
        memeRow.storage_path ? memeRow.storage_path.replace(/^\/+/, "") : null,
        removedBy,
        removedByName,
        reason
      ).run();
    } catch (auditErr) {
      console.warn(`[force-remove] Could not log audit row for ${memeId}:`, auditErr);
    }
  }
  statements.push(env.DB.prepare("DELETE FROM memes WHERE id = ?").bind(memeId));

  // Authoritative full purge through purgeMeme
  await purgeMeme(env, memeId, {
    actor: removedBy,
    reason: `force_remove: ${reason}`,
    detail: JSON.stringify({ removed_by_name: removedByName })
  });

  console.info("[purge] hard-purged meme", {
    meme_id: memeId,
    reason,
    removed_by: removedBy,
  });
}
