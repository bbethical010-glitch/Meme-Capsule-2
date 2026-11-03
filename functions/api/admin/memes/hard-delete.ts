/**
 * POST /api/admin/memes/hard-delete
 * 
 * Permanently deletes memes from D1 metadata and their associated files from R2.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return json({ error: "An array of meme ids is required." }, { status: 400 });
    }

    const ids = body.ids;

    // We must chunk the queries to respect D1 binding limits (max 100 parameters)
    const CHUNK_SIZE = 20;

    // 1. Fetch storage paths to delete from R2
    const storagePaths: string[] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => "?").join(",");
      const { results } = await env.DB.prepare(
        `SELECT storage_path FROM memes WHERE id IN (${placeholders})`
      ).bind(...chunk).all<{ storage_path: string | null }>();
      
      if (results) {
        for (const r of results) {
          if (r.storage_path) storagePaths.push(r.storage_path);
        }
      }
    }

    // 2. Delete from R2
    if (env.R2_BUCKET && storagePaths.length > 0) {
      for (const key of storagePaths) {
        try {
          await env.R2_BUCKET.delete(key);
        } catch (e) {
          console.error("Failed to delete from R2:", key, e);
        }
      }
    }

    // 3. Delete from all tables atomically
    const stmts: D1PreparedStatement[] = [];
    
    for (const id of ids) {
      stmts.push(env.DB.prepare("DELETE FROM meme_curation WHERE meme_id = ?").bind(id));
      stmts.push(env.DB.prepare("DELETE FROM meme_curation_final WHERE meme_id = ?").bind(id));
      stmts.push(env.DB.prepare("DELETE FROM ai_curation_predictions WHERE meme_id = ?").bind(id));
      stmts.push(env.DB.prepare("DELETE FROM memes WHERE id = ?").bind(id));
    }

    // Execute in batches (4 statements per ID, chunk by 50 statements total to be safe)
    const STMT_CHUNK_SIZE = 50;
    for (let i = 0; i < stmts.length; i += STMT_CHUNK_SIZE) {
      await env.DB.batch(stmts.slice(i, i + STMT_CHUNK_SIZE));
    }

    return json({ 
      success: true, 
      deletedCount: ids.length, 
      message: `Successfully hard-deleted ${ids.length} memes.` 
    });

  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to hard-delete memes." }, { status: 500 });
  }
};
