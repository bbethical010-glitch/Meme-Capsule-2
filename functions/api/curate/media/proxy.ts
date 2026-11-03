/**
 * GET /api/curate/media/proxy
 *
 * Same-origin media proxy endpoint for the Human-Judge Image Editor.
 * Eliminates browser CORS failures when fetching canonical meme images for canvas manipulation.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, handleD1Error, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";

interface MemeRow {
  id: string;
  storage_path: string | null;
  image_url: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const memeId = (url.searchParams.get("id") || "").trim();
    const queryImageUrl = (url.searchParams.get("url") || "").trim();

    // 1. Authenticate curator session (optional for reading public memes, but validate if token present)
    const sessionUser = await validateSession(request, env);
    if (!sessionUser) {
      const tokenParam = url.searchParams.get("token");
      if (tokenParam) {
        const dummyReq = new Request(request.url, {
          headers: { Authorization: `Bearer ${tokenParam}` }
        });
        const userFromParam = await validateSession(dummyReq, env);
        if (!userFromParam) {
          return json({ error: "Curator session required." }, { status: 401 });
        }
      }
    }

    let targetStoragePath = "";
    let targetImageUrl = queryImageUrl;

    // 2. Look up meme record if memeId provided
    if (memeId) {
      const row = await env.DB.prepare(
        "SELECT id, storage_path, image_url FROM memes WHERE id = ?"
      ).bind(memeId).first<MemeRow>();

      if (row) {
        targetStoragePath = (row.storage_path || "").trim();
        targetImageUrl = row.image_url || targetImageUrl;
      }
    }

    // 3. Try reading directly from R2 bucket
    const bucket = env.MEMES_BUCKET || (env as any).R2_BUCKET || (env as any).BUCKET;
    if (bucket && targetStoragePath) {
      const r2Object = await bucket.get(targetStoragePath);
      if (r2Object) {
        const headers = new Headers();
        r2Object.writeHttpMetadata(headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("Cache-Control", "public, max-age=86400");
        return new Response(r2Object.body, { headers });
      }
    }

    // 4. Fallback: Edge fetch from upstream image_url
    if (targetImageUrl) {
      const upstreamRes = await fetch(targetImageUrl, {
        headers: {
          "User-Agent": "MemeCapsule-MediaProxy/1.0"
        }
      });

      if (upstreamRes.ok && upstreamRes.body) {
        const headers = new Headers();
        const contentType = upstreamRes.headers.get("content-type") || "image/jpeg";
        headers.set("Content-Type", contentType);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("Cache-Control", "public, max-age=86400");
        return new Response(upstreamRes.body, { headers });
      }
    }

    return json({ error: "Media not found." }, { status: 404 });
  } catch (error) {
    return handleD1Error(error);
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    }
  });
};

