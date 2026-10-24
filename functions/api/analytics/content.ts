import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireSuperadmin, noStore } from "../../_shared/liveAnalytics";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const cacheKey = androidAnalyticsCacheKey("content");
    const cached = !fresh && env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached, { headers: noStore() });
    const { results } = await env.DB.prepare(`
      SELECT
        COALESCE(category, 'Uncategorised') AS category,
        SUM(CASE WHEN event_name = 'meme_view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_name = 'meme_like' THEN 1 ELSE 0 END) AS likes,
        SUM(CASE WHEN event_name = 'meme_share' THEN 1 ELSE 0 END) AS shares,
        SUM(CASE WHEN event_name = 'meme_save' THEN 1 ELSE 0 END) AS saves,
        COUNT(DISTINCT user_hash) AS users
      FROM android_analytics_events
      WHERE category IS NOT NULL
      GROUP BY COALESCE(category, 'Uncategorised')
      ORDER BY views DESC
      LIMIT 20
    `).all();

    const response = { success: true, generated_at: new Date().toISOString(), content: results || [] };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android content analytics error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics content unavailable." }, { status: 500, headers: noStore() });
  }
};
