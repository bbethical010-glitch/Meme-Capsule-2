/**
 * PATCH /api/curate/nsfw (also supports POST)
 *
 * Dedicated endpoint for curators to toggle/set the persisted NSFW flag
 * on a meme independently of the corpus_status / curation voting flow.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, handleD1Error, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

interface NsfwPayload {
  meme_id?: string;
  is_nsfw?: boolean | number;
}

const handleNsfwUpdate: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const sessionUser = await validateSession(request, env);
    const authHeader = request.headers.get("Authorization");
    const adminToken = env.ADMIN_API_TOKEN;
    const isSuperToken = authHeader && adminToken && authHeader === `Bearer ${adminToken}`;

    // Ensure authorized curator or admin
    if (!sessionUser && !isSuperToken) {
      return json({ error: "Unauthorized curator session." }, { status: 401, headers: CORS_HEADERS });
    }

    const body = (await request.json().catch(() => ({}))) as NsfwPayload;
    const memeId = (body.meme_id || "").trim();

    if (!memeId) {
      return json({ error: "meme_id is required." }, { status: 400, headers: CORS_HEADERS });
    }

    const isNsfw = Boolean(body.is_nsfw === true || body.is_nsfw === 1);
    const flaggedBy = isNsfw ? "curator" : null;

    const res = await env.DB.prepare(
      "UPDATE memes SET is_nsfw = ?, nsfw_flagged_by = ? WHERE id = ?"
    ).bind(isNsfw ? 1 : 0, flaggedBy, memeId).run();

    if (!res.success) {
      return json({ error: "Failed to update meme NSFW status." }, { status: 500, headers: CORS_HEADERS });
    }

    return json({
      success: true,
      meme_id: memeId,
      is_nsfw: isNsfw ? 1 : 0,
      nsfw_flagged_by: flaggedBy
    }, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    return handleD1Error(err, "Error updating NSFW flag");
  }
};

export const onRequestPatch: PagesFunction<Env> = handleNsfwUpdate;
export const onRequestPost: PagesFunction<Env> = handleNsfwUpdate;
