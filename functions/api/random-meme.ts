import type { PagesFunction } from "../_shared/pages";
import { json, randomMemeOrFallback, type Env } from "../_shared/d1r2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle preflight requests
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

// Handle GET requests with CORS headers attached
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const nsfwParam = url.searchParams.get("nsfw");
  const allowNsfw = nsfwParam === "1" || nsfwParam?.toLowerCase() === "true";
  const excludeIds = (url.searchParams.get("exclude") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);
  const meme = await randomMemeOrFallback(env, { nsfw: allowNsfw, excludeIds });
  return json(
    { meme },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
};
