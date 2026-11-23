import type { Env } from "./d1r2";

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

  if (!memeRow) {
    return;
  }

  const bucket = env.MEMES_BUCKET;
  const keysToDelete: string[] = [];
  if (bucket) {
    if (memeRow.storage_path) keysToDelete.push(memeRow.storage_path.replace(/^\/+/, ""));
    if (!memeRow.storage_path && memeRow.image_url) {
      try {
        const pathKey = new URL(memeRow.image_url).pathname.replace(/^\/+/, "");
        if (pathKey) keysToDelete.push(pathKey);
      } catch {
        // External URLs are not R2 objects.
      }
    }

    for (const key of keysToDelete) {
      try {
        await bucket.delete(key);
      } catch (error) {
        throw new PurgeR2Error(
          `R2 delete failed for ${key}: ${error instanceof Error ? error.message : "Unknown R2 error"}`,
        );
      }
    }
  }

  // Audit survives deletion of the memes row.
  await env.DB.prepare(`
      INSERT OR IGNORE INTO meme_force_removals 
      (meme_id, title, image_url, storage_path, r2_key, removed_by, removed_by_name, reason, r2_deleted, r2_deleted_at, removed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).bind(
      memeId,
      memeRow?.title || null,
      memeRow?.image_url || null,
      memeRow?.storage_path || null,
      keysToDelete[0] || null,
      removedBy,
      removedByName,
      reason
    ).run();

  await env.DB.prepare(`
    INSERT INTO meme_purge_log
      (meme_id, storage_path, content_hash, reason, actor, r2_deleted, detail)
    SELECT ?, ?, ?, ?, ?, 1, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM meme_purge_log WHERE meme_id = ? AND reason = ?
    )
  `).bind(
    memeId,
    memeRow.storage_path,
    memeRow.content_hash,
    reason,
    removedByName,
    JSON.stringify({ removed_by: removedBy, removed_by_name: removedByName }),
    memeId,
    reason,
  ).run();

  const dependentTables = [
    "meme_curation",
    "meme_curation_final",
    "ai_curation_predictions",
    "ai_cat_decisions",
    "ai_judge_processed",
    "cat_decisions",
    "cat_consensus",
    "ingestion_ai_evaluations",
    "ingestion_jobs",
    "media_operations",
    "meme_analytics",
    "meme_daily_stats",
    "meme_events",
    "meme_reports",
    "curation_legacy_later_votes",
    "analytics_events",
    "android_analytics_events",
  ];

  const statements: D1PreparedStatement[] = [];
  for (const table of dependentTables) {
    const tableSchema = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).bind(table).first<{ sql: string }>();
    if (!tableSchema?.sql) continue;
    const columns = await env.DB.prepare(`PRAGMA table_info("${table}")`).all<{ name: string }>();
    if ((columns.results || []).some((column) => column.name === "meme_id")) {
      statements.push(env.DB.prepare(`DELETE FROM "${table}" WHERE meme_id = ?`).bind(memeId));
    }
  }
  statements.push(env.DB.prepare("DELETE FROM memes WHERE id = ?").bind(memeId));

  await env.DB.batch(statements);

  console.info("[purge] hard-purged meme", {
    meme_id: memeId,
    reason,
    removed_by: removedBy,
  });
}
