/**
 * GET /api/catalog
 * Returns the current curated meme index for client-side shuffled decks.
 */
import type { PagesFunction } from "../_shared/pages";
import { json, type Env, handleD1Error } from "../_shared/d1r2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const CACHE_HEADERS = {
  ...CORS_HEADERS,
  "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
};

type CatalogRow = {
  id: string;
  image_url: string | null;
  storage_path: string | null;
  title: string | null;
  category: string | null;
  rarity: string | null;
  likes_count: number;
  uploaded_at: string | null;
};

const publicUrl = (env: Env, storagePath: string) => {
  const base = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  return base ? `${base}/${storagePath.replace(/^\/+/, "")}` : "";
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const result = await env.DB.prepare(`
      SELECT
        m.id,
        m.image_url,
        m.storage_path,
        m.title,
        m.category,
        m.rarity,
        m.likes_count,
        m.uploaded_at
      FROM memes m
      INNER JOIN meme_curation_final f ON m.id = f.meme_id
      WHERE m.is_active = 1
        AND m.status = 'active'
        AND f.corpus_status = 'keep'
        AND (m.category IS NULL OR LOWER(m.category) != 'archived')
      ORDER BY m.uploaded_at DESC
    `).all<CatalogRow>();

    const memes = (result.results || []).map((row) => ({
      ...row,
      image_url: row.image_url || (row.storage_path ? publicUrl(env, row.storage_path) : null),
    }));

    return json({ memes, total: memes.length }, { headers: CACHE_HEADERS });
  } catch (error) {
    return handleD1Error(error, "Failed to load meme catalog");
  }
};
