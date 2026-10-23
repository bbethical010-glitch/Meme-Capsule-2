import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAuth } from "../../_shared/catAuth";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

const stages = [
  ["app_open", "App open"],
  ["meme_view", "Meme viewed"],
  ["meme_like", "Liked"],
  ["meme_share", "Shared"],
  ["meme_save", "Saved"]
] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireAuth(request, env);
    const cacheKey = androidAnalyticsCacheKey("funnel");
    const cached = env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached);
    const { results } = await env.DB.prepare(`
      SELECT event_name, COUNT(DISTINCT session_id) AS sessions
      FROM android_analytics_events
      WHERE event_name IN ('app_open', 'meme_view', 'meme_like', 'meme_share', 'meme_save')
      GROUP BY event_name
    `).all<{ event_name: string; sessions: number }>();
    const counts = new Map((results || []).map((row) => [row.event_name, Number(row.sessions || 0)]));
    const firstCount = counts.get("app_open") || 0;

    const response = {
      success: true,
      generated_at: new Date().toISOString(),
      funnel: stages.map(([event, label]) => {
        const sessions = counts.get(event) || 0;
        return {
          event,
          label,
          sessions,
          conversion_rate: firstCount ? sessions / firstCount : 0
        };
      })
    };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android funnel error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics funnel unavailable." }, { status: 500 });
  }
};
