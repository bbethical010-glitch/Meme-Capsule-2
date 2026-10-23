import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAuth } from "../../_shared/catAuth";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireAuth(request, env);
    const url = new URL(request.url);
    const days = Math.min(90, Math.max(1, Number.parseInt(url.searchParams.get("days") || "30", 10) || 30));
    const cacheKey = androidAnalyticsCacheKey("trends", String(days));
    const cached = env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached);

    const { results } = await env.DB.prepare(`
      SELECT
        substr(timestamp_utc, 1, 10) AS date,
        COUNT(*) AS events,
        COUNT(DISTINCT user_hash) AS active_users,
        SUM(CASE WHEN event_name = 'meme_view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_name = 'meme_like' THEN 1 ELSE 0 END) AS likes,
        SUM(CASE WHEN event_name = 'meme_share' THEN 1 ELSE 0 END) AS shares,
        SUM(CASE WHEN event_name = 'meme_save' THEN 1 ELSE 0 END) AS saves
      FROM android_analytics_events
      WHERE timestamp_utc >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ? || ' days')
      GROUP BY substr(timestamp_utc, 1, 10)
      ORDER BY date ASC
    `).bind(days).all();

    const trends = results || [];
    const response = {
      success: true,
      generated_at: new Date().toISOString(),
      days,
      live: true,
      freshness: {
        last_event_at: trends.length ? trends[trends.length - 1].date : null,
        is_empty: trends.length === 0
      },
      trends
    };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android analytics trends error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics trends unavailable." }, { status: 500 });
  }
};
