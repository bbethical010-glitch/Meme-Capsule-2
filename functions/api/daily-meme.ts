import type { PagesFunction } from "../_shared/pages";
import { dailyMemeOrFallback, json, type Env } from "../_shared/d1r2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const nsfwParam = url.searchParams.get("nsfw");
  const allowNsfw = nsfwParam === "1" || nsfwParam?.toLowerCase() === "true";
  const meme = await dailyMemeOrFallback(env, { nsfw: allowNsfw });
  const today = new Date().toISOString().slice(0, 10);
  return json(
    { meme, date: today },
    {
      headers: CORS_HEADERS,
    }
  );
};
