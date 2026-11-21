import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";

/**
 * Read-only duplicate audit of the existing corpus.
 * Groups memes by content_hash or storage_path where count > 1.
 * Does NOT delete or modify anything.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  // 1. Group by content_hash
  const { results: hashDuplicates } = await env.DB.prepare(`
    SELECT content_hash, COUNT(*) as cnt, GROUP_CONCAT(id) as meme_ids, GROUP_CONCAT(corpus_status) as states
    FROM memes
    WHERE content_hash IS NOT NULL AND content_hash != ''
    GROUP BY content_hash
    HAVING COUNT(*) > 1
    LIMIT 100
  `).all<{ content_hash: string; cnt: number; meme_ids: string; states: string }>();

  // 2. Group by storage_path
  const { results: pathDuplicates } = await env.DB.prepare(`
    SELECT storage_path, COUNT(*) as cnt, GROUP_CONCAT(id) as meme_ids
    FROM memes
    WHERE storage_path IS NOT NULL AND storage_path != ''
    GROUP BY storage_path
    HAVING COUNT(*) > 1
    LIMIT 100
  `).all<{ storage_path: string; cnt: number; meme_ids: string }>();

  return json({
    hashDuplicateGroups: (hashDuplicates || []).map((row) => ({
      hash: row.content_hash,
      count: row.cnt,
      memeIds: row.meme_ids.split(","),
      states: row.states.split(",")
    })),
    pathDuplicateGroups: (pathDuplicates || []).map((row) => ({
      path: row.storage_path,
      count: row.cnt,
      memeIds: row.meme_ids.split(",")
    }))
  });
};
