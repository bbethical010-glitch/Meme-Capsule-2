import { dailyFallbackMeme, randomFallbackMeme } from "./fallbackMemes";
import type { Meme } from "../../src/types";

export type Env = {
  DB: D1Database;
  MEMES_BUCKET: R2Bucket;
  ADMIN_API_TOKEN?: string;
  R2_PUBLIC_URL?: string;
  ANALYTICS_KV?: KVNamespace;
};

export interface CatUser {
  id: string;
  username: string;
  display_name: string;
  role: "judge" | "superadmin";
  is_active: number;
}

export type D1MemeRow = {
  id: string;
  title: string | null;
  image_url: string | null;
  storage_path: string | null;
  source_link: string | null;
  category: string | null;
  tags: string | null;
  is_nsfw: number;
  rarity: string | null;
  status: string | null;
  curation_status?: string | null;
  media_type: string | null;
  input_method: string | null;
  is_active: number;
  uploaded_at: string | null;
  share_text: string | null;
  rights_note: string | null;
  shown_count: number;
  share_count: number;
  likes_count: number;
  random_key: number;
  is_nsfw?: number;
  nsfw_flagged_by?: string | null;
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init.headers
    }
  });

export const handleD1Error = (err: unknown, fallbackMessage: string = "Database operation failed") => {
  if (err instanceof Response) return err;
  const msg = err instanceof Error ? err.message : fallbackMessage;
  const isQuota = /quota|limit exceeded|resource limit/i.test(msg);
  return json(
    {
      error: isQuota ? "Cloudflare D1 daily quota limit reached. Operations temporarily paused." : msg,
      isQuotaExceeded: isQuota
    },
    { status: isQuota ? 429 : 500 }
  );
};

export const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_API_TOKEN) {
    return json({ error: "ADMIN_API_TOKEN is not configured." }, { status: 503 });
  }

  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const headerToken = request.headers.get("X-Admin-Token") || "";

  if (bearer !== env.ADMIN_API_TOKEN && headerToken !== env.ADMIN_API_TOKEN) {
    return json({ error: "Unauthorized admin request." }, { status: 401 });
  }

  return null;
};

const parseTags = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toPublicUrl = (env: Env, storagePath: string) => {
  const base = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
  const trimmedPath = storagePath.replace(/^\/+/, "");
  return base ? `${base}/${trimmedPath}` : "";
};

export const normalizeRow = (env: Env, row: D1MemeRow): Meme => ({
  id: row.id,
  title: row.title || undefined,
  url: row.image_url || (row.storage_path ? toPublicUrl(env, row.storage_path) : ""),
  storage_path: row.storage_path || undefined,
  source_link: row.source_link || row.image_url || row.storage_path || undefined,
  category: row.category || "Unsorted",
  tags: parseTags(row.tags),
  rarity: (row.rarity as Meme["rarity"]) || "Common",
  status: (row.status as Meme["status"]) || "active",
  curation_status: (row.curation_status as Meme["curation_status"]) || null,
  media_type: (row.media_type as Meme["media_type"]) || "image",
  input_method: (row.input_method as Meme["input_method"]) || "url",
  uploaded_at: row.uploaded_at || new Date().toISOString(),
  share_text: row.share_text || "Spawned from Meme Capsule",
  rights_note: row.rights_note || undefined,
  likes_count: row.likes_count ?? 0,
  is_nsfw: row.is_nsfw ?? 0,
  nsfw_flagged_by: row.nsfw_flagged_by ?? null
});

export const getRandomMeme = async (env: Env, options?: { nsfw?: boolean }): Promise<Meme | null> => {
  const randomKey = Math.random();
  const nsfwClause = options?.nsfw ? "" : "AND (m.is_nsfw IS NULL OR m.is_nsfw = 0)";

  const { results } = await env.DB.prepare(
    `SELECT m.* FROM memes m
     INNER JOIN meme_curation_final f ON m.id = f.meme_id
     WHERE m.is_active = 1 AND m.status = 'active' AND f.corpus_status = 'keep' AND (m.category IS NULL OR LOWER(m.category) != 'archived') ${nsfwClause} AND m.random_key >= ?
     ORDER BY m.random_key ASC LIMIT 1`
  ).bind(randomKey).all<D1MemeRow>();

  let row = results[0];

  if (!row) {
    const wrap = await env.DB.prepare(
      `SELECT m.* FROM memes m
       INNER JOIN meme_curation_final f ON m.id = f.meme_id
       WHERE m.is_active = 1 AND m.status = 'active' AND f.corpus_status = 'keep' AND (m.category IS NULL OR LOWER(m.category) != 'archived') ${nsfwClause}
       ORDER BY m.random_key ASC LIMIT 1`
    ).all<D1MemeRow>();
    row = wrap.results[0];
  }

  if (!row) return null;

  const meme = normalizeRow(env, row);
  return meme.url ? meme : null;
};

export const getDailyMeme = async (env: Env, options?: { nsfw?: boolean }): Promise<Meme | null> => {
  const nsfwClause = options?.nsfw ? "" : "AND (m.is_nsfw IS NULL OR m.is_nsfw = 0)";
  const { results } = await env.DB.prepare(
    `SELECT m.* FROM memes m
     INNER JOIN meme_curation_final f ON m.id = f.meme_id
     WHERE m.is_active = 1 AND m.status = 'active' AND f.corpus_status = 'keep' AND (m.category IS NULL OR LOWER(m.category) != 'archived') ${nsfwClause}
     ORDER BY m.uploaded_at DESC LIMIT 50`
  ).all<D1MemeRow>();

  if (results.length === 0) return null;

  const now = new Date();
  const dayStamp = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const row = results[Math.floor(dayStamp / 86_400_000) % results.length];
  const meme = normalizeRow(env, row);
  return meme.url ? meme : null;
};

export const randomMemeOrFallback = async (env: Env, options?: { nsfw?: boolean }) => {
  try {
    return (await getRandomMeme(env, options)) || randomFallbackMeme();
  } catch {
    return randomFallbackMeme();
  }
};

export const dailyMemeOrFallback = async (env: Env, options?: { nsfw?: boolean }) => {
  try {
    return (await getDailyMeme(env, options)) || dailyFallbackMeme();
  } catch {
    return dailyFallbackMeme();
  }
};
